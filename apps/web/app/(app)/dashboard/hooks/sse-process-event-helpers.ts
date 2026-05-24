import { createAssistantPlaceholder } from '@/lib/ai-elements-adapter'
import { sessionStatusStore } from './use-session-status-store'
import { handleGenericError, handleSessionError } from './sse-event-handlers'
import { createSSEHandlerContext } from './sse-handler-context'
import { actionForChatErrorPayload } from './sse-stream-utils'
import type { useDashboardChat } from './use-dashboard-chat'

export interface EnsureStreamingPlaceholderParams {
  sessionId: string
  event: { type: string; [k: string]: unknown }
  chat: ReturnType<typeof useDashboardChat>
  streamStartTimeRef: React.MutableRefObject<number | null>
  terminalStreamSessionsRef: React.MutableRefObject<Set<string>>
}

/** Returns true when processing should continue for this event. */
export function ensureStreamingPlaceholder({
  sessionId,
  event,
  chat,
  streamStartTimeRef,
  terminalStreamSessionsRef,
}: EnsureStreamingPlaceholderParams): boolean {
  const hasCompletedAssistant = chat.messagesRef.current.some(
    (m) => m.role === 'assistant' && (m.content || m.toolInvocations?.length),
  )
  const ctxEarly = createSSEHandlerContext(chat, sessionId, { current: !hasCompletedAssistant })

  if (event.type === 'error') {
    const errEvt = event as {
      error?: string
      details?: string
      retryable?: boolean
      attempt?: number
      category?: string
    }
    if (!(errEvt.retryable && typeof errEvt.attempt === 'number')) {
      handleGenericError(errEvt.error, ctxEarly, errEvt.details, actionForChatErrorPayload(errEvt))
      sessionStatusStore.update(sessionId, { isRunning: false, status: 'Error' })
      terminalStreamSessionsRef.current.add(sessionId)
    }
    return false
  }

  if (event.type === 'session.error') {
    handleSessionError(
      (event as { properties?: { error?: Parameters<typeof handleSessionError>[0] } }).properties?.error,
      ctxEarly,
    )
    sessionStatusStore.update(sessionId, { isRunning: false, status: 'Error' })
    terminalStreamSessionsRef.current.add(sessionId)
    return false
  }

  const isStreamingEvent = [
    'status',
    'session.status',
    'message.part.updated',
    'heartbeat',
    'agent-url',
    'agent-session',
  ].includes(event.type)

  if (!isStreamingEvent) return false

  const placeholder = createAssistantPlaceholder()
  chat.streamingMessageRef.current = placeholder.id
  chat.setMessages((prev) => [...prev, placeholder])
  chat.setIsStreaming(true)
  const now = Date.now()
  chat.setStreamStartTime(now)
  streamStartTimeRef.current = now
  return true
}
