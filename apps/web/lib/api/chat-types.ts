/**
 * Chat REST / SSE payload types (shared by server and browser clients).
 * Kept separate from `server.ts` so client hooks can import without `next/headers`.
 */

export interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  parts?: string
  createdAt: number
  type?: 'error' | 'pr-notification'
  errorCategory?: 'transient' | 'persistent' | 'user-action' | 'fatal'
  retryable?: boolean
  inlineTools?: Array<{
    name: string
    status: 'pending' | 'in_progress' | 'completed' | 'failed'
    input: Record<string, unknown>
    output?: unknown
    duration?: number
  }>
  reasoningBlocks?: Array<{
    text: string
  }>
}

export interface MessagePart {
  type: 'text' | 'tool-call' | 'tool-result'
  content?: string
  toolName?: string
  toolInput?: unknown
  toolOutput?: unknown
  state?: 'pending' | 'running' | 'complete' | 'error'
}

export interface RawEvent {
  id: string
  type: string
  timestamp: number
  payload: unknown
}
