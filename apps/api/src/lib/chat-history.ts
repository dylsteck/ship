/**
 * Persisted Ship chat rows → `{ role, content }[]` used when assembling `session/prompt` payloads.
 *
 * Past structured tool parts are dropped — ACP backends re-derive workspace state via their own tools.
 *
 * @packageDocumentation
 */

/** Persisted message shape returned by the SessionDO `/messages` endpoint. */
export interface PersistedMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  parts?: string
  createdAt: number
}

/** Minimal `{role, content}` entries consumed by `session/prompt` assembly */
export interface ChatTurnMessage {
  role: 'user' | 'assistant'
  content: string
}

export function toChatTurnMessages(history: PersistedMessage[]): ChatTurnMessage[] {
  const result: ChatTurnMessage[] = []
  for (const message of history) {
    if (message.role === 'user') {
      const text = message.content?.trim()
      if (!text) continue
      result.push({ role: 'user', content: text })
      continue
    }
    if (message.role === 'assistant') {
      const text = message.content?.trim()
      if (!text) continue
      result.push({ role: 'assistant', content: text })
      continue
    }
  }
  return result
}

export function appendUserMessage(messages: ChatTurnMessage[], content: string): ChatTurnMessage[] {
  return [...messages, { role: 'user', content }]
}
