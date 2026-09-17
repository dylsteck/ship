/** Sequence-aware SessionDO consumer synchronization. */

import type { SessionSubscribeCommand, SessionStreamFrame } from '@ship/contracts'

import {
  getCompactedThrough,
  getMinimumSessionSequence,
  getSessionEventHead,
  getSessionEventsAfter,
  type SessionEventStoreHost,
} from './session-event-store'
import { buildSessionDetailSnapshot } from './session-snapshot'
import { firstSqlRow } from './sql-first'
import type { ConnectionState, SessionMetaRow } from './session-types'

const REPLAY_LIMIT = 2_000

/** Synchronize one consumer from a replay cursor or a safe snapshot fallback. */
export function synchronizeSessionConsumer(
  host: SessionEventStoreHost,
  ws: WebSocket,
  command: SessionSubscribeCommand,
): void {
  const state = ws.deserializeAttachment() as ConnectionState
  state.phase = 'synchronizing'
  ws.serializeAttachment(state)

  const head = getSessionEventHead(host)
  const minimum = getMinimumSessionSequence(host)
  const compactedThrough = getCompactedThrough(host)
  const cursor = command.afterSequence
  const snapshotReason = cursor === undefined
    ? 'initial'
    : cursor > head
      ? 'cursor-ahead'
      : cursor <= compactedThrough
        ? 'compacted'
        : (minimum > 0 && cursor < minimum - 1) || head - cursor > REPLAY_LIMIT || hasLegacyGap(host, cursor)
          ? 'gap'
          : null

  if (snapshotReason) {
    const snapshot = buildSessionDetailSnapshot(host, readMeta(host), command.turnLimit ?? 10)
    ws.send(JSON.stringify({ type: 'session.snapshot', snapshot, reason: snapshotReason } satisfies SessionStreamFrame))
  } else {
    const records = getSessionEventsAfter(host, cursor ?? 0, REPLAY_LIMIT)
    if (records.length > 0) ws.send(JSON.stringify({ type: 'session.events', records } satisfies SessionStreamFrame))
  }
  ws.send(JSON.stringify({ type: 'session.synchronized', sequence: head } satisfies SessionStreamFrame))
  state.lastSentSequence = head
  state.phase = 'live'
  ws.serializeAttachment(state)
}

function readMeta(host: SessionEventStoreHost): Record<string, string> {
  return Object.fromEntries(
    host.sql.exec<SessionMetaRow>('SELECT key, value FROM session_meta').toArray().map((row) => [row.key, row.value]),
  )
}

function hasLegacyGap(host: SessionEventStoreHost, cursor: number): boolean {
  return Boolean(
    firstSqlRow(
      host.sql.exec<{ sequence: number }>(
        'SELECT sequence FROM session_events WHERE sequence > ? AND event_id IS NULL LIMIT 1',
        cursor,
      ),
    ),
  )
}
