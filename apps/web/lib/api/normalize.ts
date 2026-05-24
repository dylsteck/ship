/**
 * Normalize SDK wire types into web-local shapes (numeric timestamps, typed message fields).
 */

import type { ChatEvent, ChatMessage } from '@ship/sdk'
import type { Message, RawEvent } from './chat-types'

/** Coerce OpenAPI `string | number` timestamps to epoch seconds. */
export function toEpochSeconds(value: string | number): number {
  return typeof value === 'number' ? value : Number(value)
}

/** Map SDK chat message → web {@link Message}. */
export function normalizeChatMessage(message: ChatMessage): Message {
  const extra = message as ChatMessage & Partial<Message>
  return {
    id: message.id,
    role: message.role,
    content: message.content,
    parts:
      typeof message.parts === 'string'
        ? message.parts
        : message.parts != null
          ? JSON.stringify(message.parts)
          : undefined,
    createdAt: toEpochSeconds(message.createdAt),
    type: extra.type,
    errorCategory: extra.errorCategory,
    retryable: extra.retryable,
    inlineTools: extra.inlineTools,
    reasoningBlocks: extra.reasoningBlocks,
  }
}

/** Map SDK chat event → web {@link RawEvent}. */
export function normalizeChatEvent(event: ChatEvent): RawEvent {
  return {
    id: event.id,
    type: event.type,
    timestamp: toEpochSeconds(event.timestamp),
    payload: event.payload ?? {},
  }
}
