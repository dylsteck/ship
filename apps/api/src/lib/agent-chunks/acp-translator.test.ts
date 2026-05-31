import { describe, expect, it } from 'vitest'

import { createAcpNotificationTranslator } from './acp-translator'

function textNote(text: string): Record<string, unknown> {
  return { method: 'session/update', params: { text } }
}

function reasoningNote(text: string): Record<string, unknown> {
  return {
    method: 'session/update',
    params: { text, update: { sessionUpdate: 'agent_thought_chunk' } },
  }
}

function toolNote(toolCallId: string, status: string, output?: string): Record<string, unknown> {
  return {
    method: 'session/update',
    params: {
      update: {
        sessionUpdate: 'tool_call',
        toolCallId,
        name: 'bash',
        status,
        input: { command: 'pwd' },
        ...(output !== undefined ? { output } : {}),
      },
    },
  }
}

describe('createAcpNotificationTranslator', () => {
  it('preserves final text-tool-text part order', () => {
    const translator = createAcpNotificationTranslator('session-a')

    translator.translateNotification(textNote('Before. '))
    translator.translateNotification(toolNote('tool-1', 'running'))
    translator.translateNotification(textNote('After.'))

    expect(translator.getFinalParts().map((part) => part.type)).toEqual(['text', 'tool', 'text'])
  })

  it('segments text after an intervening tool event', () => {
    const translator = createAcpNotificationTranslator('session-b')

    translator.translateNotification(textNote('Alpha '))
    translator.translateNotification(toolNote('tool-1', 'running'))
    translator.translateNotification(textNote('Beta'))

    const textParts = translator.getFinalParts().filter((part) => part.type === 'text')
    expect(textParts.map((part) => part.text)).toEqual(['Alpha ', 'Beta'])
  })

  it('keeps repeated tool updates in the original position with a stable id', () => {
    const translator = createAcpNotificationTranslator('session-c')

    const [firstEvent] = translator.translateNotification(toolNote('tool-1', 'running'))
    translator.translateNotification(textNote('done'))
    const [secondEvent] = translator.translateNotification(toolNote('tool-1', 'completed', '/tmp'))

    const firstPart = (firstEvent?.properties as Record<string, unknown>)?.part as Record<string, unknown>
    const secondPart = (secondEvent?.properties as Record<string, unknown>)?.part as Record<string, unknown>

    expect(firstPart.id).toBe(secondPart.id)
    expect(translator.getFinalParts().map((part) => part.type)).toEqual(['tool', 'text'])
    expect(translator.getFinalParts()[0]).toMatchObject({
      type: 'tool',
      state: { status: 'completed', output: '/tmp' },
    })
  })

  it('preserves reasoning-text-tool-text order', () => {
    const translator = createAcpNotificationTranslator('session-d')

    translator.translateNotification(reasoningNote('Thinking. '))
    translator.translateNotification(textNote('Answer. '))
    translator.translateNotification(toolNote('tool-1', 'running'))
    translator.translateNotification(textNote('More.'))

    expect(translator.getFinalParts().map((part) => part.type)).toEqual(['reasoning', 'text', 'tool', 'text'])
  })
})
