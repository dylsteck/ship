'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { createReconnectingWebSocket, type WebSocketStatus } from '@/lib/websocket'
import { getChatMessages, stopChatStream } from '@/lib/api'
import type { AgentStatus } from '@/components/session/status-indicator'
import {
  type UIMessage,
  createUserMessage,
  createAssistantPlaceholder,
  createErrorMessage,
  createSystemMessage,
  classifyError,
} from '@/lib/ai-elements-adapter'
import type { Message } from '@/lib/api'
import { API_URL } from '@/lib/config'
import { processStreamEvent, parseSSELines } from './stream-processor'

interface UseChatStreamOptions {
  sessionId: string
  initialMode?: string
  onStatusChange?: (status: AgentStatus, currentTool?: string) => void
}

export function useChatStream({ sessionId, initialMode = 'build', onStatusChange }: UseChatStreamOptions) {
  const [messages, setMessages] = useState<UIMessage[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [messageQueue, setMessageQueue] = useState<string[]>([])
  const [wsStatus, setWsStatus] = useState<WebSocketStatus>('disconnected')
  const [hasMore, setHasMore] = useState(false)

  const wsRef = useRef<ReturnType<typeof createReconnectingWebSocket> | null>(null)
  const streamingMessageRef = useRef<string | null>(null)
  const assistantTextRef = useRef('')
  const reasoningRef = useRef('')

  // Load initial messages
  useEffect(() => {
    async function loadMessages() {
      try {
        const msgs = await getChatMessages(sessionId, { limit: 25 })
        const uiMessages: UIMessage[] = msgs.map((m: Message) => ({
          id: m.id,
          role: m.role as UIMessage['role'],
          content: m.content,
          type: m.type as UIMessage['type'],
          errorCategory: m.errorCategory,
          retryable: m.retryable,
          createdAt: new Date(m.createdAt * 1000),
        }))
        setMessages(uiMessages)
        setHasMore(msgs.length === 25)
      } catch (err) {
        console.error('Failed to load messages:', err)
      }
    }
    loadMessages()
  }, [sessionId])

  // Connect WebSocket for real-time updates
  useEffect(() => {
    const wsUrl = `${API_URL.replace('http', 'ws')}/sessions/${sessionId}/websocket`

    wsRef.current = createReconnectingWebSocket({
      url: wsUrl,
      onMessage: (data: unknown) => {
        const event = data as {
          type: string
          message?: Message | string
          prUrl?: string
          status?: string
          details?: string
          category?: 'transient' | 'persistent' | 'user-action' | 'fatal'
          retryable?: boolean
        }

        if (event.type === 'message') {
          const msg = event.message as Message
          const uiMsg: UIMessage = {
            id: msg.id,
            role: msg.role as UIMessage['role'],
            content: msg.content,
            createdAt: new Date(msg.createdAt * 1000),
          }
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
      },
      onStatusChange: setWsStatus,
    })

    return () => wsRef.current?.disconnect()
  }, [sessionId, onStatusChange])

  // Process queued messages when streaming completes
  useEffect(() => {
    if (!isStreaming && messageQueue.length > 0) {
      const [next, ...rest] = messageQueue
      setMessageQueue(rest)
      handleSend(next)
    }
  }, [isStreaming, messageQueue])

  const handleSend = useCallback(
    async (content: string, modeOverride?: string) => {
      if (isStreaming) {
        setMessageQueue((q) => [...q, content])
        return
      }

      setIsStreaming(true)
      onStatusChange?.('planning')
      assistantTextRef.current = ''
      reasoningRef.current = ''

      const userMessage = createUserMessage(content)
      const assistantMessage = createAssistantPlaceholder()
      streamingMessageRef.current = assistantMessage.id
      setMessages((prev) => [...prev, userMessage, assistantMessage])

      try {
        const response = await fetch(`${API_URL}/chat/${encodeURIComponent(sessionId)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
          body: JSON.stringify({ content, mode: modeOverride ?? initialMode }),
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
          const errorContent = errorData.error || 'Failed to start agent'
          const { category, retryable } = classifyError(errorContent)
          setMessages((prev) => {
            const filtered = prev.filter((m) => m.id !== streamingMessageRef.current)
            return [...filtered, createErrorMessage(errorContent, category, retryable)]
          })
          setIsStreaming(false)
          streamingMessageRef.current = null
          onStatusChange?.('error')
          return
        }

        if (!response.body) throw new Error('No response body')

        await readSSEStream(response.body)
      } catch (err) {
        console.error('Chat error:', err)
        setIsStreaming(false)
        streamingMessageRef.current = null
        onStatusChange?.('error')
      }
    },
    [sessionId, isStreaming, initialMode, onStatusChange],
  )

  async function readSSEStream(body: ReadableStream<Uint8Array>) {
    const reader = body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      buffer = parseSSELines(buffer, (data) => {
        processStreamEvent(data, {
          streamingMessageId: streamingMessageRef.current!,
          assistantTextRef,
          reasoningRef,
          setMessages,
          setIsStreaming,
          clearStreamingRef: () => { streamingMessageRef.current = null },
          onStatusChange,
        })
      })
    }
  }

  const handleStop = useCallback(async () => {
    try {
      await stopChatStream(sessionId)
    } catch {
      // Ignore stop errors
    }
    setIsStreaming(false)
    streamingMessageRef.current = null
    onStatusChange?.('idle')
  }, [sessionId, onStatusChange])

  const handleRetryError = useCallback(
    async (messageId: string) => {
      setMessages((prev) => prev.filter((m) => m.id !== messageId))
      try {
        await fetch(`${API_URL}/sessions/${sessionId}/retry`, { method: 'POST' })
      } catch (err) {
        console.error('Retry failed:', err)
      }
    },
    [sessionId],
  )

  return {
    messages,
    isStreaming,
    messageQueue,
    wsStatus,
    hasMore,
    streamingMessageId: streamingMessageRef.current,
    handleSend,
    handleStop,
    handleRetryError,
  }
}
