import { describe, expect, it } from 'vitest'
import type {
  MessageId,
  SessionDetailSnapshot,
  SessionEventRecord,
  SessionId,
  SessionStreamFrame,
  ShellSessionSummary,
  TranscriptPage,
  TurnId,
} from '@ship/contracts'
import { createEmptySessionState, mergeTranscriptPage, reduceSessionFrame } from './session-state'

const sessionId = '00000000-0000-4000-8000-000000000001' as SessionId
const turnId = '00000000-0000-4000-8000-000000000002' as TurnId
const messageId = '00000000-0000-4000-8000-000000000003' as MessageId

function summary(): ShellSessionSummary {
  return {
    id: sessionId,
    repoOwner: 'ship-org',
    repoName: 'ship',
    title: 'Realtime work',
    status: 'active',
    createdAt: 1,
    lastActivity: 1,
    archivedAt: null,
    revision: 1,
    agentId: 'codex',
    modelId: 'ship-acp-codex:gpt-5.5',
    runtime: { state: 'running', latestTurnId: turnId },
    diffStats: { additions: 0, deletions: 0, files: 0 },
  }
}

function snapshot(sequence = 3): SessionDetailSnapshot {
  return {
    sessionId,
    snapshotSequence: sequence,
    summary: summary(),
    turns: {
      [turnId]: { id: turnId, sessionID: sessionId, status: 'running', startedAt: 10 },
    },
    messages: {
      [messageId]: {
        id: messageId,
        turnId,
        role: 'user',
        content: 'Build it',
        createdAt: 10,
      },
    },
    orderedTurnIds: [turnId],
    orderedMessageIds: [messageId],
    tasks: {},
    beforeCursor: 'older',
    hasMore: true,
  }
}

function frame(value: SessionStreamFrame): SessionStreamFrame {
  return value
}

describe('session realtime reducer', () => {
  it('replaces from snapshot, applies replay, and ignores duplicate sequences', () => {
    let state = reduceSessionFrame(createEmptySessionState(sessionId), frame({
      type: 'session.snapshot',
      snapshot: snapshot(),
      reason: 'initial',
    }))
    const assistantId = '00000000-0000-4000-8000-000000000004' as MessageId
    const record: SessionEventRecord = {
      eventId: 'event-4',
      sequence: 4,
      turnId,
      occurredAt: 12,
      event: {
        type: 'message.created',
        properties: {
          message: {
            id: assistantId,
            turnId,
            role: 'assistant',
            content: 'Done',
            createdAt: 12,
          },
        },
      },
    }
    state = reduceSessionFrame(state, frame({ type: 'session.events', records: [record, record] }))

    expect(state.lastSequence).toBe(4)
    expect(state.orderedMessageIds).toHaveLength(2)
    expect(state.messagesById.get(assistantId)?.content).toBe('Done')
  })

  it('materializes text deltas without duplicating older records', () => {
    let state = reduceSessionFrame(createEmptySessionState(sessionId), frame({
      type: 'session.snapshot',
      snapshot: snapshot(0),
      reason: 'initial',
    }))
    const part = {
      id: 'text-1',
      sessionID: sessionId,
      messageID: '00000000-0000-4000-8000-000000000005' as MessageId,
      type: 'text' as const,
      text: '',
    }
    const records: SessionEventRecord[] = ['Hello', ' world'].map((delta, index) => ({
      eventId: `delta-${index}`,
      sequence: index + 1,
      turnId,
      occurredAt: 20 + index,
      event: { type: 'message.part.updated', properties: { part, delta } },
    }))
    state = reduceSessionFrame(state, frame({ type: 'session.events', records }))
    state = reduceSessionFrame(state, frame({ type: 'session.events', records: [records[0]!] }))

    expect(state.messagesById.get(part.messageID)?.content).toBe('Hello world')
    expect(state.lastSequence).toBe(2)
  })

  it('discards history when a replacement snapshot changes the epoch', () => {
    const first = reduceSessionFrame(createEmptySessionState(sessionId), frame({
      type: 'session.snapshot',
      snapshot: snapshot(3),
      reason: 'initial',
    }))
    const replacement = reduceSessionFrame(first, frame({
      type: 'session.snapshot',
      snapshot: snapshot(9),
      reason: 'compacted',
    }))
    const page: TranscriptPage = {
      turns: [{ id: 'legacy:older', sessionID: sessionId, status: 'completed' }],
      messages: [],
      hasMore: false,
      snapshotSequence: 3,
    }

    expect(mergeTranscriptPage(replacement, page, first.snapshotEpoch)).toBe(replacement)
  })

  it('preserves live records while prepending an older page', () => {
    const initial = reduceSessionFrame(createEmptySessionState(sessionId), frame({
      type: 'session.snapshot',
      snapshot: snapshot(),
      reason: 'initial',
    }))
    const page: TranscriptPage = {
      turns: [{ id: 'legacy:older', sessionID: sessionId, status: 'completed', startedAt: 1 }],
      messages: [{
        id: '00000000-0000-4000-8000-000000000006' as MessageId,
        turnId: 'legacy:older',
        role: 'user',
        content: 'Earlier',
        createdAt: 1,
      }],
      hasMore: false,
      snapshotSequence: 3,
    }
    const merged = mergeTranscriptPage(initial, page, initial.snapshotEpoch)

    expect(merged.orderedTurnIds).toEqual(['legacy:older', turnId])
    expect(merged.orderedMessageIds.at(-1)).toBe(messageId)
  })
})
