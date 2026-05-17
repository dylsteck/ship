/**
 * Centralized API module for **client** code (hooks, `setApiToken`, shared types).
 *
 * Server Components and Route Handlers should import from `@/lib/api/server` instead
 * so `next/headers` is not pulled into the browser bundle.
 */
// Re-export all hooks (for Client Components)
export * from './hooks'

// Re-export types
export * from './types'

// Re-export client utilities (for advanced usage)
export { API_URL, fetcher, authFetcher, post, del, apiUrl, wsUrl, chatFetchHeaders } from './client'

// Chat types + browser-safe chat fetches (JWT via setApiToken)
export type { Message, RawEvent, MessagePart } from './chat-types'
export {
  getChatMessages,
  getChatEvents,
  sendChatMessage,
  stopChatStream,
  subscribeToChatStream,
} from './chat-client'
