/**
 * Session detail snapshots and stable user-anchored transcript pagination.
 *
 * @packageDocumentation
 */

import {
  MessagePartSchema,
  SessionDetailSnapshotSchema,
  TranscriptPageSchema,
  type RealtimeMessage,
  type SessionDetailSnapshot,
  type ShellSessionSummary,
  type TranscriptPage,
  type Turn,
} from '@ship/contracts'

import { DEFAULT_ACP_MODEL_ID } from '../lib/agent-registry'
import { acpBackendFromModelId } from '../lib/acp-types'
import { getSessionEventHead, type SessionEventStoreHost } from './session-event-store'
import { firstSqlRow } from './sql-first'

interface SnapshotMessageRow extends Record<string, SqlStorageValue> {
  id: string
  turn_id: string | null
  role: string
  content: string
  parts: string | null
  created_at: number
}

interface SnapshotTurnRow extends Record<string, SqlStorageValue> {
  id: string
  session_id: string
  started_at: number
  completed_at: number | null
  status: string
  diff_summary: string | null
}

interface TranscriptTurn {
  turn: Turn
  messages: RealtimeMessage[]
  startedAt: number
}

/** Build the latest bounded detail snapshot for a newly synchronized consumer. */
export function buildSessionDetailSnapshot(
  host: SessionEventStoreHost,
  meta: Record<string, string>,
  turnLimit = 10,
): SessionDetailSnapshot {
  const page = buildTranscriptPage(host, meta['session_id'] || meta['sessionId'] || '', undefined, turnLimit)
  const turns = Object.fromEntries(page.turns.map((turn) => [turn.id, turn]))
  const messages = Object.fromEntries(page.messages.map((message) => [message.id, message]))
  const tasks = Object.fromEntries(loadTasks(host).map((task) => [task.id, task]))
  const liveTurn = loadLiveTurn(host)
  return SessionDetailSnapshotSchema.parse({
    sessionId: meta['session_id'] || meta['sessionId'],
    snapshotSequence: page.snapshotSequence,
    summary: summaryFromMeta(host, meta),
    turns,
    messages,
    orderedTurnIds: page.turns.map((turn) => turn.id),
    orderedMessageIds: page.messages.map((message) => message.id),
    tasks,
    ...(liveTurn ? { liveTurn } : {}),
    ...(page.beforeCursor ? { beforeCursor: page.beforeCursor } : {}),
    hasMore: page.hasMore,
  })
}

/** Build a deterministic older-turn page using an opaque tuple cursor. */
export function buildTranscriptPage(
  host: SessionEventStoreHost,
  sessionId: string,
  before?: string,
  limit = 20,
): TranscriptPage {
  const boundedLimit = Math.max(1, Math.min(50, limit))
  const all = deriveTranscript(host, sessionId)
  const cursor = before ? decodeCursor(before) : null
  const eligible = cursor
    ? all.filter((entry) => entry.startedAt < cursor.startedAt || (entry.startedAt === cursor.startedAt && entry.turn.id < cursor.id))
    : all
  const pageTurns = eligible.slice(-boundedLimit)
  const first = pageTurns[0]
  const hasMore = Boolean(first && all.some((entry) => compareTurn(entry, first) < 0))
  return TranscriptPageSchema.parse({
    turns: pageTurns.map((entry) => entry.turn),
    messages: pageTurns.flatMap((entry) => entry.messages),
    ...(hasMore && first ? { beforeCursor: encodeCursor(first.startedAt, first.turn.id) } : {}),
    hasMore,
    snapshotSequence: getSessionEventHead(host),
  })
}

function deriveTranscript(host: SessionEventStoreHost, sessionId: string): TranscriptTurn[] {
  const turnRows = host.sql
    .exec<SnapshotTurnRow>(
      `SELECT id, session_id, started_at, completed_at, status, diff_summary
       FROM turns WHERE session_id = ? ORDER BY started_at, id LIMIT 5000`,
      sessionId,
    )
    .toArray()
  const messages = host.sql
    .exec<SnapshotMessageRow>(
      `SELECT id, turn_id, role, content, parts, created_at
       FROM messages ORDER BY created_at, id LIMIT 10000`,
    )
    .toArray()
  const turnMap = new Map<string, TranscriptTurn>()
  for (const row of turnRows) turnMap.set(row.id, { turn: mapTurn(row), messages: [], startedAt: row.started_at })

  let legacyTurnId: string | null = null
  for (const row of messages) {
    if (!row.turn_id && row.role === 'user') legacyTurnId = `legacy:${row.id}`
    const turnId = row.turn_id || legacyTurnId
    if (!turnId) continue
    let entry = turnMap.get(turnId)
    if (!entry) {
      entry = {
        turn: {
          id: turnId,
          sessionID: sessionId,
          status: 'completed',
          startedAt: row.created_at,
          completedAt: row.created_at,
        },
        messages: [],
        startedAt: row.created_at,
      }
      turnMap.set(turnId, entry)
    }
    entry.messages.push(mapMessage(row, turnId))
  }
  return [...turnMap.values()].sort(compareTurn)
}

function mapTurn(row: SnapshotTurnRow): Turn {
  let diffSummary: Turn['diffSummary']
  if (row.diff_summary) {
    try {
      const value = JSON.parse(row.diff_summary)
      if (Array.isArray(value)) diffSummary = value
    } catch {
      diffSummary = undefined
    }
  }
  return {
    id: row.id,
    sessionID: row.session_id,
    status: row.status as Turn['status'],
    startedAt: row.started_at,
    ...(row.completed_at != null ? { completedAt: row.completed_at } : {}),
    ...(diffSummary ? { diffSummary } : {}),
  }
}

function mapMessage(row: SnapshotMessageRow, turnId: string): RealtimeMessage {
  return {
    id: row.id as RealtimeMessage['id'],
    turnId: turnId as RealtimeMessage['turnId'],
    role: row.role as RealtimeMessage['role'],
    content: row.content,
    ...(row.parts ? { parts: parseParts(row.parts) } : {}),
    createdAt: row.created_at,
  }
}

function parseParts(raw: string) {
  try {
    const value = JSON.parse(raw)
    if (!Array.isArray(value)) return []
    return value.flatMap((part) => {
      const parsed = MessagePartSchema.safeParse(part)
      return parsed.success ? [parsed.data] : []
    })
  } catch {
    return []
  }
}

function loadTasks(host: SessionEventStoreHost) {
  return host.sql.exec<{
    id: string
    title: string
    description: string | null
    status: string
    mode: string
    created_at: number
    completed_at: number | null
  }>('SELECT id, title, description, status, mode, created_at, completed_at FROM tasks ORDER BY created_at').toArray().map((row) => ({
    id: row.id,
    title: row.title,
    ...(row.description ? { description: row.description } : {}),
    status: row.status,
    mode: row.mode,
    createdAt: row.created_at,
    ...(row.completed_at != null ? { completedAt: row.completed_at } : {}),
  }))
}

function loadLiveTurn(host: SessionEventStoreHost) {
  const row = firstSqlRow(
    host.sql.exec<{
      turn_id: string
      message_id: string
      text: string
      parts: string
      updated_at: number
    }>('SELECT turn_id, message_id, text, parts, updated_at FROM live_turn_state LIMIT 1'),
  )
  if (!row) return null
  return {
    turnId: row.turn_id,
    messageId: row.message_id,
    text: row.text,
    parts: parseParts(row.parts),
    updatedAt: row.updated_at,
  }
}

function summaryFromMeta(host: SessionEventStoreHost, meta: Record<string, string>): ShellSessionSummary {
  if (meta['shell_summary']) {
    try {
      return JSON.parse(meta['shell_summary']) as ShellSessionSummary
    } catch {
      // Fall through to the local projection.
    }
  }
  const sessionId = meta['session_id'] || meta['sessionId'] || ''
  const modelId = meta['model'] || DEFAULT_ACP_MODEL_ID
  const active = firstSqlRow(
    host.sql.exec<{ id: string }>("SELECT id FROM turns WHERE status = 'running' LIMIT 1"),
  )
  const runtimeState = meta['runtime_state'] || (active ? 'running' : 'idle')
  return {
    id: sessionId as ShellSessionSummary['id'],
    repoOwner: meta['repoOwner'] || meta['repo_owner'] || '',
    repoName: meta['repoName'] || meta['repo_name'] || '',
    title: meta['title'] || 'Untitled session',
    status: meta['status'] || 'active',
    createdAt: Number(meta['createdAt'] || meta['created_at'] || 0),
    lastActivity: Number(meta['last_activity'] || meta['createdAt'] || 0),
    archivedAt: null,
    revision: Math.max(1, Number(meta['revision'] || 1)),
    agentId: meta['agent_type'] || acpBackendFromModelId(modelId),
    modelId,
    runtime: {
      state: runtimeState as ShellSessionSummary['runtime']['state'],
      ...(active ? { latestTurnId: active.id as ShellSessionSummary['runtime']['latestTurnId'] } : {}),
    },
    diffStats: { additions: 0, deletions: 0, files: 0 },
    ...(meta['pr_url'] ? { pullRequestUrl: meta['pr_url'] } : {}),
  }
}

function compareTurn(a: TranscriptTurn, b: TranscriptTurn): number {
  return a.startedAt - b.startedAt || String(a.turn.id).localeCompare(String(b.turn.id))
}

function encodeCursor(startedAt: number, id: string): string {
  return btoa(JSON.stringify({ startedAt, id })).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')
}

function decodeCursor(value: string): { startedAt: number; id: string } | null {
  try {
    const padded = value.replaceAll('-', '+').replaceAll('_', '/').padEnd(Math.ceil(value.length / 4) * 4, '=')
    const parsed = JSON.parse(atob(padded)) as { startedAt?: unknown; id?: unknown }
    return typeof parsed.startedAt === 'number' && typeof parsed.id === 'string'
      ? { startedAt: parsed.startedAt, id: parsed.id }
      : null
  } catch {
    return null
  }
}
