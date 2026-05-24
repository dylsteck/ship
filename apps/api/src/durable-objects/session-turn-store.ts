import type { Turn, TurnDiffSummary, TurnStatus } from '@ship/contracts'

/** SQLite row shape for the `turns` table. */
export interface TurnRow extends Record<string, SqlStorageValue> {
  id: string
  session_id: string
  started_at: number
  completed_at: number | null
  status: string
  diff_summary: string | null
}

/** SQLite row shape for the `session_events` table. */
export interface SessionEventRow extends Record<string, SqlStorageValue> {
  sequence: number
  type: string
  payload: string
  occurred_at: number
}

/** Dependencies required by session turn / event store helpers. */
export interface SessionTurnStoreHost {
  readonly sql: SqlStorage
}

/**
 * Record the start of a chat turn.
 *
 * @param sessionId - Owning chat session id
 * @param turnId - Stable turn id for this prompt/response cycle
 */
export function createTurn(host: SessionTurnStoreHost, sessionId: string, turnId: string): TurnRow {
  const startedAt = Math.floor(Date.now() / 1000)
  host.sql.exec(
    `INSERT INTO turns (id, session_id, started_at, status)
     VALUES (?, ?, ?, 'running')`,
    turnId,
    sessionId,
    startedAt,
  )
  return {
    id: turnId,
    session_id: sessionId,
    started_at: startedAt,
    completed_at: null,
    status: 'running',
    diff_summary: null,
  }
}

/**
 * Mark a turn finished with lifecycle status and optional diff summary JSON.
 *
 * @param diffSummaryJson - JSON array of {@link TurnDiffSummary} entries
 */
export function completeTurn(
  host: SessionTurnStoreHost,
  turnId: string,
  status: TurnStatus,
  diffSummaryJson?: string,
): void {
  const completedAt = Math.floor(Date.now() / 1000)
  host.sql.exec(
    `UPDATE turns SET status = ?, completed_at = ?, diff_summary = ? WHERE id = ?`,
    status,
    completedAt,
    diffSummaryJson ?? null,
    turnId,
  )
}

/** Load turns for a session, newest first. */
export function getTurns(host: SessionTurnStoreHost, sessionId: string, limit = 50): Turn[] {
  const rows = host.sql
    .exec<TurnRow>(
      `SELECT id, session_id, started_at, completed_at, status, diff_summary
       FROM turns
       WHERE session_id = ?
       ORDER BY started_at DESC
       LIMIT ?`,
      sessionId,
      limit,
    )
    .toArray()

  return rows.map(mapTurnRow)
}

/** Append an append-only session event row. */
export function appendSessionEvent(host: SessionTurnStoreHost, type: string, payloadJson: string): SessionEventRow {
  const occurredAt = Math.floor(Date.now() / 1000)
  host.sql.exec(
    `INSERT INTO session_events (type, payload, occurred_at) VALUES (?, ?, ?)`,
    type,
    payloadJson,
    occurredAt,
  )
  const row = host.sql
    .exec<SessionEventRow>(
      `SELECT sequence, type, payload, occurred_at
       FROM session_events
       ORDER BY sequence DESC
       LIMIT 1`,
    )
    .one()
  return row ?? { sequence: 0, type, payload: payloadJson, occurred_at: occurredAt }
}

/** Recent session events in chronological order. */
export function getRecentEvents(host: SessionTurnStoreHost, limit = 100): SessionEventRow[] {
  const rows = host.sql
    .exec<SessionEventRow>(
      `SELECT sequence, type, payload, occurred_at
       FROM session_events
       ORDER BY sequence DESC
       LIMIT ?`,
      limit,
    )
    .toArray()
  return rows.reverse()
}

function mapTurnRow(row: TurnRow): Turn {
  let diffSummary: TurnDiffSummary[] | undefined
  if (row.diff_summary) {
    try {
      const parsed = JSON.parse(row.diff_summary) as TurnDiffSummary[]
      if (Array.isArray(parsed)) diffSummary = parsed
    } catch {
      diffSummary = undefined
    }
  }

  return {
    id: row.id as Turn['id'],
    sessionID: row.session_id,
    status: row.status as TurnStatus,
    startedAt: row.started_at,
    ...(row.completed_at != null ? { completedAt: row.completed_at } : {}),
    ...(diffSummary ? { diffSummary } : {}),
  }
}
