import { describe, expect, it } from 'vitest'

import type { ToolInvocation, UIMessage } from '@/lib/ai-elements-adapter'

import {
  classifyErrorFromCode,
  collapseToolInvocations,
  derivePendingPrompts,
} from './session-logic'

function makeTool(toolName: string, toolCallId: string): ToolInvocation {
  return {
    toolCallId,
    toolName,
    state: 'result',
    args: {},
  }
}

function makePromptMessage(
  type: 'permission' | 'question',
  id: string,
  status: 'pending' | 'granted' | 'denied' | 'replied' | 'rejected',
): UIMessage {
  return {
    id: `${type}-${id}`,
    role: 'system',
    content: type === 'permission' ? 'Allow file write?' : 'Which mode?',
    type,
    promptData: {
      id,
      ...(type === 'permission'
        ? { permission: 'write', description: 'Allow file write?' }
        : { text: 'Which mode?' }),
      status,
    },
  }
}

describe('collapseToolInvocations', () => {
  it('groups consecutive read tools', () => {
    const result = collapseToolInvocations([
      makeTool('read_file', 'a'),
      makeTool('read', 'b'),
      makeTool('write_file', 'c'),
    ])

    expect(result).toHaveLength(2)
    expect(result[0]).toMatchObject({ kind: 'group', groupKind: 'read', label: 'Read files (2)' })
    expect(result[1]).toMatchObject({ kind: 'single', tool: { toolCallId: 'c' } })
  })

  it('groups consecutive grep and bash tools separately', () => {
    const result = collapseToolInvocations([
      makeTool('grep', '1'),
      makeTool('glob', '2'),
      makeTool('bash', '3'),
      makeTool('shell', '4'),
    ])

    expect(result).toHaveLength(2)
    expect(result[0]).toMatchObject({ kind: 'group', groupKind: 'grep', label: 'Searched files (2)' })
    expect(result[1]).toMatchObject({ kind: 'group', groupKind: 'bash', label: 'Ran commands (2)' })
  })

  it('does not merge non-adjacent groups of the same kind', () => {
    const result = collapseToolInvocations([
      makeTool('read_file', 'a'),
      makeTool('write_file', 'b'),
      makeTool('read_file', 'c'),
    ])

    expect(result).toHaveLength(3)
    expect(result[0]).toMatchObject({ kind: 'group', groupKind: 'read', tools: [{ toolCallId: 'a' }] })
    expect(result[1]).toMatchObject({ kind: 'single', tool: { toolCallId: 'b' } })
    expect(result[2]).toMatchObject({ kind: 'group', groupKind: 'read', tools: [{ toolCallId: 'c' }] })
  })
})

describe('derivePendingPrompts', () => {
  it('returns only pending permission and question prompts', () => {
    const messages: UIMessage[] = [
      makePromptMessage('permission', 'perm-1', 'pending'),
      makePromptMessage('question', 'q-1', 'replied'),
      makePromptMessage('question', 'q-2', 'pending'),
      { id: 'assistant-1', role: 'assistant', content: 'hello' },
    ]

    expect(derivePendingPrompts(messages)).toEqual([
      {
        id: 'perm-1',
        type: 'permission',
        messageId: 'permission-perm-1',
        promptData: messages[0].promptData,
      },
      {
        id: 'q-2',
        type: 'question',
        messageId: 'question-q-2',
        promptData: messages[2].promptData,
      },
    ])
  })
})

describe('classifyErrorFromCode', () => {
  it('maps rate limit errors to transient retryable RATE_LIMIT', () => {
    expect(classifyErrorFromCode('429 Too Many Requests')).toEqual({
      category: 'transient',
      retryable: true,
      code: 'RATE_LIMIT',
    })
  })

  it('maps git access errors to user-action GIT_ACCESS', () => {
    expect(
      classifyErrorFromCode('Failed to clone repository: authentication failed for private repo'),
    ).toEqual({
      category: 'user-action',
      retryable: false,
      code: 'GIT_ACCESS',
    })
  })

  it('maps unknown errors to persistent UNKNOWN', () => {
    expect(classifyErrorFromCode('Something unexpected happened')).toEqual({
      category: 'persistent',
      retryable: false,
      code: 'UNKNOWN',
    })
  })
})
