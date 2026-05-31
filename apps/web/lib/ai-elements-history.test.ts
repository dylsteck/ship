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
    expect(message.orderedParts?.map((part) => part.kind)).toEqual(['text', 'reasoning', 'tool'])
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

  it('preserves text-tool-text order from persisted parts', () => {
    const parts = JSON.stringify([
      { type: 'text', id: 'text-1', text: 'Before tool.' },
      {
        type: 'tool',
        id: 'tool-1',
        callID: 'call-1',
        tool: 'bash',
        state: { status: 'running', input: { command: 'pwd' } },
      },
      { type: 'text', id: 'text-2', text: 'After tool.' },
    ])

    const [message] = mapApiMessagesToUI([
      {
        id: 'msg-3',
        role: 'assistant',
        content: '',
        createdAt: 1_700_000_200,
        parts,
      },
    ])

    expect(message.content).toBe('Before tool.After tool.')
    expect(message.orderedParts?.map((part) => part.kind)).toEqual(['text', 'tool', 'text'])
    expect(message.orderedParts?.[0]).toMatchObject({ kind: 'text', text: 'Before tool.' })
    expect(message.orderedParts?.[2]).toMatchObject({ kind: 'text', text: 'After tool.' })
  })

  it('updates repeated tool parts in place', () => {
    const parts = JSON.stringify([
      { type: 'text', id: 'text-1', text: 'Running.' },
      {
        type: 'tool',
        id: 'tool-1',
        callID: 'call-1',
        tool: 'bash',
        state: { status: 'running', input: { command: 'pwd' } },
      },
      {
        type: 'tool',
        id: 'tool-1',
        callID: 'call-1',
        tool: 'bash',
        state: { status: 'completed', input: { command: 'pwd' }, output: '/tmp' },
      },
    ])

    const [message] = mapApiMessagesToUI([
      {
        id: 'msg-4',
        role: 'assistant',
        content: '',
        createdAt: 1_700_000_300,
        parts,
      },
    ])

    expect(message.orderedParts?.map((part) => part.kind)).toEqual(['text', 'tool'])
    expect(message.toolInvocations).toHaveLength(1)
    expect(message.toolInvocations?.[0]?.state).toBe('result')
  })

  it('updates repeated text and reasoning parts in place', () => {
    const parts = JSON.stringify([
      { type: 'text', id: 'text-1', text: 'Draft' },
      { type: 'reasoning', id: 'reasoning-1', text: 'Thinking' },
      { type: 'text', id: 'text-1', text: 'Final' },
      { type: 'reasoning', id: 'reasoning-1', text: 'Done thinking' },
    ])

    const [message] = mapApiMessagesToUI([
      {
        id: 'msg-5',
        role: 'assistant',
        content: '',
        createdAt: 1_700_000_400,
        parts,
      },
    ])

    expect(message.content).toBe('Final')
    expect(message.reasoning).toEqual(['Done thinking'])
    expect(message.orderedParts?.map((part) => part.kind)).toEqual(['text', 'reasoning'])
    expect(message.orderedParts?.[0]).toMatchObject({ kind: 'text', text: 'Final' })
    expect(message.orderedParts?.[1]).toMatchObject({ kind: 'reasoning', text: 'Done thinking' })
  })
})
