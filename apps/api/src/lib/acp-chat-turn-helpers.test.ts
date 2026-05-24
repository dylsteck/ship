import { describe, expect, it, vi } from 'vitest'

import { DO_URL, hasPersistableAssistantOutput, persistAssistantMessage } from './acp-chat-turn-helpers'

describe('hasPersistableAssistantOutput', () => {
  it('returns false when content and parts are empty', () => {
    expect(hasPersistableAssistantOutput('', [])).toBe(false)
    expect(hasPersistableAssistantOutput('   ', undefined)).toBe(false)
  })

  it('returns true when text content is present', () => {
    expect(hasPersistableAssistantOutput('hello', [])).toBe(true)
  })

  it('returns true for tool-only turns with parts but no text', () => {
    expect(hasPersistableAssistantOutput('', [{ type: 'tool', id: 't1' }])).toBe(true)
  })
})

describe('persistAssistantMessage', () => {
  it('persists tool-only assistant messages without text', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response('{}'))
    const parts = [{ type: 'tool', id: 'tool-1', name: 'read', status: 'completed' }]

    await persistAssistantMessage({ fetch }, '', parts)

    expect(fetch).toHaveBeenCalledOnce()
    const request = fetch.mock.calls[0]![0] as Request
    expect(request.url).toBe(`${DO_URL}/messages`)
    const body = JSON.parse(await request.text()) as { role: string; content: string; parts?: string }
    expect(body.role).toBe('assistant')
    expect(body.content).toBe('')
    expect(JSON.parse(body.parts!)).toEqual(parts)
  })

  it('skips fetch when there is nothing to persist', async () => {
    const fetch = vi.fn()
    await persistAssistantMessage({ fetch }, '  ', [])
    expect(fetch).not.toHaveBeenCalled()
  })
})
