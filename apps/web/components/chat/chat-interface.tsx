'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { MessageList, type Message } from './message-list'
import { ChatInput } from './chat-input'
import { createReconnectingWebSocket, type WebSocketStatus } from '@/lib/websocket'
import { sendChatMessage, getChatMessages, stopChatStream } from '@/lib/api'
import type { AgentStatus } from '@/components/session/status-indicator'
import { aggregateCosts, type CostBreakdown } from '@/lib/cost-tracker'
import { CostBreakdown as CostBreakdownComponent } from '@/components/cost/cost-breakdown'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8787'

interface ChatInterfaceProps {
  sessionId: string
  onStatusChange?: (status: AgentStatus, currentTool?: string) => void
  onOpenVSCode?: () => void
  onOpenTerminal?: () => void
}

export function ChatInterface({ sessionId, onStatusChange, onOpenVSCode, onOpenTerminal }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [messageQueue, setMessageQueue] = useState<string[]>([])
  const [wsStatus, setWsStatus] = useState<WebSocketStatus>('disconnected')
  const [hasMore, setHasMore] = useState(false)
  const wsRef = useRef<ReturnType<typeof createReconnectingWebSocket> | null>(null)
  const streamingMessageRef = useRef<string | null>(null)
  const costEventsRef = useRef<Array<{ type: string; [key: string]: unknown }>>([])
  const messageCostsRef = useRef<Map<string, CostBreakdown>>(new Map())

  // Load initial messages
  useEffect(() => {
    async function loadMessages() {
      try {
        const msgs = await getChatMessages(sessionId, { limit: 25 })
        setMessages(msgs)
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
          messageId?: string
          parts?: string
          category?: 'transient' | 'persistent' | 'user-action' | 'fatal'
          retryable?: boolean
        }

        if (event.type === 'message') {
          // New message from another client or server
          const msg = event.message as Message
          setMessages((prev) => {
            const exists = prev.some((m) => m.id === msg?.id)
            if (exists) return prev
            return [...prev, msg]
          })
        }

        if (event.type === 'message-parts') {
          // Update streaming message parts
          setMessages((prev) => prev.map((m) => (m.id === event.messageId ? { ...m, parts: event.parts } : m)))
        }

        if (event.type === 'error') {
          // Error event from agent execution
          const errorMessage: Message = {
            id: `error-${Date.now()}`,
            role: 'system',
            content: typeof event.message === 'string' ? event.message : 'An error occurred',
            type: 'error',
            errorCategory: event.category || 'persistent',
            retryable: event.retryable || false,
            createdAt: Math.floor(Date.now() / 1000),
          }
          setMessages((prev) => [...prev, errorMessage])

          // Update status to error
          onStatusChange?.('error')
        }

        if (event.type === 'pr-created') {
          // PR created notification
          const prMessage: Message = {
            id: `pr-${Date.now()}`,
            role: 'system',
            content: `Draft PR created: ${event.prUrl}`,
            type: 'pr-notification',
            createdAt: Math.floor(Date.now() / 1000),
          }
          setMessages((prev) => [...prev, prMessage])
        }

        if (event.type === 'agent-status') {
          // Agent status update
          onStatusChange?.(event.status as AgentStatus, event.details)
        }
      },
      onStatusChange: setWsStatus,
    })

    return () => wsRef.current?.disconnect()
  }, [sessionId])

  // Process queued messages when streaming completes
  useEffect(() => {
    if (!isStreaming && messageQueue.length > 0) {
      const [next, ...rest] = messageQueue
      setMessageQueue(rest)
      handleSend(next)
    }
  }, [isStreaming, messageQueue])

  const handleSend = useCallback(
    async (content: string) => {
      if (isStreaming) {
        // Queue message per CONTEXT.md: "message queuing available"
        setMessageQueue((q) => [...q, content])
        return
      }

      setIsStreaming(true)
      onStatusChange?.('planning')

      // Optimistically add user message
      const userMessage: Message = {
        id: `temp-${Date.now()}`,
        role: 'user',
        content,
        createdAt: Math.floor(Date.now() / 1000),
      }
      setMessages((prev) => [...prev, userMessage])

      // Create placeholder for assistant message
      const assistantId = `temp-assistant-${Date.now()}`
      streamingMessageRef.current = assistantId
      const assistantMessage: Message = {
        id: assistantId,
        role: 'assistant',
        content: '',
        parts: undefined,
        createdAt: Math.floor(Date.now() / 1000),
      }
      setMessages((prev) => [...prev, assistantMessage])

      try {
        const response = await sendChatMessage(sessionId, content)

        if (!response.body) {
          throw new Error('No response body')
        }

        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''
        // Reset cost events for this message
        costEventsRef.current = []

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6))

                if (data.type === 'assistant') {
                  // Update assistant message with final content
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === streamingMessageRef.current ? { ...m, content: data.content, id: data.id || m.id } : m,
                    ),
                  )
                }

                if (data.type === 'done') {
                  // Aggregate costs and store for this message
                  if (costEventsRef.current.length > 0 && streamingMessageRef.current) {
                    const breakdowns = aggregateCosts(costEventsRef.current)
                    if (breakdowns.length > 0) {
                      // Store cost breakdown for this message
                      const messageId = streamingMessageRef.current
                      messageCostsRef.current.set(messageId, breakdowns[0])
                      // Update message to include cost data
                      setMessages((prev) =>
                        prev.map((m) =>
                          m.id === messageId
                            ? { ...m, costBreakdown: breakdowns[0] } as Message & { costBreakdown?: CostBreakdown }
                            : m,
                        ),
                      )
                    }
                  }
                  costEventsRef.current = []
                  setIsStreaming(false)
                  streamingMessageRef.current = null
                  onStatusChange?.('idle')
                }

                // Track token events for cost calculation
                if (data.type === 'tool-call' && (data.tokens || data.model)) {
                  costEventsRef.current.push({
                    type: 'tool-call',
                    tokens: data.tokens,
                    model: data.model,
                    taskId: data.taskId || data.messageId || streamingMessageRef.current,
                    messageId: streamingMessageRef.current,
                  })
                }

                if (data.type === 'tool-call' && data.toolName) {
                  // Map tool names to high-level status
                  let status: AgentStatus = 'coding'
                  if (data.toolName.includes('plan') || data.toolName.includes('think')) {
                    status = 'planning'
                  } else if (data.toolName.includes('test') || data.toolName.includes('run')) {
                    status = 'testing'
                  }
                  onStatusChange?.(status, data.toolName)
                }

                if (data.error) {
                  // Error from SSE stream
                  const errorMessage: Message = {
                    id: `error-${Date.now()}`,
                    role: 'system',
                    content: data.error,
                    type: 'error',
                    errorCategory: data.category || 'persistent',
                    retryable: data.retryable || false,
                    createdAt: Math.floor(Date.now() / 1000),
                  }
                  setMessages((prev) => [...prev, errorMessage])
                  onStatusChange?.('error')
                }

                if (data.prUrl) {
                  // PR created notification
                  const prMessage: Message = {
                    id: `pr-${Date.now()}`,
                    role: 'system',
                    content: `Draft PR created: ${data.prUrl}`,
                    type: 'pr-notification',
                    createdAt: Math.floor(Date.now() / 1000),
                  }
                  setMessages((prev) => [...prev, prMessage])
                }
              } catch {
                // Ignore parse errors
              }
            }
          }
        }
      } catch (err) {
        console.error('Chat error:', err)
        setIsStreaming(false)
        streamingMessageRef.current = null
        onStatusChange?.('error')
      }
    },
    [sessionId, isStreaming],
  )

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

  const handleLoadEarlier = useCallback(async () => {
    if (messages.length === 0) return

    const firstMessage = messages[0]
    try {
      const earlier = await getChatMessages(sessionId, {
        limit: 25,
        before: firstMessage.id,
      })

      if (earlier.length < 25) setHasMore(false)
      setMessages((prev) => [...earlier, ...prev])
    } catch (err) {
      console.error('Failed to load earlier messages:', err)
    }
  }, [sessionId, messages])

  const handleRetryError = useCallback(
    async (messageId: string) => {
      // Find the error message to retry
      const errorMsg = messages.find((m) => m.id === messageId)
      if (!errorMsg) return

      // Remove the error message
      setMessages((prev) => prev.filter((m) => m.id !== messageId))

      // Call API to retry the failed operation
      try {
        await fetch(`${API_URL}/sessions/${sessionId}/retry`, {
          method: 'POST',
        })
      } catch (err) {
        console.error('Retry failed:', err)
        // Re-add error message if retry fails
        setMessages((prev) => [...prev, errorMsg])
      }
    },
    [sessionId, messages],
  )

  return (
    <div className="flex h-full flex-col bg-white dark:bg-gray-900">
      {/* Connection status indicator */}
      {wsStatus !== 'connected' && (
        <div className="bg-yellow-50 border-b border-yellow-200 px-4 py-2 text-sm text-yellow-800 dark:bg-yellow-900/20 dark:border-yellow-800 dark:text-yellow-200">
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-1.5 rounded-full bg-yellow-500 animate-pulse"></div>
            {wsStatus === 'connecting' ? 'Connecting...' : 'Disconnected - Reconnecting...'}
          </div>
        </div>
      )}

      <MessageList
        messages={messages}
        isStreaming={isStreaming}
        onLoadEarlier={handleLoadEarlier}
        hasMore={hasMore}
        onRetryError={handleRetryError}
        onOpenVSCode={onOpenVSCode}
        onOpenTerminal={onOpenTerminal}
      />

      <ChatInput onSend={handleSend} onStop={handleStop} isStreaming={isStreaming} queueCount={messageQueue.length} />
    </div>
  )
}
