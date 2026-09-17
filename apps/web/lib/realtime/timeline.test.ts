import { describe, expect, it } from 'vitest'
import type { MessageId, RealtimeMessage, SessionId, Turn, TurnId } from '@ship/contracts'
import { createEmptySessionState, type SessionControllerState } from './session-state'
import { deriveTimelineRows } from './timeline'

const sessionId = '00000000-0000-4000-8000-000000000010' as SessionId
const turnId = '00000000-0000-4000-8000-000000000011' as TurnId

function fixture(status: Turn['status']): SessionControllerState {
  const user: RealtimeMessage = {
    id: '00000000-0000-4000-8000-000000000012' as MessageId,
    turnId,
    role: 'user',
    content: 'Inspect and update the app',
    createdAt: 1,
  }
  const assistant: RealtimeMessage = {
    id: '00000000-0000-4000-8000-000000000013' as MessageId,
    turnId,
    role: 'assistant',
    content: 'The update is complete.',
    createdAt: 2,
    parts: [
      tool('read-a', 'read', '/repo/a.ts'),
      tool('read-b', 'grep', '/repo/b.ts'),
      tool('write-c', 'write', '/repo/c.ts'),
    ],
  }
  return {
    ...createEmptySessionState(sessionId),
    hasSnapshot: true,
    turnsById: new Map([[turnId, {
      id: turnId,
      sessionID: sessionId,
      status,
      startedAt: 1,
      ...(status === 'running' ? {} : { completedAt: 11 }),
      diffSummary: [{ filename: 'c.ts', additions: 3, deletions: 1 }],
    }]]),
    orderedTurnIds: [turnId],
    messagesById: new Map([[user.id, user], [assistant.id, assistant]]),
    orderedMessageIds: [user.id, assistant.id],
  }
}

function tool(id: string, name: string, path: string) {
  return {
    id,
    sessionID: sessionId,
    messageID: '00000000-0000-4000-8000-000000000013',
    type: 'tool' as const,
    callID: id,
    tool: name,
    state: { status: 'completed' as const, input: { path }, output: 'ok' },
  }
}

describe('turn-centric timeline', () => {
  it('folds settled work but leaves the final answer visible', () => {
    const rows = deriveTimelineRows(fixture('completed'), new Set())

    expect(rows.map((row) => row.type)).toEqual([
      'user-message',
      'work-summary',
      'assistant-content',
      'turn-diff',
    ])
  })

  it('groups exploration without hiding a write', () => {
    const rows = deriveTimelineRows(fixture('completed'), new Set([turnId]))

    expect(rows.map((row) => row.type)).toContain('work-group')
    const write = rows.find((row) => row.type === 'tool' && row.tool.tool === 'write')
    expect(write).toBeDefined()
  })

  it('keeps active work expanded and shows a working row', () => {
    const rows = deriveTimelineRows(fixture('running'), new Set())

    expect(rows.some((row) => row.type === 'working')).toBe(true)
    expect(rows.some((row) => row.type === 'tool')).toBe(true)
  })

  it('reuses unchanged rows across derivations', () => {
    const state = fixture('completed')
    const first = deriveTimelineRows(state, new Set())
    const second = deriveTimelineRows(state, new Set(), first)

    expect(second.every((row, index) => row === first[index])).toBe(true)
  })
})
