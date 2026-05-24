import type { Dispatch, MutableRefObject, SetStateAction } from 'react'
import type { AgentStatus } from '@/components/session/status-indicator'
import {
  type UIMessage,
  createErrorMessage,
  createSystemMessage,
  classifyError,
} from '@/lib/ai-elements-adapter'
import type { Message } from '@/lib/api'
import { processStreamEvent, parseSSELines } from './stream-processor'

export interface SSEStreamRefs {
  streamingMessageRef: MutableRefObject<string | null>
  assistantTextRef: MutableRefObject<string>
  reasoningRef: MutableRefObject<string>
}

export interface SSEStreamSetters {
  setMessages: Dispatch<SetStateAction<UIMessage[]>>
  setIsStreaming: Dispatch<SetStateAction<boolean>>
  onStatusChange?: (status: AgentStatus, currentTool?: string) => void
}

export async function readSSEStream(
  body: ReadableStream<Uint8Array>,
  refs: SSEStreamRefs,
  setters: SSEStreamSetters,
): Promise<void> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let rafId: number | null = null
  let pendingFlush = false
  const pendingEvents: Record<string, unknown>[] = []

  const clearStreamingRef = () => {
    refs.streamingMessageRef.current = null
  }

  function flushEvents() {
    rafId = null
    pendingFlush = false
    const events = pendingEvents.splice(0)
    if (events.length === 0) return

    const opts = {
      streamingMessageId: refs.streamingMessageRef.current!,
      assistantTextRef: refs.assistantTextRef,
      reasoningRef: refs.reasoningRef,
      setMessages: setters.setMessages,
      setIsStreaming: setters.setIsStreaming,
      clearStreamingRef,
      onStatusChange: setters.onStatusChange,
    }

    for (const data of events) {
      processStreamEvent(data, opts)
    }
  }

  function scheduleFlush() {
    if (!pendingFlush) {
      pendingFlush = true
      rafId = requestAnimationFrame(flushEvents)
    }
  }

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    buffer = parseSSELines(buffer, (data) => {
      pendingEvents.push(data)
      scheduleFlush()
    })
  }

  if (rafId !== null) cancelAnimationFrame(rafId)
  flushEvents()
}

export function mapApiMessageToUI(m: Message): UIMessage {
  return {
    id: m.id,
    role: m.role as UIMessage['role'],
    content: m.content,
    type: m.type as UIMessage['type'],
    errorCategory: m.errorCategory,
    retryable: m.retryable,
    createdAt: new Date(m.createdAt * 1000),
  }
}

export function handleWebSocketEvent(
  event: {
    type: string
    message?: Message | string
    prUrl?: string
    status?: string
    details?: string
    category?: 'transient' | 'persistent' | 'user-action' | 'fatal'
    retryable?: boolean
  },
  setMessages: Dispatch<SetStateAction<UIMessage[]>>,
  onStatusChange?: (status: AgentStatus, currentTool?: string) => void,
): void {
  if (event.type === 'message') {
    const msg = event.message as Message
    const uiMsg = mapApiMessageToUI(msg)
    setMessages((prev) => {
      const exists = prev.some((m) => m.id === uiMsg.id)
      return exists ? prev : [...prev, uiMsg]
    })
  } else if (event.type === 'error') {
    const content = typeof event.message === 'string' ? event.message : 'An error occurred'
    const { category, retryable } = classifyError(content)
    setMessages((prev) => [...prev, createErrorMessage(content, event.category || category, retryable)])
    onStatusChange?.('error')
  } else if (event.type === 'pr-created') {
    setMessages((prev) => [...prev, createSystemMessage(`Draft PR created: ${event.prUrl}`, 'pr-notification')])
  } else if (event.type === 'agent-status') {
    onStatusChange?.(event.status as AgentStatus, event.details)
  }
}
