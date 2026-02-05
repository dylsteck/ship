'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { AIMessageList } from './ai-message-list'
import { EnhancedPromptInput } from './enhanced-prompt-input'
import { createReconnectingWebSocket, type WebSocketStatus } from '@/lib/websocket'
import { sendChatMessage, getChatMessages, stopChatStream } from '@/lib/api'
import type { AgentStatus } from '@/components/session/status-indicator'
import { aggregateCosts, type CostBreakdown } from '@/lib/cost-tracker'
import { parseSSEEvent, extractCostInfo } from '@/lib/sse-parser'
import type { ToolPart as SSEToolPart, StepFinishPart, ReasoningPart, TextPart } from '@/lib/sse-types'
import {
  adaptToolPart,
  adaptReasoningPart,
  buildChainOfThoughtSteps,
  type ChainOfThoughtStep,
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
  const [messages, setMessages] = useState<Message[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [messageQueue, setMessageQueue] = useState<string[]>([])
  const [wsStatus, setWsStatus] = useState<WebSocketStatus>('disconnected')
  const [hasMore, setHasMore] = useState(false)

  // AI Elements state
  const [streamingText, setStreamingText] = useState('')
  const [currentReasoning, setCurrentReasoning] = useState('')
  const [currentSteps, setCurrentSteps] = useState<ChainOfThoughtStep[]>([])

  // Activity tracking
  const [activityTools, setActivityTools] = useState<SSEToolPart[]>([])
  const [reasoningParts, setReasoningParts] = useState<ReasoningPart[]>([])
  const [streamStartTime, setStreamStartTime] = useState<number | null>(null)

  const wsRef = useRef<ReturnType<typeof createReconnectingWebSocket> | null>(null)
  const streamingMessageRef = useRef<string | null>(null)
  const assistantTextRef = useRef('')
  const initialPromptSentRef = useRef(false)
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
          prUrl?: string
          prNumber?: number
          status?: string
          details?: string
        }

        if (event.type === 'message') {
          const msg = event.message as Message
          setMessages((prev) => {
            const exists = prev.some((m) => m.id === msg?.id)
            if (exists) return prev
            return [...prev, msg]
          })
        }

        if (event.type === 'message-parts') {
          setMessages((prev) => prev.map((m) => (m.id === event.messageId ? { ...m, parts: event.parts } : m)))
        }

        if (event.type === 'error') {
          let errorContent = typeof event.message === 'string' ? event.message : 'An error occurred'
          let errorCategory: 'transient' | 'persistent' | 'user-action' | 'fatal' = 'persistent'
          let retryable = event.retryable || false

          if (errorContent.includes('credit balance') || errorContent.includes('Anthropic API')) {
            errorCategory = 'user-action'
            retryable = false
          } else if (errorContent.includes('rate limit') || errorContent.includes('too many requests')) {
            errorCategory = 'transient'
            retryable = true
          } else if (
            errorContent.includes('network') ||
            errorContent.includes('connection') ||
            errorContent.includes('timeout')
          ) {
            errorCategory = 'transient'
            retryable = true
          }

          const errorMessage: Message = {
            id: `error-${Date.now()}`,
            role: 'system',
            content: errorContent,
            type: 'error',
            errorCategory: event.category || errorCategory,
            retryable: retryable,
            createdAt: Math.floor(Date.now() / 1000),
          }
          setMessages((prev) => [...prev, errorMessage])
          onStatusChange?.('error')
        }

        if (event.type === 'pr-created') {
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
    async (content: string, modeOverride?: 'build' | 'plan') => {
      if (isStreaming) {
        setMessageQueue((q) => [...q, content])
        return
      }

      setIsStreaming(true)
      onStatusChange?.('planning')
      assistantTextRef.current = ''

      // Reset AI Elements state
      setStreamingText('')
      setCurrentReasoning('')
      setCurrentSteps([])
      setActivityTools([])
      setReasoningParts([])
      setStreamStartTime(Date.now())

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
          let errorContent = errorData.error || 'Failed to start agent'
          let errorCategory: 'transient' | 'persistent' | 'user-action' | 'fatal' = 'persistent'
          let retryable = false

          if (errorContent.includes('credit balance') || errorContent.includes('Anthropic API')) {
            errorCategory = 'user-action'
          } else if (errorContent.includes('rate limit') || errorContent.includes('too many requests')) {
            errorCategory = 'transient'
            retryable = true
          } else if (response.status >= 500) {
            errorCategory = 'transient'
            retryable = true
          }

          const errorMessage: Message = {
            id: `error-${Date.now()}`,
            role: 'system',
            content: errorContent,
            type: 'error',
            errorCategory: errorCategory,
            retryable: retryable,
            createdAt: Math.floor(Date.now() / 1000),
          }
          setMessages((prev) => {
            const filtered = prev.filter((m) => m.id !== streamingMessageRef.current)
            return [...filtered, errorMessage]
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
        costEventsRef.current = []

        while (true) {
          const { done, value } = await reader.read()

          if (done) {
            break
          }

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

                // Handle text parts for streaming content
                if (data.type === 'message.part.updated') {
                  const part = data.properties?.part
                  const delta = data.properties?.delta

                  if (part?.type === 'text') {
                    if (typeof delta === 'string') {
                      assistantTextRef.current += delta
                      setStreamingText(assistantTextRef.current)
                    } else if (typeof part.text === 'string') {
                      assistantTextRef.current = part.text
                      setStreamingText(assistantTextRef.current)
                    }

                    setMessages((prev) =>
                      prev.map((m) =>
                        m.id === streamingMessageRef.current ? { ...m, content: assistantTextRef.current } : m,
                      ),
                    )
                    onStatusChange?.('coding', 'Writing response...')
                  } else if (part?.type === 'tool') {
                    // Handle tool parts
                    const toolPart = part as SSEToolPart
                    const adapted = adaptToolPart(toolPart)

                    setActivityTools((prev) => {
                      const existing = prev.findIndex((t) => t.callID === toolPart.callID)
                      if (existing >= 0) {
                        return prev.map((t, i) => (i === existing ? toolPart : t))
                      }
                      return [...prev, toolPart]
                    })

                    // Update chain of thought steps
                    setCurrentSteps(buildChainOfThoughtSteps([...activityTools, toolPart], reasoningParts))

                    // Update status based on tool type
                    let status: AgentStatus = 'coding'
                    if (
                      adapted.name.includes('read') ||
                      adapted.name.includes('search') ||
                      adapted.name.includes('glob') ||
                      adapted.name.includes('grep')
                    ) {
                      status = 'planning'
                    } else if (
                      adapted.name.includes('run') ||
                      adapted.name.includes('exec') ||
                      adapted.name.includes('bash')
                    ) {
                      status = 'executing'
                    }
                    onStatusChange?.(status, adapted.name)
                  } else if (part?.type === 'reasoning') {
                    // Handle reasoning parts
                    const reasoningPart = part as ReasoningPart
                    const adapted = adaptReasoningPart(reasoningPart)

                    setCurrentReasoning((prev) => {
                      return prev ? `${prev}\n\n${adapted.text}` : adapted.text
                    })

                    setReasoningParts((prev) => [...prev, reasoningPart])

                    // Update chain of thought
                    setCurrentSteps(buildChainOfThoughtSteps(activityTools, [...reasoningParts, reasoningPart]))
                    onStatusChange?.('planning', 'Reasoning...')
                  } else if (part?.type === 'step-finish') {
                    const event = parseSSEEvent(data)
                    if (event) {
                      const costInfo = extractCostInfo(event)
                      if (costInfo) {
                        // Cost info available
                      }
                    }
                  }
                }

                // Handle session status events
                if (data.type === 'session.status') {
                  const status = typeof data.properties?.status === 'string' ? data.properties.status : ''
                  if (status) {
                    let agentStatus: AgentStatus = 'planning'
                    if (status.includes('running') || status.includes('executing')) {
                      agentStatus = 'executing'
                    } else if (status.includes('thinking') || status.includes('planning')) {
                      agentStatus = 'planning'
                    }
                    onStatusChange?.(agentStatus, status)
                  }
                }

                // Handle done/session.idle
                if (data.type === 'done' || data.type === 'session.idle') {
                  // Persist completed tools and reasoning onto the assistant message
                  if (streamingMessageRef.current) {
                    const messageId = streamingMessageRef.current
                    const completedTools = activityTools.map((t) => {
                      const adapted = adaptToolPart(t)
                      return adapted
                    })
                    const completedReasoning = reasoningParts.map((r) => adaptReasoningPart(r))

                    setMessages((prev) =>
                      prev.map((m) =>
                        m.id === messageId
                          ? {
                              ...m,
                              inlineTools: completedTools.length > 0 ? completedTools : undefined,
                              reasoningBlocks: completedReasoning.length > 0 ? completedReasoning : undefined,
                            }
                          : m,
                      ),
                    )

                    // Aggregate costs
                    if (costEventsRef.current.length > 0) {
                      const breakdowns = aggregateCosts(costEventsRef.current)
                      if (breakdowns.length > 0) {
                        messageCostsRef.current.set(messageId, breakdowns[0])
                      }
                    }
                  }

                  costEventsRef.current = []
                  setIsStreaming(false)
                  streamingMessageRef.current = null

                  // Clear AI Elements streaming state
                  setStreamingText('')
                  setCurrentReasoning('')
                  setCurrentSteps([])
                  setActivityTools([])
                  setReasoningParts([])
                  onStatusChange?.('idle')
                }

                // Handle assistant message finalization
                if (data.type === 'assistant') {
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === streamingMessageRef.current ? { ...m, content: data.content, id: data.id || m.id } : m,
                    ),
                  )
                }

                // Handle errors
                if (data.error) {
                  let errorContent = data.error
                  let errorCategory: 'transient' | 'persistent' | 'user-action' | 'fatal' =
                    data.category || 'persistent'
                  let retryable = data.retryable || false

                  if (errorContent.includes('credit balance') || errorContent.includes('Anthropic API')) {
                    errorCategory = 'user-action'
                    retryable = false
                  } else if (errorContent.includes('rate limit') || errorContent.includes('too many requests')) {
                    errorCategory = 'transient'
                    retryable = true
                  }

                  const errorMessage: Message = {
                    id: `error-${Date.now()}`,
                    role: 'system',
                    content: errorContent,
                    type: 'error',
                    errorCategory: errorCategory,
                    retryable: retryable,
                    createdAt: Math.floor(Date.now() / 1000),
                  }
                  setMessages((prev) => [...prev, errorMessage])
                  setIsStreaming(false)
                  streamingMessageRef.current = null
                  onStatusChange?.('error')
                }

                // Handle PR creation
                if (data.prUrl) {
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
    [sessionId, isStreaming, initialMode, activityTools, reasoningParts, onStatusChange],
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
    setStreamingText('')
    setCurrentReasoning('')
    setCurrentSteps([])
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
      const errorMsg = messages.find((m) => m.id === messageId)
      if (!errorMsg) return

      setMessages((prev) => prev.filter((m) => m.id !== messageId))

      try {
        await fetch(`${API_URL}/sessions/${sessionId}/retry`, {
          method: 'POST',
        })
      } catch (err) {
        console.error('Retry failed:', err)
        setMessages((prev) => [...prev, errorMsg])
      }
    },
    [sessionId, messages],
  )

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
        messages={messages.map((m) => ({
          id: m.id,
          role: m.role as 'user' | 'assistant',
          content: m.content,
          inlineTools: m.inlineTools,
          reasoningBlocks: m.reasoningBlocks,
          error:
            m.type === 'error'
              ? {
                  message: m.content,
                  category: m.errorCategory,
                  retryable: m.retryable,
                }
              : undefined,
        }))}
        isStreaming={isStreaming}
        streamingText={streamingText}
        currentReasoning={currentReasoning}
        currentSteps={currentSteps}
        streamingTools={activityTools.map((t) => {
          const adapted = adaptToolPart(t)
          return {
            callID: t.callID,
            name: adapted.name,
            status: adapted.status,
            input: adapted.input,
            output: typeof adapted.output === 'string' ? adapted.output : undefined,
            duration: adapted.duration,
          }
        })}
        streamingLabel={
          isStreaming
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
        }
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
