import { describe, expect, it } from 'vitest'

import {
  processPartUpdated,
  synthesizeOrderedParts,
  type OrderedMessagePart,
  type UIMessage,
} from './ai-elements-adapter'
import type { MessagePart } from './sse-types'

function partBase(id: string) {
  return { id, sessionID: 'session-1', messageID: 'message-1' }
}

function runParts(parts: Array<{ part: MessagePart; delta?: string }>): UIMessage {
  const message: UIMessage = { id: 'assistant-1', role: 'assistant', content: '' }
  const textRef = { current: '' }
  const reasoningRef = { current: '' }
  const orderedPartsRef = { current: [] as OrderedMessagePart[] }
  let messages = [message]

  for (const update of parts) {
    messages = processPartUpdated(
      update.part,
      update.delta,
      message.id,
      messages,
      textRef,
      reasoningRef,
      orderedPartsRef,
    )
  }

  return messages[0]!
}

describe('ordered UI message parts', () => {
  it('preserves text-tool-text order', () => {
    const message = runParts([
      { part: { ...partBase('text-1'), type: 'text', text: 'Before.' } as MessagePart },
      {
        part: {
          ...partBase('tool-1'),
          type: 'tool',
          callID: 'call-1',
          tool: 'bash',
          state: { status: 'running', input: { command: 'pwd' } },
        } as MessagePart,
      },
      { part: { ...partBase('text-2'), type: 'text', text: 'After.' } as MessagePart },
    ])

    expect(message.orderedParts?.map((part) => part.kind)).toEqual(['text', 'tool', 'text'])
    expect(message.content).toBe('Before.After.')
  })

  it('preserves reasoning-text-tool-text order', () => {
    const message = runParts([
      { part: { ...partBase('reasoning-1'), type: 'reasoning', text: 'Thinking.' } as MessagePart },
      { part: { ...partBase('text-1'), type: 'text', text: 'Answer.' } as MessagePart },
      {
        part: {
          ...partBase('tool-1'),
          type: 'tool',
          callID: 'call-1',
          tool: 'read',
          state: { status: 'completed', input: { path: 'README.md' }, output: 'contents' },
        } as MessagePart,
      },
      { part: { ...partBase('text-2'), type: 'text', text: 'Done.' } as MessagePart },
    ])

    expect(message.orderedParts?.map((part) => part.kind)).toEqual(['reasoning', 'text', 'tool', 'text'])
  })

  it('updates repeated tool parts without moving them', () => {
    const message = runParts([
      {
        part: {
          ...partBase('tool-1'),
          type: 'tool',
          callID: 'call-1',
          tool: 'bash',
          state: { status: 'running', input: { command: 'pwd' } },
        } as MessagePart,
      },
      { part: { ...partBase('text-1'), type: 'text', text: 'Output ready.' } as MessagePart },
      {
        part: {
          ...partBase('tool-1'),
          type: 'tool',
          callID: 'call-1',
          tool: 'bash',
          state: { status: 'completed', input: { command: 'pwd' }, output: '/tmp' },
        } as MessagePart,
      },
    ])

    expect(message.orderedParts?.map((part) => part.kind)).toEqual(['tool', 'text'])
    expect(message.toolInvocations?.[0]?.state).toBe('result')
  })

  it('synthesizes best-effort parts for legacy messages', () => {
    const parts = synthesizeOrderedParts({
      id: 'legacy',
      role: 'assistant',
      content: 'Answer.',
      reasoning: ['Thinking.'],
      toolInvocations: [
        {
          toolCallId: 'call-1',
          toolName: 'bash',
          state: 'result',
          args: {},
        },
      ],
    })

    expect(parts.map((part) => part.kind)).toEqual(['reasoning', 'tool', 'text'])
  })
})
