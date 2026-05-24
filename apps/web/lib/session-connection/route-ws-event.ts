import type { Dispatch, SetStateAction } from 'react'
import type { SessionSummary } from '@ship/contracts'

import type { Message as APIMessage } from '@/lib/api/chat-client'
import type { UIMessage } from '@/lib/ai-elements-adapter'
import { createErrorMessage, classifyError } from '@/lib/ai-elements-adapter'
import { SessionSummarySchema } from '@ship/contracts'

/** Handlers for dashboard WebSocket frames routed through {@link SessionConnection}. */
export interface RouteWebSocketEventHandlers {
  setMessages: Dispatch<SetStateAction<UIMessage[]>>
  streamingMessageRef: React.MutableRefObject<string | null>
  setAgentUrl: (url: string) => void
  setAgentSessionId: (id: string) => void
  setSandboxStatus: (status: string) => void
  onSummary?: (summary: SessionSummary) => void
  onAgentEvent?: (sessionId: string, event: { type: string; [k: string]: unknown }) => void
}

/**
 * Route a SessionDO WebSocket payload to dashboard state updaters.
 *
 * @param sessionId - Active chat session id
 * @param data - Parsed WebSocket JSON payload
 * @param handlers - React setters and side-channel callbacks
 */
export function routeWebSocketEvent(
  sessionId: string,
  data: unknown,
  handlers: RouteWebSocketEventHandlers,
): void {
  const event = data as {
    type: string
    message?: APIMessage | string
    category?: 'transient' | 'persistent' | 'user-action' | 'fatal'
    retryable?: boolean
    prUrl?: string
    url?: string
    agentSessionId?: string
    status?: string
    properties?: { summary?: unknown }
    event?: { type: string; [k: string]: unknown }
  }

  const {
    setMessages,
    streamingMessageRef,
    setAgentUrl,
    setAgentSessionId,
    setSandboxStatus,
    onSummary,
    onAgentEvent,
  } = handlers

  if (event.type === 'session.summary.updated') {
    const parsed = SessionSummarySchema.safeParse(event.properties?.summary)
    if (parsed.success) {
      onSummary?.(parsed.data)
    }
    return
  }

  if (event.type === 'message') {
    const msg = event.message as APIMessage
    const uiMsg: UIMessage = {
      id: msg.id,
      role: msg.role as UIMessage['role'],
      content: msg.content,
      createdAt: new Date(msg.createdAt * 1000),
    }
    setMessages((prev) => {
      if (uiMsg.role === 'assistant' && streamingMessageRef.current) {
        return prev.map((m) =>
          m.id === streamingMessageRef.current ? { ...m, content: uiMsg.content, createdAt: uiMsg.createdAt } : m,
        )
      }
      const exists = prev.some((m) => m.id === uiMsg.id)
      if (exists) return prev
      return [...prev, uiMsg]
    })
    return
  }

  if (event.type === 'error') {
    const content = typeof event.message === 'string' ? event.message : 'An error occurred'
    const { category, retryable } = classifyError(content)
    setMessages((prev) => [
      ...prev,
      createErrorMessage(content, event.category || category, event.retryable ?? retryable),
    ])
    return
  }

  if (event.type === 'pr-created') {
    setMessages((prev) => [
      ...prev,
      {
        id: `pr-${Date.now()}`,
        role: 'system',
        content: `Draft PR created: ${event.prUrl}`,
        type: 'pr-notification',
        createdAt: new Date(),
      },
    ])
    return
  }

  if (event.type === 'agent-url' || event.type === 'opencode-url') {
    if (event.url) {
      setAgentUrl(event.url)
      try {
        localStorage.setItem(`agent-url-${sessionId}`, event.url)
      } catch {}
    }
    return
  }

  if (event.type === 'agent-session' && event.agentSessionId) {
    setAgentSessionId(event.agentSessionId)
    try {
      localStorage.setItem(`agent-session-id-${sessionId}`, event.agentSessionId)
    } catch {}
    return
  }

  if (event.type === 'sandbox-status' && event.status) {
    setSandboxStatus(event.status)
    return
  }

  if (event.type === 'agent-event' && event.event) {
    onAgentEvent?.(sessionId, event.event)
  }
}
