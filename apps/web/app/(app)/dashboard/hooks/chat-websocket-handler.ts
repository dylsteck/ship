import { SessionSummarySchema } from '@ship/contracts'
import type { Message as APIMessage } from '@/lib/api/chat-client'
import type { UIMessage } from '@/lib/ai-elements-adapter'
import { createErrorMessage, classifyError } from '@/lib/ai-elements-adapter'
import { sessionStatusStore } from './use-session-status-store'

export interface ChatWebSocketHandlers {
  setMessages: React.Dispatch<React.SetStateAction<UIMessage[]>>
  streamingMessageRef: React.MutableRefObject<string | null>
  setAgentUrl: (url: string) => void
  setAgentSessionId: (id: string) => void
  setSandboxStatus: (status: string) => void
  onAgentEventRef?: React.MutableRefObject<
    ((sessionId: string, event: { type: string; [k: string]: unknown }) => void) | null
  >
}

export function handleChatWebSocketMessage(
  sessionId: string,
  data: unknown,
  handlers: ChatWebSocketHandlers,
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
    event?: { type: string; [k: string]: unknown }
  }

  const { setMessages, streamingMessageRef, setAgentUrl, setAgentSessionId, setSandboxStatus, onAgentEventRef } =
    handlers

  if (event.type === 'session.summary.updated') {
    const raw = (event as { properties?: { summary?: unknown } }).properties?.summary
    const parsed = SessionSummarySchema.safeParse(raw)
    if (parsed.success) {
      const summary = parsed.data
      sessionStatusStore.update(sessionId, {
        title: summary.title,
        isRunning: Boolean(summary.streaming),
        status: summary.activeTool ? `Running ${summary.activeTool}` : summary.streaming ? 'Streaming' : '',
      })
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
    onAgentEventRef?.current?.(sessionId, event.event)
  }
}
