'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { MessageList, type Message } from './message-list'
import { ChatInput } from './chat-input'
import { createReconnectingWebSocket, type WebSocketStatus } from '@/lib/websocket'
import { sendChatMessage, getChatMessages, stopChatStream } from '@/lib/api'
import type { AgentStatus } from '@/components/session/status-indicator'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8787'

interface ChatInterfaceProps {
  sessionId: string
  onStatusChange?: (status: AgentStatus, currentTool?: string) => void
}

export function ChatInterface({ sessionId, onStatusChange }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [messageQueue, setMessageQueue] = useState<string[]>([])
  const [wsStatus, setWsStatus] = useState<WebSocketStatus>('disconnected')
  const [hasMore, setHasMore] = useState(false)
  const wsRef = useRef<ReturnType<typeof createReconnectingWebSocket> | null>(null)
  const streamingMessageRef = useRef<string | null>(null)

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
          message?: Message
          messageId?: string
          parts?: string
        }

        if (event.type === 'message') {
          // New message from another client or server
          setMessages((prev) => {
            const exists = prev.some((m) => m.id === event.message?.id)
            if (exists) return prev
            return [...prev, event.message!]
          })
        }

        if (event.type === 'message-parts') {
          // Update streaming message parts
          setMessages((prev) => prev.map((m) => (m.id === event.messageId ? { ...m, parts: event.parts } : m)))
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
                  setIsStreaming(false)
                  streamingMessageRef.current = null
                  onStatusChange?.('idle')
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

  return (
    <div className="flex h-full flex-col bg-white dark:bg-gray-900">
      {/* Connection status indicator */}
      {wsStatus !== 'connected' && (
        <div className="bg-yellow-100 px-4 py-2 text-sm text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
          {wsStatus === 'connecting' ? 'Connecting...' : 'Disconnected - Reconnecting...'}
        </div>
      )}

      <MessageList messages={messages} isStreaming={isStreaming} onLoadEarlier={handleLoadEarlier} hasMore={hasMore} />

      <ChatInput onSend={handleSend} onStop={handleStop} isStreaming={isStreaming} queueCount={messageQueue.length} />
    </div>
  )
}
