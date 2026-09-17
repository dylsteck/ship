/** Pure normalized session snapshot/event reduction. */

import {
  type MessagePart,
  type RealtimeMessage,
  type RealtimeTask,
  type SessionDetailSnapshot,
  type SessionEventRecord,
  type SessionStreamFrame,
  type ShellSessionSummary,
  type TranscriptPage,
  type Turn,
  type TurnStatus,
} from '@ship/contracts'
import type { RealtimePhase } from './shell-store'

/** Immutable normalized state owned by one session controller. */
export interface SessionControllerState {
  sessionId: string
  phase: RealtimePhase
  hasSnapshot: boolean
  lastSequence: number
  snapshotEpoch: number
  summary?: ShellSessionSummary
  turnsById: ReadonlyMap<string, Turn>
  orderedTurnIds: readonly string[]
  messagesById: ReadonlyMap<string, RealtimeMessage>
  orderedMessageIds: readonly string[]
  tasksById: ReadonlyMap<string, RealtimeTask>
  beforeCursor?: string
  hasMore: boolean
  historyLoading: boolean
  historyError?: string
  synchronizedAt?: number
  error?: string
}

/** Create an empty controller snapshot without hiding later cached state. */
export function createEmptySessionState(sessionId: string): SessionControllerState {
  return {
    sessionId,
    phase: 'empty',
    hasSnapshot: false,
    lastSequence: 0,
    snapshotEpoch: 0,
    turnsById: new Map(),
    orderedTurnIds: [],
    messagesById: new Map(),
    orderedMessageIds: [],
    tasksById: new Map(),
    hasMore: false,
    historyLoading: false,
  }
}

/** Apply a validated session frame idempotently. */
export function reduceSessionFrame(
  state: SessionControllerState,
  frame: SessionStreamFrame,
): SessionControllerState {
  if (frame.type === 'pong') return state
  if (frame.type === 'session.error') {
    return { ...state, phase: frame.retryable ? 'synchronizing' : 'error', error: frame.code }
  }
  if (frame.type === 'session.snapshot') return stateFromSnapshot(state, frame.snapshot)
  if (frame.type === 'session.synchronized') {
    return {
      ...state,
      phase: 'live',
      lastSequence: Math.max(state.lastSequence, frame.sequence),
      synchronizedAt: Date.now(),
      error: undefined,
    }
  }
  return frame.records.reduce(applySessionRecord, state)
}

/** Merge an older history page when the originating snapshot epoch is still current. */
export function mergeTranscriptPage(
  state: SessionControllerState,
  page: TranscriptPage,
  requestEpoch: number,
): SessionControllerState {
  if (state.snapshotEpoch !== requestEpoch) return state
  const turnsById = new Map(state.turnsById)
  const messagesById = new Map(state.messagesById)
  for (const turn of page.turns) if (!turnsById.has(turn.id)) turnsById.set(turn.id, turn)
  for (const message of page.messages) if (!messagesById.has(message.id)) messagesById.set(message.id, message)
  const olderTurnIds = page.turns.map((turn) => turn.id).filter((id) => !state.orderedTurnIds.includes(id))
  const olderMessageIds = page.messages.map((message) => message.id).filter((id) => !state.orderedMessageIds.includes(id))
  return {
    ...state,
    turnsById,
    orderedTurnIds: [...olderTurnIds, ...state.orderedTurnIds],
    messagesById,
    orderedMessageIds: [...olderMessageIds, ...state.orderedMessageIds],
    beforeCursor: page.beforeCursor,
    hasMore: page.hasMore,
    historyLoading: false,
    historyError: undefined,
  }
}

function stateFromSnapshot(
  previous: SessionControllerState,
  snapshot: SessionDetailSnapshot,
): SessionControllerState {
  const messagesById = new Map(Object.entries(snapshot.messages))
  const orderedMessageIds = [...snapshot.orderedMessageIds]
  if (snapshot.liveTurn) {
    const current = messagesById.get(snapshot.liveTurn.messageId)
    const liveMessage: RealtimeMessage = {
      id: snapshot.liveTurn.messageId,
      turnId: snapshot.liveTurn.turnId,
      role: 'assistant',
      content: snapshot.liveTurn.text,
      parts: snapshot.liveTurn.parts,
      createdAt: current?.createdAt ?? snapshot.liveTurn.updatedAt,
    }
    messagesById.set(liveMessage.id, liveMessage)
    if (!orderedMessageIds.includes(liveMessage.id)) orderedMessageIds.push(liveMessage.id)
  }
  return {
    ...previous,
    phase: 'synchronizing',
    hasSnapshot: true,
    lastSequence: snapshot.snapshotSequence,
    snapshotEpoch: previous.snapshotEpoch + 1,
    summary: snapshot.summary,
    turnsById: new Map(Object.entries(snapshot.turns)),
    orderedTurnIds: snapshot.orderedTurnIds,
    messagesById,
    orderedMessageIds,
    tasksById: new Map(Object.entries(snapshot.tasks)),
    beforeCursor: snapshot.beforeCursor,
    hasMore: snapshot.hasMore,
    historyLoading: false,
    historyError: undefined,
    error: undefined,
  }
}

function applySessionRecord(state: SessionControllerState, record: SessionEventRecord): SessionControllerState {
  if (record.sequence <= state.lastSequence) return state
  const base = { ...state, lastSequence: record.sequence }
  const { event } = record
  switch (event.type) {
    case 'turn.started':
      return upsertTurn(base, record, 'running', event.properties.turnId)
    case 'turn.completed':
      return upsertTurn(base, record, 'completed', event.properties.turnId)
    case 'turn.failed':
      return upsertTurn(base, record, 'failed', event.properties.turnId)
    case 'turn.interrupted':
      return upsertTurn(base, record, 'interrupted', event.properties.turnId)
    case 'message.created':
      return upsertMessage(base, event.properties.message)
    case 'message.part.updated':
      return updateMessagePart(base, record, event.properties.part, event.properties.delta)
    case 'message.completed':
      return base
    case 'session.runtime.updated':
      return base.summary ? { ...base, summary: { ...base.summary, runtime: event.properties.runtime } } : base
    case 'session.diff':
      return updateTurnDiff(base, record, event.properties.diff)
    case 'todo.updated':
      return { ...base, tasksById: new Map(event.properties.todos.map((todo) => [todo.id, todo])) }
    case 'session.error':
      return appendErrorMessage(base, record, event.properties.error)
    case 'permission.asked':
    case 'permission.granted':
    case 'permission.denied':
    case 'question.asked':
    case 'question.replied':
    case 'question.rejected':
    case 'status':
      return base
    default: {
      const exhaustive: never = event
      return exhaustive
    }
  }
}

function upsertTurn(
  state: SessionControllerState,
  record: SessionEventRecord,
  status: TurnStatus,
  lifecycleTurnId: Turn['id'],
): SessionControllerState {
  const turnId = record.turnId ?? lifecycleTurnId
  if (!turnId) return state
  const previous = state.turnsById.get(turnId)
  const occurredAt = record.occurredAt
  const turn: Turn = {
    id: turnId,
    sessionID: state.sessionId,
    status,
    startedAt: previous?.startedAt ?? occurredAt,
    ...(status === 'running' ? {} : { completedAt: occurredAt }),
    ...(previous?.diffSummary ? { diffSummary: previous.diffSummary } : {}),
  }
  const turnsById = new Map(state.turnsById).set(turnId, turn)
  const orderedTurnIds = state.orderedTurnIds.includes(turnId)
    ? state.orderedTurnIds
    : [...state.orderedTurnIds, turnId]
  return { ...state, turnsById, orderedTurnIds }
}

function upsertMessage(state: SessionControllerState, message: RealtimeMessage): SessionControllerState {
  const previous = state.messagesById.get(message.id)
  if (previous === message) return state
  const messagesById = new Map(state.messagesById).set(message.id, message)
  const orderedMessageIds = state.orderedMessageIds.includes(message.id)
    ? state.orderedMessageIds
    : [...state.orderedMessageIds, message.id]
  return { ...state, messagesById, orderedMessageIds }
}

function updateMessagePart(
  state: SessionControllerState,
  record: SessionEventRecord,
  part: MessagePart,
  delta?: string,
): SessionControllerState {
  const current = state.messagesById.get(part.messageID)
  const parts = current?.parts ? [...current.parts] : []
  const index = parts.findIndex((candidate) => candidate.id === part.id && candidate.type === part.type)
  const existing = index >= 0 ? parts[index] : undefined
  const nextPart = appendPartDelta(existing, part, delta)
  if (index >= 0) parts[index] = nextPart
  else parts.push(nextPart)
  const content = parts
    .filter((candidate): candidate is Extract<MessagePart, { type: 'text' }> => candidate.type === 'text')
    .map((candidate) => candidate.text)
    .join('')
  const message: RealtimeMessage = {
    id: part.messageID as RealtimeMessage['id'],
    turnId: record.turnId ?? current?.turnId ?? null,
    role: 'assistant',
    content,
    parts,
    createdAt: current?.createdAt ?? record.occurredAt,
  }
  return upsertMessage(state, message)
}

function appendPartDelta(existing: MessagePart | undefined, part: MessagePart, delta?: string): MessagePart {
  if (typeof delta !== 'string') return part
  if (part.type === 'text') {
    return { ...part, text: existing?.type === 'text' ? existing.text + delta : delta }
  }
  if (part.type === 'reasoning') {
    return { ...part, text: existing?.type === 'reasoning' ? existing.text + delta : delta }
  }
  return part
}

function updateTurnDiff(
  state: SessionControllerState,
  record: SessionEventRecord,
  diff: Array<{ filename: string; additions: number; deletions: number }>,
): SessionControllerState {
  const turnId = record.turnId
  if (!turnId) return state
  const previous = state.turnsById.get(turnId)
  if (!previous) return state
  return { ...state, turnsById: new Map(state.turnsById).set(turnId, { ...previous, diffSummary: diff }) }
}

function appendErrorMessage(
  state: SessionControllerState,
  record: SessionEventRecord,
  error: unknown,
): SessionControllerState {
  const message: RealtimeMessage = {
    id: `error:${record.eventId}` as RealtimeMessage['id'],
    turnId: record.turnId ?? null,
    role: 'system',
    content: typeof error === 'string' ? error : 'The agent turn failed.',
    createdAt: record.occurredAt,
  }
  return upsertMessage(state, message)
}
