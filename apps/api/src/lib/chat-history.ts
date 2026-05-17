/**
 * Convert persisted Ship messages into AI SDK {@link ModelMessage}s.
 *
 * Persisted Ship messages are stored as `{ role, content, parts? }` where
 * `parts` is a JSON-serialized array of legacy parts. For the new agent
 * harness we only need conversational text history — past tool calls are
 * not replayed (the model can re-tool as needed).
 *
 * @packageDocumentation
 */

import type { ModelMessage } from 'ai'

/** Persisted message shape returned by the SessionDO `/messages` endpoint. */
export interface PersistedMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  parts?: string
  createdAt: number
}

/**
 * Convert a list of persisted messages into AI SDK `ModelMessage`s.
 *
 * - User messages: pass through.
 * - Assistant messages: `content` is treated as a single text chunk.
 *   Tool calls/results from previous turns are intentionally dropped to
 *   keep history concise; the model can re-derive workspace state via tools.
 * - System messages: dropped — the agent prepends its own system prompt.
 *
 * @param history - Messages from oldest to newest.
 * @returns Lossless ModelMessage array suitable for `streamText({ messages })`.
 */
export function toModelMessages(history: PersistedMessage[]): ModelMessage[] {
  const result: ModelMessage[] = []
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
    // System / error / pr-notification rows: drop.
  }
  return result
}

/**
 * Append a fresh user message to a model-messages array.
 *
 * Convenience wrapper to keep call sites readable.
 */
export function appendUserMessage(messages: ModelMessage[], content: string): ModelMessage[] {
  return [...messages, { role: 'user', content }]
}
