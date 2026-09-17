/**
 * Ordered SessionDO event persistence, materialization, replay, and compaction.
 *
 * @packageDocumentation
 */

import {
  SessionEventRecordSchema,
  type SessionEventRecord,
  type SessionProducerEvent,
  type SessionRealtimeEvent,
  type SessionStreamFrame,
} from '@ship/contracts'

import type { ConnectionState } from './session-types'
import { firstSqlRow } from './sql-first'

interface EventRow extends Record<string, SqlStorageValue> {
  sequence: number
  event_id: string
  turn_id: string | null
  payload: string
  occurred_at: number
}

/** Minimal SessionDO surface needed by the event log. */
export interface SessionEventStoreHost {
  readonly sql: SqlStorage
  getWebSockets(tag?: string): WebSocket[]
}

/** Return the current monotonically increasing event head. */
export function getSessionEventHead(host: SessionEventStoreHost): number {
  return host.sql.exec<{ value: number }>('SELECT COALESCE(MAX(sequence), 0) AS value FROM session_events').one().value
}

/** Return the earliest retained sequence, or zero for an empty log. */
export function getMinimumSessionSequence(host: SessionEventStoreHost): number {
  return host.sql.exec<{ value: number }>('SELECT COALESCE(MIN(sequence), 0) AS value FROM session_events').one().value
}

/** Load canonical records after a consumer cursor. */
export function getSessionEventsAfter(
  host: SessionEventStoreHost,
  afterSequence: number,
  limit = 2_000,
): SessionEventRecord[] {
  return host.sql
    .exec<EventRow>(
      `SELECT sequence, event_id, turn_id, payload, occurred_at
       FROM session_events WHERE sequence > ? AND event_id IS NOT NULL
       ORDER BY sequence LIMIT ?`,
      afterSequence,
      limit,
    )
    .toArray()
    .flatMap(parseEventRow)
}

/** Persist one producer event idempotently and assign its canonical sequence. */
export function appendRealtimeEvent(
  host: SessionEventStoreHost,
  producer: SessionProducerEvent,
): SessionEventRecord {
  const existing = firstSqlRow(
    host.sql.exec<EventRow>(
      `SELECT sequence, event_id, turn_id, payload, occurred_at
       FROM session_events WHERE event_id = ?`,
      producer.eventId,
    ),
  )
  if (existing) return parseEventRow(existing)[0]

  const event = materializeToolOutput(host, producer.turnId, producer.event)
  host.sql.exec(
    `INSERT INTO session_events (event_id, turn_id, type, payload, occurred_at)
     VALUES (?, ?, ?, ?, ?)`,
    producer.eventId,
    producer.turnId ?? null,
    event.type,
    JSON.stringify(event),
    producer.occurredAt,
  )
  const sequence = getSessionEventHead(host)
  const record = SessionEventRecordSchema.parse({
    eventId: producer.eventId,
    sequence,
    turnId: producer.turnId ?? null,
    occurredAt: producer.occurredAt,
    event,
  })
  updateLiveTurnState(host, record)
  return record
}

/** Broadcast an already-persisted record batch to synchronized v2 consumers. */
export function broadcastSessionRecords(host: SessionEventStoreHost, records: SessionEventRecord[]): void {
  if (records.length === 0) return
  const frame = JSON.stringify({ type: 'session.events', records } satisfies SessionStreamFrame)
  const sequence = records.at(-1)?.sequence ?? 0
  for (const ws of host.getWebSockets('consumer')) {
    const state = ws.deserializeAttachment() as ConnectionState | null
    if (!state || state.protocolVersion !== 2 || state.phase !== 'live' || sequence <= state.lastSentSequence) continue
    ws.send(frame)
    state.lastSentSequence = sequence
    ws.serializeAttachment(state)
  }
}

/** Remove redundant settled-turn deltas while retaining semantic records and sequence gaps. */
export function compactSettledTurn(host: SessionEventStoreHost, turnId: string): void {
  const redundant = host.sql
    .exec<{ sequence: number; payload: string }>(
      `SELECT sequence, payload FROM session_events
       WHERE turn_id = ? AND type = 'message.part.updated' ORDER BY sequence`,
      turnId,
    )
    .toArray()
    .filter((row) => {
      const event = JSON.parse(row.payload) as SessionRealtimeEvent
      const partType = event.type === 'message.part.updated' ? event.properties.part.type : ''
      return partType === 'text' || partType === 'reasoning'
    })
  if (redundant.length > 0) {
    const maximum = redundant.at(-1)?.sequence ?? 0
    host.sql.exec(
      `DELETE FROM session_events WHERE turn_id = ? AND type = 'message.part.updated'
       AND sequence <= ?`,
      turnId,
      maximum,
    )
    setCompactedThrough(host, maximum)
  }
  pruneSessionEvents(host)
}

/** Highest sequence whose deletion requires a snapshot instead of replay. */
export function getCompactedThrough(host: SessionEventStoreHost): number {
  const row = firstSqlRow(
    host.sql.exec<{ value: string }>("SELECT value FROM session_meta WHERE key = 'compacted_through'"),
  )
  return Number(row?.value || 0)
}

/** Return a separately stored full tool output. */
export function getToolOutput(host: SessionEventStoreHost, toolCallId: string): string | null {
  return firstSqlRow(
    host.sql.exec<{ output: string }>('SELECT output FROM tool_outputs WHERE tool_call_id = ?', toolCallId),
  )?.output ?? null
}

function parseEventRow(row: EventRow): SessionEventRecord[] {
  const parsed = SessionEventRecordSchema.safeParse({
    eventId: row.event_id,
    sequence: row.sequence,
    turnId: row.turn_id,
    occurredAt: row.occurred_at,
    event: JSON.parse(row.payload),
  })
  return parsed.success ? [parsed.data] : []
}

function materializeToolOutput(
  host: SessionEventStoreHost,
  turnId: string | undefined,
  event: SessionRealtimeEvent,
): SessionRealtimeEvent {
  if (event.type !== 'message.part.updated' || event.properties.part.type !== 'tool') return event
  const part = event.properties.part
  const output = part.state.output
  if (!output || output.length <= 10_240) return event
  const preview = `${output.slice(0, 8_192)}\n… output truncated …\n${output.slice(-2_048)}`
  host.sql.exec(
    `INSERT INTO tool_outputs (tool_call_id, turn_id, output, created_at) VALUES (?, ?, ?, ?)
     ON CONFLICT(tool_call_id) DO UPDATE SET output = excluded.output`,
    part.callID,
    turnId ?? null,
    output,
    Date.now(),
  )
  return {
    ...event,
    properties: {
      ...event.properties,
      part: {
        ...part,
        state: {
          ...part.state,
          output: preview,
          outputPreview: preview,
          outputTruncated: true,
          detailRef: part.callID,
        },
      },
    },
  }
}

function updateLiveTurnState(host: SessionEventStoreHost, record: SessionEventRecord): void {
  const { event, turnId } = record
  if (!turnId || event.type !== 'message.part.updated') return
  const part = event.properties.part
  const current = firstSqlRow(
    host.sql.exec<{ message_id: string; text: string; parts: string }>(
      'SELECT message_id, text, parts FROM live_turn_state WHERE turn_id = ?',
      turnId,
    ),
  )
  const messageId = part.messageID
  let text = current?.text ?? ''
  let parts = current ? JSON.parse(current.parts) as Array<Record<string, unknown>> : []
  if (part.type === 'text') text = event.properties.delta ? `${text}${event.properties.delta}` : part.text
  else {
    const index = parts.findIndex((candidate) => candidate.id === part.id)
    if (index >= 0) {
      parts = parts.slice()
      parts[index] = part
    }
    else parts = [...parts, part]
  }
  host.sql.exec(
    `INSERT INTO live_turn_state (turn_id, message_id, text, parts, updated_at) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(turn_id) DO UPDATE SET message_id = excluded.message_id, text = excluded.text,
       parts = excluded.parts, updated_at = excluded.updated_at`,
    turnId,
    messageId,
    text,
    JSON.stringify(parts),
    record.occurredAt,
  )
}

function setCompactedThrough(host: SessionEventStoreHost, sequence: number): void {
  const current = getCompactedThrough(host)
  if (sequence <= current) return
  host.sql.exec(`INSERT INTO session_meta (key, value) VALUES ('compacted_through', ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value`, String(sequence))
}

function pruneSessionEvents(host: SessionEventStoreHost): void {
  const count = host.sql.exec<{ value: number }>('SELECT COUNT(*) AS value FROM session_events').one().value
  if (count <= 5_000) return
  const boundary = firstSqlRow(
    host.sql.exec<{ sequence: number }>('SELECT sequence FROM session_events ORDER BY sequence DESC LIMIT 1 OFFSET 4000'),
  )?.sequence
  if (!boundary) return
  host.sql.exec('DELETE FROM session_events WHERE sequence <= ?', boundary)
  setCompactedThrough(host, boundary)
}
