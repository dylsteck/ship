/**
 * Atomic turn acceptance, execution leases, stop state, and terminal transitions.
 *
 * @packageDocumentation
 */

import type {
  CreateTurnRequest,
  SessionProducerEvent,
  SessionRuntime,
  TurnAcceptedResponse,
  TurnStatus,
  MessageId,
  SessionId,
  TurnId,
} from '@ship/contracts'

import type { Env } from '../env.d'
import { acpBackendFromModelId } from '../lib/acp-types'
import {
  appendRealtimeEvent,
  broadcastSessionRecords,
  compactSettledTurn,
  getSessionEventHead,
  type SessionEventStoreHost,
} from './session-event-store'
import { firstSqlRow } from './sql-first'

interface AcceptedTurnRow extends Record<string, SqlStorageValue> {
  id: string
  client_command_id: string
  status: string
  model_id: string | null
  mode: string
  prompt_sent: number
  attempt_id: string | null
  execution_state: string
}

/** Host capabilities used by turn command helpers. */
export interface SessionTurnCommandHost extends SessionEventStoreHost {
  getEnv(): Env
  setSessionMeta(key: string, value: string): Promise<void>
  scheduleTurnAlarm(timestamp: number): Promise<void>
}

/** Result of atomically accepting or rejecting a turn command. */
export type BeginTurnResult =
  | { ok: true; response: TurnAcceptedResponse }
  | { ok: false; code: 'session_busy'; activeTurnId: string }

/** Persisted execution data read by the Workflow rather than copied into its payload. */
export interface TurnExecutionData {
  sessionId: string
  turnId: string
  userMessageId: string
  content: string
  mode: 'agent' | 'plan'
  modelId?: string
  status: string
  promptSent: boolean
  stopRequested: boolean
}

/** Atomically accept a client command, create its user message, and start its sequence. */
export async function beginTurn(
  host: SessionTurnCommandHost,
  sessionId: string,
  command: CreateTurnRequest,
): Promise<BeginTurnResult> {
  const duplicate = firstSqlRow(
    host.sql.exec<AcceptedTurnRow>('SELECT * FROM turns WHERE client_command_id = ?', command.clientCommandId),
  )
  if (duplicate) return existingAcceptedResponse(host, sessionId, duplicate)

  const active = firstSqlRow(
    host.sql.exec<{ id: string }>(
      `SELECT id FROM turns WHERE status = 'running'
       AND execution_state IN ('accepted', 'preparing', 'executing', 'stopping') LIMIT 1`,
    ),
  )
  if (active) return { ok: false, code: 'session_busy', activeTurnId: active.id }

  const turnId = crypto.randomUUID()
  const userMessageId = crypto.randomUUID()
  const startedAt = Math.floor(Date.now() / 1000)
  const modelId = command.modelId || readMeta(host, 'model') || undefined
  host.sql.exec(
    `INSERT INTO turns
     (id, session_id, client_command_id, mode, model_id, started_at, status, execution_state, heartbeat_at)
     VALUES (?, ?, ?, ?, ?, ?, 'running', 'accepted', ?)`,
    turnId,
    sessionId,
    command.clientCommandId,
    command.mode,
    modelId ?? null,
    startedAt,
    Date.now(),
  )
  host.sql.exec(
    `INSERT INTO messages (id, turn_id, role, content, parts, created_at) VALUES (?, ?, 'user', ?, NULL, ?)`,
    userMessageId,
    turnId,
    command.content,
    startedAt,
  )
  if (modelId) applyModelSelection(host, modelId)

  const message = {
    id: userMessageId as MessageId,
    turnId: turnId as TurnId,
    role: 'user' as const,
    content: command.content,
    createdAt: startedAt,
  }
  const records = [
    appendCoreEvent(host, `${turnId}:message.created`, turnId, { type: 'message.created', properties: { message } }),
    appendCoreEvent(host, `${turnId}:turn.started`, turnId, {
      type: 'turn.started',
      properties: { sessionId: sessionId as SessionId, turnId: turnId as TurnId },
    }),
    appendRuntimeEvent(host, sessionId, turnId, { state: 'starting', latestTurnId: turnId as TurnId }),
  ]
  broadcastSessionRecords(host, records)
  const acceptedSequence = records[1].sequence

  await host.getEnv().DB.prepare(
    `INSERT OR IGNORE INTO chat_messages (id, session_id, turn_id, role, content, parts, created_at)
     VALUES (?, ?, ?, 'user', ?, NULL, ?)`,
  )
    .bind(userMessageId, sessionId, turnId, command.content, startedAt)
    .run()
  const now = Math.floor(Date.now() / 1000)
  await host.getEnv().DB.prepare(
    `UPDATE chat_sessions SET last_activity = ?, revision = revision + 1,
      model = COALESCE(?, model), agent_type = COALESCE(?, agent_type) WHERE id = ?`,
  )
    .bind(now, modelId ?? null, modelId ? acpBackendFromModelId(modelId) : null, sessionId)
    .run()
  await host.scheduleTurnAlarm(Date.now() + 90_000)

  return {
    ok: true,
    response: {
      sessionId,
      turnId,
      userMessageId,
      acceptedSequence,
      status: 'accepted',
    },
  }
}

/** Claim an accepted turn for one Workflow attempt without repeating a sent prompt. */
export function claimTurn(
  host: SessionTurnCommandHost,
  turnId: string,
  workflowInstanceId: string,
  attemptId: string,
): { claimed: boolean; terminal: boolean; promptSent: boolean } {
  const row = firstSqlRow(host.sql.exec<AcceptedTurnRow>('SELECT * FROM turns WHERE id = ?', turnId))
  if (!row) throw new Error('Turn not found')
  const terminal = ['completed', 'failed', 'interrupted', 'cancelled'].includes(row.status)
  if (terminal) return { claimed: false, terminal: true, promptSent: row.prompt_sent === 1 }
  if (row.prompt_sent === 1 && row.attempt_id && row.attempt_id !== attemptId) {
    return { claimed: false, terminal: false, promptSent: true }
  }
  host.sql.exec(
    `UPDATE turns SET workflow_instance_id = ?, attempt_id = ?, execution_state = 'preparing', heartbeat_at = ?
     WHERE id = ?`,
    workflowInstanceId,
    attemptId,
    Date.now(),
    turnId,
  )
  return { claimed: true, terminal: false, promptSent: row.prompt_sent === 1 }
}

/** Set the at-most-once fence immediately before the ACP prompt request. */
export function markPromptSent(host: SessionTurnCommandHost, turnId: string, attemptId: string): boolean {
  const row = firstSqlRow(
    host.sql.exec<{ attempt_id: string | null; prompt_sent: number }>(
      'SELECT attempt_id, prompt_sent FROM turns WHERE id = ?',
      turnId,
    ),
  )
  if (!row || row.attempt_id !== attemptId || row.prompt_sent === 1) return false
  host.sql.exec(
    `UPDATE turns SET prompt_sent = 1, execution_state = 'executing', heartbeat_at = ? WHERE id = ?`,
    Date.now(),
    turnId,
  )
  return true
}

/** Refresh a running turn's execution lease. */
export async function heartbeatTurn(host: SessionTurnCommandHost, turnId: string, attemptId: string): Promise<boolean> {
  const row = firstSqlRow(
    host.sql.exec<{ attempt_id: string | null; status: string }>(
      'SELECT attempt_id, status FROM turns WHERE id = ?',
      turnId,
    ),
  )
  if (!row || row.attempt_id !== attemptId || row.status !== 'running') return false
  host.sql.exec('UPDATE turns SET heartbeat_at = ? WHERE id = ?', Date.now(), turnId)
  await host.scheduleTurnAlarm(Date.now() + 90_000)
  return true
}

/** Return the accepted prompt and execution flags for the Workflow. */
export function getTurnExecutionData(host: SessionTurnCommandHost, turnId: string): TurnExecutionData | null {
  const row = firstSqlRow(host.sql.exec<AcceptedTurnRow>('SELECT * FROM turns WHERE id = ?', turnId))
  if (!row) return null
  const message = firstSqlRow(
    host.sql.exec<{ id: string; content: string }>(
      `SELECT id, content FROM messages WHERE turn_id = ? AND role = 'user' ORDER BY created_at, id LIMIT 1`,
      turnId,
    ),
  )
  if (!message) return null
  return {
    sessionId: readMeta(host, 'session_id') || '',
    turnId,
    userMessageId: message.id,
    content: message.content,
    mode: row.mode === 'plan' ? 'plan' : 'agent',
    ...(row.model_id ? { modelId: row.model_id } : {}),
    status: row.status,
    promptSent: row.prompt_sent === 1,
    stopRequested: Boolean(
      firstSqlRow(
        host.sql.exec<{ value: number }>('SELECT stop_requested AS value FROM turns WHERE id = ?', turnId),
      )?.value,
    ),
  }
}

/** Request cooperative cancellation exactly once. */
export function requestTurnStop(host: SessionTurnCommandHost, turnId: string): boolean {
  const row = firstSqlRow(host.sql.exec<{ status: string }>('SELECT status FROM turns WHERE id = ?', turnId))
  if (!row || row.status !== 'running') return false
  host.sql.exec("UPDATE turns SET stop_requested = 1, execution_state = 'stopping' WHERE id = ?", turnId)
  host.sql.exec(`INSERT INTO session_meta (key, value) VALUES ('agent_should_stop', 'true')
    ON CONFLICT(key) DO UPDATE SET value = excluded.value`)
  return true
}

/** Persist one terminal transition idempotently and compact redundant deltas. */
export async function finalizeAcceptedTurn(
  host: SessionTurnCommandHost,
  sessionId: string,
  turnId: string,
  status: Extract<TurnStatus, 'completed' | 'failed' | 'interrupted'>,
  error?: string,
  diffSummary?: Array<{ filename: string; additions: number; deletions: number }>,
): Promise<boolean> {
  const row = firstSqlRow(host.sql.exec<{ status: string }>('SELECT status FROM turns WHERE id = ?', turnId))
  if (!row || row.status !== 'running') return false
  const completedAt = Math.floor(Date.now() / 1000)
  host.sql.exec(
    `UPDATE turns SET status = ?, completed_at = ?, execution_state = ?, heartbeat_at = ?, diff_summary = ? WHERE id = ?`,
    status,
    completedAt,
    status,
    Date.now(),
    diffSummary?.length ? JSON.stringify(diffSummary) : null,
    turnId,
  )
  host.sql.exec('DELETE FROM live_turn_state WHERE turn_id = ?', turnId)
  const eventType = status === 'completed' ? 'turn.completed' : status === 'failed' ? 'turn.failed' : 'turn.interrupted'
  const lifecycle = appendCoreEvent(host, `${turnId}:${eventType}`, turnId, {
    type: eventType,
    properties: {
      sessionId: sessionId as SessionId,
      turnId: turnId as TurnId,
      status,
      ...(error ? { error } : {}),
    },
  })
  const runtime = appendRuntimeEvent(host, sessionId, turnId, {
    state: status === 'failed' ? 'failed' : 'idle',
    latestTurnId: turnId as TurnId,
  })
  broadcastSessionRecords(host, [lifecycle, runtime])
  compactSettledTurn(host, turnId)
  await host.getEnv().DB.prepare('UPDATE chat_sessions SET last_activity = ?, revision = revision + 1 WHERE id = ?')
    .bind(completedAt, sessionId)
    .run()
  return true
}

/** Identify turns whose execution lease has exceeded the recovery threshold. */
export function staleRunningTurns(host: SessionTurnCommandHost, olderThan: number): Array<{ id: string; promptSent: boolean }> {
  return host.sql
    .exec<{ id: string; prompt_sent: number }>(
      `SELECT id, prompt_sent FROM turns WHERE status = 'running' AND heartbeat_at < ?`,
      olderThan,
    )
    .toArray()
    .map((row) => ({ id: row.id, promptSent: row.prompt_sent === 1 }))
}

function existingAcceptedResponse(
  host: SessionTurnCommandHost,
  sessionId: string,
  row: AcceptedTurnRow,
): BeginTurnResult {
  const message = firstSqlRow(
    host.sql.exec<{ id: string }>("SELECT id FROM messages WHERE turn_id = ? AND role = 'user' LIMIT 1", row.id),
  )
  const started = firstSqlRow(
    host.sql.exec<{ sequence: number }>(
      "SELECT sequence FROM session_events WHERE turn_id = ? AND type = 'turn.started' LIMIT 1",
      row.id,
    ),
  )
  if (!message) throw new Error('Accepted turn is missing its user message')
  return {
    ok: true,
    response: {
      sessionId,
      turnId: row.id,
      userMessageId: message.id,
      acceptedSequence: started?.sequence ?? getSessionEventHead(host),
      status: 'already-accepted',
    },
  }
}

function appendCoreEvent(
  host: SessionTurnCommandHost,
  eventId: string,
  turnId: string,
  event: SessionProducerEvent['event'],
) {
  return appendRealtimeEvent(host, { eventId, turnId: turnId as TurnId, occurredAt: Date.now(), event })
}

function appendRuntimeEvent(
  host: SessionTurnCommandHost,
  sessionId: string,
  turnId: string,
  runtime: SessionRuntime,
) {
  host.sql.exec(`INSERT INTO session_meta (key, value) VALUES ('runtime_state', ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value`, runtime.state)
  return appendCoreEvent(host, `${turnId}:runtime:${runtime.state}`, turnId, {
    type: 'session.runtime.updated',
    properties: { sessionId: sessionId as SessionId, runtime },
  })
}

function readMeta(host: SessionTurnCommandHost, key: string): string | null {
  return firstSqlRow(host.sql.exec<{ value: string }>('SELECT value FROM session_meta WHERE key = ?', key))?.value ?? null
}

function applyModelSelection(host: SessionTurnCommandHost, modelId: string): void {
  const previous = readMeta(host, 'model')
  const backend = acpBackendFromModelId(modelId)
  host.sql.exec(`INSERT INTO session_meta (key, value) VALUES ('model', ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value`, modelId)
  host.sql.exec(`INSERT INTO session_meta (key, value) VALUES ('acp_backend_kind', ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value`, backend)
  if (previous && previous !== modelId) {
    for (const key of ['acp_protocol_session_id', 'acp_protocol_session_backend', 'acp_protocol_session_cwd']) {
      host.sql.exec(`INSERT INTO session_meta (key, value) VALUES (?, '')
        ON CONFLICT(key) DO UPDATE SET value = excluded.value`, key)
    }
  }
}
