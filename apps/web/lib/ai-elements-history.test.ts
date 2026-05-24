import { describe, expect, it } from 'vitest'

import { mapApiMessagesToUI } from './ai-elements-history'

describe('mapApiMessagesToUI', () => {
  it('restores tool invocations and reasoning from persisted parts JSON', () => {
    const parts = JSON.stringify([
      { type: 'text', text: 'Done.' },
      { type: 'reasoning', text: 'Thinking through the change.' },
      {
        type: 'tool',
        id: 'tool-1',
        callID: 'call-1',
        tool: 'read',
        state: { status: 'completed' },
        input: { path: 'src/index.ts' },
        output: 'file contents',
      },
    ])

    const [message] = mapApiMessagesToUI([
      {
        id: 'msg-1',
        role: 'assistant',
        content: 'Done.',
        createdAt: 1_700_000_000,
        parts,
      },
    ])

    expect(message.content).toBe('Done.')
    expect(message.reasoning).toEqual(['Thinking through the change.'])
    expect(message.toolInvocations).toHaveLength(1)
    expect(message.toolInvocations![0]!.toolName).toBe('read')
    expect(message.toolInvocations![0]!.state).toBe('result')
  })

  it('restores tool-only turns when assistant text is empty', () => {
    const parts = JSON.stringify([
      {
        type: 'tool',
        id: 'tool-1',
        callID: 'call-1',
        tool: 'bash',
        state: { status: 'completed' },
        input: { command: 'ls' },
        output: 'README.md',
      },
    ])

    const [message] = mapApiMessagesToUI([
      {
        id: 'msg-2',
        role: 'assistant',
        content: '',
        createdAt: 1_700_000_100,
        parts,
      },
    ])

    expect(message.content).toBe('')
    expect(message.toolInvocations).toHaveLength(1)
    expect(message.toolInvocations![0]!.toolName).toBe('bash')
  })
})
