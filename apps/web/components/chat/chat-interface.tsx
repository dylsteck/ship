'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { AIMessageList } from './ai-message-list'
import { EnhancedPromptInput } from './enhanced-prompt-input'
import { createReconnectingWebSocket, type WebSocketStatus } from '@/lib/websocket'
import { getChatMessages, stopChatStream } from '@/lib/api'
import type { AgentStatus } from '@/components/session/status-indicator'
import { parseSSEEvent } from '@/lib/sse-parser'
import type { ToolPart as SSEToolPart, ReasoningPart } from '@/lib/sse-types'
import {
  type UIMessage,
  processPartUpdated,
  createUserMessage,
  createAssistantPlaceholder,
  createErrorMessage,
  createSystemMessage,
  classifyError,
  extractStepCost,
  getStreamingStatus,
} from '@/lib/ai-elements-adapter'
import type { Message } from '@/lib/api'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8787'

interface ChatInterfaceProps {
  sessionId: string
  onStatusChange?: (status: AgentStatus, currentTool?: string) => void
  onOpenVSCode?: () => void
  onOpenTerminal?: () => void
  onOpenCodeUrl?: (url: string) => void
  initialPrompt?: string | null
  initialMode?: 'build' | 'plan'
  agentStatus?: AgentStatus
  currentTool?: string
  sessionInfo?: {
    repoOwner?: string
    repoName?: string
    branch?: string
    model?: string
    modelName?: string
  }
  sandboxId?: string | null
  sandboxStatus?: 'provisioning' | 'ready' | 'error' | 'none'
  opencodeUrl?: string | null
  opencodeSessionId?: string | null
}

export function ChatInterface({
  sessionId,
  onStatusChange,
  onOpenVSCode,
  onOpenTerminal,
  onOpenCodeUrl,
  initialPrompt,
  initialMode = 'build',
  agentStatus,
  currentTool,
}: ChatInterfaceProps) {
  const [messages, setMessages] = useState<UIMessage[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [messageQueue, setMessageQueue] = useState<string[]>([])
  const [wsStatus, setWsStatus] = useState<WebSocketStatus>('disconnected')
  const [hasMore, setHasMore] = useState(false)

  const wsRef = useRef<ReturnType<typeof createReconnectingWebSocket> | null>(null)
  const streamingMessageRef = useRef<string | null>(null)
  const assistantTextRef = useRef('')
  const reasoningRef = useRef('')
  const initialPromptSentRef = useRef(false)

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
          messageId?: string
          parts?: string
          category?: 'transient' | 'persistent' | 'user-action' | 'fatal'
          retryable?: boolean
          prUrl?: string
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
            if (exists) return prev
            return [...prev, uiMsg]
          })
        }

        if (event.type === 'error') {
          const content = typeof event.message === 'string' ? event.message : 'An error occurred'
          const { category, retryable } = classifyError(content)
          setMessages((prev) => [...prev, createErrorMessage(content, event.category || category, retryable)])
          onStatusChange?.('error')
        }

        if (event.type === 'pr-created') {
          setMessages((prev) => [
            ...prev,
            createSystemMessage(`Draft PR created: ${event.prUrl}`, 'pr-notification'),
          ])
        }

        if (event.type === 'agent-status') {
          onStatusChange?.((event as { status?: string }).status as AgentStatus, (event as { details?: string }).details)
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
    async (content: string, modeOverride?: 'build' | 'plan') => {
      if (isStreaming) {
        setMessageQueue((q) => [...q, content])
        return
      }

      setIsStreaming(true)
      onStatusChange?.('planning')
      assistantTextRef.current = ''
      reasoningRef.current = ''

      // Add user message
      const userMessage = createUserMessage(content)
      setMessages((prev) => [...prev, userMessage])

      // Create assistant placeholder
      const assistantMessage = createAssistantPlaceholder()
      streamingMessageRef.current = assistantMessage.id
      setMessages((prev) => [...prev, assistantMessage])

      try {
        const fetchUrl = `${API_URL}/chat/${encodeURIComponent(sessionId)}`
        const response = await fetch(fetchUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'text/event-stream',
          },
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

        if (!response.body) {
          throw new Error('No response body')
        }

        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const chunk = decoder.decode(value, { stream: true })
          buffer += chunk
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''

          let currentEventType = ''
          for (const line of lines) {
            if (line.startsWith('event: ')) {
              currentEventType = line.slice(7).trim()
              continue
            }
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6))
                if (!data.type && currentEventType) {
                  data.type = currentEventType
                }

                if (data.type === 'message.part.updated') {
                  const part = data.properties?.part
                  const delta = data.properties?.delta

                  if (part) {
                    setMessages((prev) =>
                      processPartUpdated(part, delta, streamingMessageRef.current!, prev, assistantTextRef, reasoningRef),
                    )

                    // Status updates
                    if (part.type === 'text') {
                      onStatusChange?.('coding', 'Writing response...')
                    } else if (part.type === 'tool') {
                      const toolName = part.tool?.toLowerCase() || ''
                      let status: AgentStatus = 'coding'
                      if (toolName.includes('read') || toolName.includes('search') || toolName.includes('glob') || toolName.includes('grep')) {
                        status = 'planning'
                      } else if (toolName.includes('run') || toolName.includes('exec') || toolName.includes('bash')) {
                        status = 'executing'
                      }
                      onStatusChange?.(status, part.tool)
                    } else if (part.type === 'reasoning') {
                      onStatusChange?.('planning', 'Reasoning...')
                    }
                  }
                }

                if (data.type === 'done' || data.type === 'session.idle') {
                  setIsStreaming(false)
                  streamingMessageRef.current = null
                  onStatusChange?.('idle')
                }

                if (data.type === 'assistant') {
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === streamingMessageRef.current
                        ? { ...m, content: data.content, id: data.id || m.id }
                        : m,
                    ),
                  )
                }

                if (data.error) {
                  const errorContent = typeof data.error === 'string' ? data.error : 'An error occurred'
                  const { category, retryable } = classifyError(errorContent)
                  setMessages((prev) => [...prev, createErrorMessage(errorContent, data.category || category, retryable)])
                  setIsStreaming(false)
                  streamingMessageRef.current = null
                  onStatusChange?.('error')
                }

                if (data.prUrl) {
                  setMessages((prev) => [
                    ...prev,
                    createSystemMessage(`Draft PR created: ${data.prUrl}`, 'pr-notification'),
                  ])
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
    [sessionId, isStreaming, initialMode, onStatusChange],
  )

  useEffect(() => {
    if (!initialPrompt || initialPromptSentRef.current) return
    initialPromptSentRef.current = true
    handleSend(initialPrompt, initialMode)
  }, [initialPrompt, initialMode, handleSend])

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

  // Generate streaming label
  const streamingLabel = isStreaming
    ? (() => {
        const labelMap: Record<AgentStatus, string> = {
          idle: 'Thinking',
          planning: 'Planning',
          coding: 'Coding',
          testing: 'Testing',
          executing: 'Executing',
          stuck: 'Stuck',
          waiting: 'Waiting',
          error: 'Error',
        }
        const base = agentStatus ? labelMap[agentStatus] : 'Thinking'
        return currentTool ? `${base} · ${currentTool}` : `${base}...`
      })()
    : undefined

  return (
    <div className="flex h-full flex-col bg-white dark:bg-background">
      {/* Connection status indicator */}
      {wsStatus !== 'connected' && (
        <div className="bg-yellow-50 border-b border-yellow-200 px-4 py-2 text-sm text-yellow-800 dark:bg-yellow-900/20 dark:border-yellow-800 dark:text-yellow-200">
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-1.5 rounded-full bg-yellow-500 animate-pulse"></div>
            {wsStatus === 'connecting' ? 'Connecting...' : 'Disconnected - Reconnecting...'}
          </div>
        </div>
      )}

      {/* Message List */}
      <AIMessageList
        messages={messages}
        isStreaming={isStreaming}
        streamingMessageId={streamingMessageRef.current}
        streamingLabel={streamingLabel}
        onRetryError={handleRetryError}
        onOpenVSCode={onOpenVSCode}
        onOpenTerminal={onOpenTerminal}
      />

      {/* Input Area */}
      <div className="border-t bg-white dark:bg-background p-4">
        <div className="max-w-3xl mx-auto">
          <EnhancedPromptInput
            onSend={handleSend}
            isStreaming={isStreaming}
            queueCount={messageQueue.length}
            onStop={handleStop}
          />
        </div>
      </div>
    </div>
  )
}
