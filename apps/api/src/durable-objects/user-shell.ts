/**
 * User-scoped, replayable shell projection for session/sidebar state.
 *
 * @packageDocumentation
 */

import { DurableObject } from 'cloudflare:workers'
import {
  ShellSubscribeCommandSchema,
  type ShellEventRecord,
  type ShellSessionSummary,
  type ShellStreamFrame,
} from '@ship/contracts'

import type { Env } from '../env.d'
import { toShellSessionSummary, type ShellSessionRow } from '../lib/shell-summary'
import { firstSqlRow } from './sql-first'

interface ShellEventRow extends Record<string, SqlStorageValue> {
  sequence: number
  payload: string
  occurred_at: number
}

interface SummaryRow extends Record<string, SqlStorageValue> {
  session_id: string
  revision: number
  payload: string
}

interface ShellConnectionState {
  role: 'consumer'
  protocolVersion: 2
  phase: 'awaiting-subscribe' | 'synchronizing' | 'live'
  lastSentSequence: number
}

const REPLAY_LIMIT = 2_000
const RETAIN_MAX = 5_000
const RETAIN_TARGET = 4_000

/** One strongly consistent shell projection per authenticated user. */
export class UserShellDO extends DurableObject<Env> {
  private readonly sql: SqlStorage

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env)
    this.sql = ctx.storage.sql
    ctx.blockConcurrencyWhile(async () => this.migrate())
  }

  /** Initialize identity and reconcile from D1 when the projection is stale. */
  async initialize(userId: string): Promise<void> {
    const existing = this.meta('user_id')
    if (existing && existing !== userId) throw new Error('Shell identity mismatch')
    this.setMeta('user_id', userId)
    const reconciledAt = Number(this.meta('reconciled_at') || 0)
    if (Date.now() - reconciledAt > 60_000) await this.reconcile(userId)
  }

  /** Merge the current D1 session index into the strongly consistent projection. */
  async reconcile(userId: string): Promise<void> {
    const result = await this.env.DB.prepare(
      `SELECT id, user_id, repo_owner, repo_name, status, last_activity, created_at,
              archived_at, title, model, agent_type, revision
       FROM chat_sessions WHERE user_id = ? AND status != 'deleted'`,
    )
      .bind(userId)
      .all<ShellSessionRow>()

    const rows = await this.recoverLegacySelections(result.results.slice(), 20)
    const seen = new Set(rows.map((row) => row.id))
    for (const row of rows) {
      const current = this.getSummary(row.id)
      const runtime = current?.runtime ?? { state: 'idle' as const }
      this.upsertSummary(toShellSessionSummary(row, runtime))
    }
    for (const stored of this.summaryRows()) {
      if (!seen.has(stored.session_id)) this.removeSession(stored.session_id)
    }
    this.setMeta('reconciled_at', String(Date.now()))
  }

  /** Insert a full summary and publish it after persistence. */
  upsertSummary(summary: ShellSessionSummary): ShellEventRecord | null {
    const existing = this.summaryRow(summary.id)
    if (existing && existing.revision > summary.revision) return null
    if (existing && existing.payload === JSON.stringify(summary)) return null
    const payload = JSON.stringify(summary)
    this.sql.exec(
      `INSERT INTO session_summaries (session_id, revision, payload, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(session_id) DO UPDATE SET revision = excluded.revision,
         payload = excluded.payload, updated_at = excluded.updated_at`,
      summary.id,
      summary.revision,
      payload,
      Date.now(),
    )
    return this.appendAndBroadcast({ type: 'session.upserted', summary })
  }

  /** Remove a session summary and publish the ordered removal record. */
  removeSession(sessionId: string): ShellEventRecord | null {
    const existing = this.summaryRow(sessionId)
    if (!existing) return null
    this.sql.exec('DELETE FROM session_summaries WHERE session_id = ?', sessionId)
    return this.appendAndBroadcast({ type: 'session.removed', sessionId: sessionId as ShellSessionSummary['id'] })
  }

  /** Consume a short-lived websocket ticket exactly once for this user. */
  consumeTicket(ticketId: string, expiresAt: number): boolean {
    this.sql.exec('DELETE FROM consumed_tickets WHERE expires_at < ?', Date.now())
    const existing = firstSqlRow(
      this.sql.exec<{ ticket_id: string }>('SELECT ticket_id FROM consumed_tickets WHERE ticket_id = ?', ticketId),
    )
    if (existing) return false
    this.sql.exec('INSERT INTO consumed_tickets (ticket_id, expires_at) VALUES (?, ?)', ticketId, expiresAt)
    return true
  }

  /** Upgrade an authenticated shell websocket. */
  async fetch(request: Request): Promise<Response> {
    if (request.headers.get('Upgrade') !== 'websocket') return new Response('Expected WebSocket', { status: 426 })
    const pair = new WebSocketPair()
    const [client, server] = Object.values(pair)
    this.ctx.acceptWebSocket(server, ['consumer'])
    server.serializeAttachment({
      role: 'consumer',
      protocolVersion: 2,
      phase: 'awaiting-subscribe',
      lastSentSequence: 0,
    } satisfies ShellConnectionState)
    return new Response(null, { status: 101, webSocket: client })
  }

  /** Handle subscribe and application-level ping commands after hibernation. */
  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    if (typeof message !== 'string') return this.sendError(ws, 'invalid_frame', false)
    let value: unknown
    try {
      value = JSON.parse(message)
    } catch {
      return this.sendError(ws, 'invalid_json', false)
    }
    if (typeof value === 'object' && value && (value as { type?: string }).type === 'ping') {
      ws.send(JSON.stringify({ type: 'pong', occurredAt: Date.now() } satisfies ShellStreamFrame))
      return
    }
    const parsed = ShellSubscribeCommandSchema.safeParse(value)
    if (!parsed.success) return this.sendError(ws, 'invalid_subscribe', false)
    this.synchronize(ws, parsed.data.afterSequence)
  }

  /** Close a hibernating websocket when the runtime supplies a valid close code. */
  async webSocketClose(ws: WebSocket, code: number, reason: string): Promise<void> {
    if (code >= 1000 && code <= 4999 && ![1005, 1006, 1015].includes(code)) ws.close(code, reason)
  }

  /** Close a failed consumer without exposing internal error details. */
  async webSocketError(ws: WebSocket): Promise<void> {
    ws.close(1011, 'Realtime connection failed')
  }

  private migrate(): void {
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS _sql_schema_migrations (id INTEGER PRIMARY KEY, applied_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS session_summaries (
        session_id TEXT PRIMARY KEY, revision INTEGER NOT NULL, payload TEXT NOT NULL, updated_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS shell_events (
        sequence INTEGER PRIMARY KEY AUTOINCREMENT, event_type TEXT NOT NULL, payload TEXT NOT NULL, occurred_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS shell_metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS consumed_tickets (ticket_id TEXT PRIMARY KEY, expires_at INTEGER NOT NULL);
      CREATE INDEX IF NOT EXISTS idx_shell_events_sequence ON shell_events(sequence);
      CREATE INDEX IF NOT EXISTS idx_consumed_tickets_expiry ON consumed_tickets(expires_at);
      INSERT OR IGNORE INTO _sql_schema_migrations (id, applied_at) VALUES (1, ${Date.now()});
    `)
  }

  private synchronize(ws: WebSocket, cursor: number | undefined): void {
    const head = this.headSequence()
    const minimum = this.minimumSequence()
    const state = this.connectionState(ws)
    state.phase = 'synchronizing'
    ws.serializeAttachment(state)
    if (cursor === undefined || cursor > head || (minimum > 0 && cursor < minimum - 1) || head - cursor > REPLAY_LIMIT) {
      const reason = cursor === undefined ? 'initial' : cursor > head ? 'cursor-ahead' : 'gap'
      ws.send(JSON.stringify({
        type: 'shell.snapshot',
        snapshotSequence: head,
        sessions: this.summaries(),
        reason,
        generatedAt: Date.now(),
      } satisfies ShellStreamFrame))
      state.lastSentSequence = head
    } else {
      const records = this.eventsAfter(cursor)
      if (records.length > 0) ws.send(JSON.stringify({ type: 'shell.events', records } satisfies ShellStreamFrame))
      state.lastSentSequence = records.at(-1)?.sequence ?? cursor
    }
    ws.send(JSON.stringify({ type: 'shell.synchronized', sequence: state.lastSentSequence } satisfies ShellStreamFrame))
    state.phase = 'live'
    ws.serializeAttachment(state)
  }

  private appendAndBroadcast(event: ShellEventRecord['event']): ShellEventRecord {
    const occurredAt = Date.now()
    this.sql.exec('INSERT INTO shell_events (event_type, payload, occurred_at) VALUES (?, ?, ?)', event.type, JSON.stringify(event), occurredAt)
    const sequence = this.headSequence()
    const record = { sequence, occurredAt, event } as ShellEventRecord
    const frame = JSON.stringify({ type: 'shell.events', records: [record] } satisfies ShellStreamFrame)
    for (const ws of this.ctx.getWebSockets('consumer')) {
      const state = this.connectionState(ws)
      if (state.phase !== 'live' || sequence <= state.lastSentSequence) continue
      ws.send(frame)
      state.lastSentSequence = sequence
      ws.serializeAttachment(state)
    }
    this.pruneEvents()
    return record
  }

  private eventsAfter(sequence: number): ShellEventRecord[] {
    return this.sql.exec<ShellEventRow>(
      'SELECT sequence, payload, occurred_at FROM shell_events WHERE sequence > ? ORDER BY sequence LIMIT ?',
      sequence,
      REPLAY_LIMIT,
    ).toArray().map((row) => ({ sequence: row.sequence, occurredAt: row.occurred_at, event: JSON.parse(row.payload) }) as ShellEventRecord)
  }

  private summaries(): ShellSessionSummary[] {
    return this.summaryRows().map((row) => JSON.parse(row.payload) as ShellSessionSummary)
  }

  private summaryRows(): SummaryRow[] {
    return this.sql.exec<SummaryRow>('SELECT session_id, revision, payload FROM session_summaries').toArray()
  }

  private summaryRow(sessionId: string): SummaryRow | null {
    return firstSqlRow(
      this.sql.exec<SummaryRow>(
        'SELECT session_id, revision, payload FROM session_summaries WHERE session_id = ?',
        sessionId,
      ),
    )
  }

  private getSummary(sessionId: string): ShellSessionSummary | null {
    const row = this.summaryRow(sessionId)
    return row ? JSON.parse(row.payload) as ShellSessionSummary : null
  }

  private headSequence(): number {
    return this.sql.exec<{ value: number }>('SELECT COALESCE(MAX(sequence), 0) AS value FROM shell_events').one().value
  }

  private minimumSequence(): number {
    return this.sql.exec<{ value: number }>('SELECT COALESCE(MIN(sequence), 0) AS value FROM shell_events').one().value
  }

  private pruneEvents(): void {
    const count = this.sql.exec<{ value: number }>('SELECT COUNT(*) AS value FROM shell_events').one().value
    if (count <= RETAIN_MAX) return
    this.sql.exec(`DELETE FROM shell_events WHERE sequence <= (
      SELECT sequence FROM shell_events ORDER BY sequence DESC LIMIT 1 OFFSET ?
    )`, RETAIN_TARGET)
  }

  private meta(key: string): string | null {
    return firstSqlRow(
      this.sql.exec<{ value: string }>('SELECT value FROM shell_metadata WHERE key = ?', key),
    )?.value ?? null
  }

  private setMeta(key: string, value: string): void {
    this.sql.exec(`INSERT INTO shell_metadata (key, value) VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value`, key, value)
  }

  private connectionState(ws: WebSocket): ShellConnectionState {
    return ws.deserializeAttachment() as ShellConnectionState
  }

  private sendError(ws: WebSocket, code: string, retryable: boolean): void {
    ws.send(JSON.stringify({ type: 'shell.error', code, retryable } satisfies ShellStreamFrame))
  }

  private async recoverLegacySelections(rows: ShellSessionRow[], limit: number): Promise<ShellSessionRow[]> {
    const missing = rows.filter((row) => !row.model || !row.agent_type).slice(0, limit)
    for (const row of missing) {
      const meta: Record<string, string> = await this.env.SESSION_DO.getByName(row.id).getSessionMeta().catch(() => ({}))
      const model = row.model || meta['model'] || null
      const agent = row.agent_type || meta['agent_type'] || meta['acp_backend_kind'] || null
      if (model || agent) {
        await this.env.DB.prepare(`UPDATE chat_sessions SET model = COALESCE(model, ?),
          agent_type = COALESCE(agent_type, ?) WHERE id = ?`).bind(model, agent, row.id).run()
        row.model = model
        row.agent_type = agent
      }
    }
    return rows
  }
}
