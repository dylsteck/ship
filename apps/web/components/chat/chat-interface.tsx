'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { MessageList, type Message } from './message-list'
import { ChatInput } from './chat-input'
import { createReconnectingWebSocket, type WebSocketStatus } from '@/lib/websocket'
import { sendChatMessage, getChatMessages, stopChatStream } from '@/lib/api'
import type { AgentStatus } from '@/components/session/status-indicator'
import { aggregateCosts, type CostBreakdown } from '@/lib/cost-tracker'
import { CostBreakdown as CostBreakdownComponent } from '@/components/cost/cost-breakdown'
import { ThinkingIndicator, type ToolPart } from './thinking-indicator'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8787'

interface ChatInterfaceProps {
  sessionId: string
  onStatusChange?: (status: AgentStatus, currentTool?: string) => void
  onOpenVSCode?: () => void
  onOpenTerminal?: () => void
  initialPrompt?: string | null
  initialMode?: 'build' | 'plan'
  agentStatus?: AgentStatus
  currentTool?: string
}

export function ChatInterface({
  sessionId,
  onStatusChange,
  onOpenVSCode,
  onOpenTerminal,
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
  const [thinkingParts, setThinkingParts] = useState<ToolPart[]>([])
  const [thinkingReasoning, setThinkingReasoning] = useState<string>('')
  const [thinkingExpanded, setThinkingExpanded] = useState(true)
  const [thinkingStatus, setThinkingStatus] = useState<string>('')
  const wsRef = useRef<ReturnType<typeof createReconnectingWebSocket> | null>(null)
  const streamingMessageRef = useRef<string | null>(null)
  const assistantTextRef = useRef<string>('')
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
          let errorContent = typeof event.message === 'string' ? event.message : 'An error occurred'
          let errorCategory: 'transient' | 'persistent' | 'user-action' | 'fatal' = 'persistent'
          let retryable = event.retryable || false

          // Categorize errors better
          if (errorContent.includes('credit balance') || errorContent.includes('Anthropic API')) {
            errorCategory = 'user-action' // User needs to add credits
            retryable = false
          } else if (errorContent.includes('rate limit') || errorContent.includes('too many requests')) {
            errorCategory = 'transient' // Rate limit will reset
            retryable = true
          } else if (
            errorContent.includes('network') ||
            errorContent.includes('connection') ||
            errorContent.includes('timeout')
          ) {
            errorCategory = 'transient' // Network issues are usually temporary
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
    async (content: string, modeOverride?: 'build' | 'plan') => {
      if (isStreaming) {
        // Queue message per CONTEXT.md: "message queuing available"
        setMessageQueue((q) => [...q, content])
        return
      }

      setIsStreaming(true)
      onStatusChange?.('planning')
      assistantTextRef.current = ''
      setThinkingParts([])
      setThinkingReasoning('')
      setThinkingExpanded(true)
      setThinkingStatus('🚀 Starting...') // Set initial status so ThinkingIndicator renders

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
        console.log('[chat-interface] ========== STARTING CHAT REQUEST ==========')
        console.log('[chat-interface] Session ID:', sessionId)
        console.log('[chat-interface] Content:', content.slice(0, 100))
        console.log('[chat-interface] Mode:', modeOverride ?? initialMode)
        console.log('[chat-interface] API_URL:', API_URL)

        // Direct fetch to bypass any potential import issues
        const fetchUrl = `${API_URL}/chat/${encodeURIComponent(sessionId)}`
        console.log('[chat-interface] Fetching URL:', fetchUrl)

        const response = await fetch(fetchUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'text/event-stream',
          },
          body: JSON.stringify({ content, mode: modeOverride ?? initialMode }),
        })

        console.log('[chat-interface] ========== RESPONSE RECEIVED ==========')
        console.log('[chat-interface] Response OK:', response.ok)
        console.log('[chat-interface] Response status:', response.status)
        console.log('[chat-interface] Response statusText:', response.statusText)
        console.log('[chat-interface] Response type:', response.type)
        const headersObj = Object.fromEntries(response.headers.entries())
        console.log('[chat-interface] Response headers:', JSON.stringify(headersObj))
        console.log('[chat-interface] Response body exists:', !!response.body)
        console.log('[chat-interface] Response bodyUsed:', response.bodyUsed)

        // Alert to make it very visible
        if (typeof window !== 'undefined') {
          console.log('[chat-interface] 🚨 ALERT: Response received, status=' + response.status)
        }

        // Check for non-OK responses (500, etc.) before trying to read stream
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
          console.error('Chat request failed:', errorData)

          // Add error message to chat with better categorization
          let errorContent = errorData.error || 'Failed to start agent'
          let errorCategory: 'transient' | 'persistent' | 'user-action' | 'fatal' = 'persistent'
          let retryable = false

          // Categorize errors better
          if (errorContent.includes('credit balance') || errorContent.includes('Anthropic API')) {
            errorCategory = 'user-action' // User needs to add credits
          } else if (errorContent.includes('rate limit') || errorContent.includes('too many requests')) {
            errorCategory = 'transient' // Rate limit will reset
            retryable = true
          } else if (response.status >= 500) {
            errorCategory = 'transient' // Server errors are often temporary
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
            // Remove the empty assistant placeholder
            const filtered = prev.filter((m) => m.id !== streamingMessageRef.current)
            return [...filtered, errorMessage]
          })

          setIsStreaming(false)
          streamingMessageRef.current = null
          onStatusChange?.('error')
          return
        }

        if (!response.body) {
          console.error('[chat-interface] ❌ No response body!')
          throw new Error('No response body')
        }

        console.log('[chat-interface] ========== STARTING SSE STREAM READ ==========')
        console.log('[chat-interface] Getting reader from response.body...')
        const reader = response.body.getReader()
        console.log('[chat-interface] Reader obtained:', !!reader)

        const decoder = new TextDecoder()
        let buffer = ''
        let chunkCount = 0
        // Reset cost events for this message
        costEventsRef.current = []

        console.log('[chat-interface] Entering read loop...')
        while (true) {
          console.log(`[chat-interface] Calling reader.read() for chunk #${chunkCount + 1}...`)
          const { done, value } = await reader.read()
          chunkCount++

          if (done) {
            console.log('[chat-interface] ========== SSE STREAM ENDED ==========')
            console.log(`[chat-interface] Total chunks received: ${chunkCount}`)
            break
          }

          console.log(`[chat-interface] ✅ SSE chunk #${chunkCount} received:`, {
            done,
            valueLength: value?.length,
            valueType: typeof value,
          })

          const chunk = decoder.decode(value, { stream: true })
          console.log(`[chat-interface] 📦 Decoded chunk (first 300 chars): "${chunk.slice(0, 300)}"`)
          buffer += chunk
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6))
                console.log('[chat-interface] SSE event parsed:', data.type || data.status || 'unknown')

                // Handle status events for progress updates
                if (data.type === 'status') {
                  const statusMessage = data.message || 'Processing...'

                  // Update streaming label to show progress - always set thinkingStatus for visibility
                  if (data.status === 'initializing') {
                    onStatusChange?.('planning', statusMessage)
                    setThinkingStatus('🚀 ' + statusMessage)
                  } else if (data.status === 'provisioning') {
                    onStatusChange?.('planning', statusMessage)
                    setThinkingStatus('📦 ' + statusMessage)
                  } else if (data.status === 'sandbox-ready') {
                    onStatusChange?.('planning', statusMessage)
                    setThinkingStatus('✅ ' + statusMessage)
                  } else if (data.status === 'starting-opencode') {
                    onStatusChange?.('planning', 'Starting OpenCode server...')
                    setThinkingStatus('🔌 Starting agent server...')
                  } else if (data.status === 'cloning') {
                    onStatusChange?.('planning', statusMessage)
                    setThinkingStatus('📥 ' + statusMessage)
                  } else if (data.status === 'repo-ready') {
                    onStatusChange?.('planning', statusMessage)
                    setThinkingStatus('✅ ' + statusMessage)
                  } else if (data.status === 'creating-session') {
                    onStatusChange?.('planning', statusMessage)
                    setThinkingStatus('🔧 ' + statusMessage)
                  } else if (data.status === 'sending-prompt') {
                    onStatusChange?.('planning', statusMessage)
                    setThinkingStatus('📤 ' + statusMessage)
                  } else if (data.status === 'tool-call') {
                    // Show tool call in real-time
                    const toolLabel = data.toolTitle || data.toolName || 'Using tool'
                    onStatusChange?.('coding', toolLabel)
                    setThinkingStatus(`🔧 ${toolLabel}`)
                  } else if (data.status === 'agent-thinking') {
                    onStatusChange?.('planning', 'Agent is thinking...')
                    setThinkingStatus('💭 Thinking...')
                  } else if (data.status === 'agent-active') {
                    onStatusChange?.('planning', 'Agent is active')
                    setThinkingStatus('⚡ Processing...')
                  } else {
                    onStatusChange?.('planning', statusMessage)
                    setThinkingStatus(statusMessage)
                  }
                  continue
                }

                if (data.type === 'message.part.updated') {
                  const part = data.properties?.part
                  const delta = data.properties?.delta

                  console.log('[chat-interface] Received message.part.updated:', {
                    partType: part?.type,
                    toolName:
                      part?.type === 'tool' ? (typeof part.tool === 'string' ? part.tool : part.tool?.name) : undefined,
                    hasText: !!part?.text,
                    hasDelta: !!delta,
                  })

                  if (part?.type === 'text') {
                    if (typeof delta === 'string') {
                      assistantTextRef.current += delta
                    } else if (typeof part.text === 'string') {
                      assistantTextRef.current = part.text
                    }

                    setMessages((prev) =>
                      prev.map((m) =>
                        m.id === streamingMessageRef.current ? { ...m, content: assistantTextRef.current } : m,
                      ),
                    )

                    // Update status to show agent is writing
                    onStatusChange?.('coding', 'Writing response...')
                    setThinkingStatus('✍️ Writing...')
                  } else if (part?.type === 'tool') {
                    // Extract tool information
                    const toolName = typeof part.tool === 'string' ? part.tool : (part.tool as { name?: string })?.name
                    const callID = part.callID || part.id || `tool-${Date.now()}-${Math.random()}`

                    console.log('[chat-interface] Tool part:', { toolName, callID, status: part.state?.status })

                    if (toolName) {
                      // Update status with tool name
                      let status: AgentStatus = 'coding'
                      let statusLabel = toolName

                      if (
                        toolName.includes('read') ||
                        toolName.includes('search') ||
                        toolName.includes('glob') ||
                        toolName.includes('grep')
                      ) {
                        status = 'planning'
                        statusLabel = `🔍 ${toolName}`
                      } else if (toolName.includes('write') || toolName.includes('edit')) {
                        status = 'coding'
                        statusLabel = `✏️ ${toolName}`
                      } else if (toolName.includes('run') || toolName.includes('exec') || toolName.includes('bash')) {
                        status = 'executing'
                        statusLabel = `⚡ ${toolName}`
                      }

                      onStatusChange?.(status, toolName)
                      setThinkingStatus(statusLabel)

                      // Add to thinking parts for display
                      const toolPart: ToolPart = {
                        type: 'tool',
                        callID,
                        tool: toolName,
                        state: {
                          title: part.state?.title || part.title || toolName,
                          status: part.state?.status || (part.output ? 'complete' : part.input ? 'running' : 'pending'),
                        },
                        input: part.input,
                        output: part.output,
                      }

                      setThinkingParts((prev) => {
                        const existing = prev.findIndex((p) => p.callID === toolPart.callID)
                        if (existing >= 0) {
                          // Update existing part
                          return prev.map((p, i) => (i === existing ? toolPart : p))
                        }
                        // Add new part
                        return [...prev, toolPart]
                      })
                    }
                  } else if (part?.type === 'reasoning') {
                    // Handle reasoning parts
                    const reasoningText = part.reasoning || part.text || ''
                    if (reasoningText) {
                      setThinkingReasoning((prev) => {
                        // Append reasoning, separated by newlines
                        return prev ? `${prev}\n\n${reasoningText}` : reasoningText
                      })
                      onStatusChange?.('planning', 'Reasoning...')
                      setThinkingStatus('💭 Reasoning...')
                    }
                  }
                }

                // Handle session status events
                if (data.type === 'session.status') {
                  const status = data.properties?.status
                  if (status) {
                    // Map OpenCode session status to agent status
                    let agentStatus: AgentStatus = 'planning'
                    if (status.includes('running') || status.includes('executing')) {
                      agentStatus = 'executing'
                      setThinkingStatus('⚡ Executing...')
                    } else if (status.includes('thinking') || status.includes('planning')) {
                      agentStatus = 'planning'
                      setThinkingStatus('💭 Thinking...')
                    }
                    onStatusChange?.(agentStatus, status)
                  }
                }

                // Handle ALL other event types for visibility - show them in real-time
                if (
                  !['status', 'message.part.updated', 'session.status', 'done', 'error', 'heartbeat'].includes(
                    data.type,
                  )
                ) {
                  console.log('[chat-interface] 📡 Event received:', data.type, data)

                  // Show event type as status for visibility
                  const eventLabel = data.type.replace(/\./g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())
                  setThinkingStatus(`📡 ${eventLabel}`)

                  // Update agent status based on event type
                  if (data.type.includes('tool') || data.type.includes('command')) {
                    onStatusChange?.('coding', eventLabel)
                  } else if (data.type.includes('thinking') || data.type.includes('reasoning')) {
                    onStatusChange?.('planning', eventLabel)
                  }
                }

                // Handle file watcher updates
                if (data.type === 'file-watcher.updated') {
                  const event = data.properties?.event
                  const path = data.properties?.path
                  if (event && path) {
                    const fileName = path.split('/').pop() || path
                    const statusLabel = `${event}: ${fileName}`
                    onStatusChange?.('coding', statusLabel)
                    setThinkingStatus(`📝 ${statusLabel}`)
                  }
                }

                // Handle todo updates (agent creating tasks)
                if (data.type === 'todo.updated') {
                  const todos = data.properties?.todos || []
                  if (todos.length > 0) {
                    const todoTitle = todos[0]?.content || 'New task'
                    setThinkingStatus(`📋 Task: ${todoTitle.slice(0, 40)}`)
                    onStatusChange?.('planning', `Creating task: ${todoTitle.slice(0, 30)}`)
                  }
                }

                // Handle command execution
                if (data.type === 'command.executed') {
                  const command = data.properties?.command || 'command'
                  setThinkingStatus(`⚡ Running: ${command}`)
                  onStatusChange?.('executing', command)
                }

                // Handle command execution
                if (data.type === 'command.executed') {
                  const command = data.properties?.command
                  if (command) {
                    onStatusChange?.('executing', `Running: ${command}`)
                  }
                }

                if (data.type === 'assistant') {
                  // Update assistant message with final content
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === streamingMessageRef.current ? { ...m, content: data.content, id: data.id || m.id } : m,
                    ),
                  )
                }

                if (data.type === 'done' || data.type === 'session.idle') {
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
                            ? ({ ...m, costBreakdown: breakdowns[0] } as Message & { costBreakdown?: CostBreakdown })
                            : m,
                        ),
                      )
                    }
                  }
                  costEventsRef.current = []
                  setIsStreaming(false)
                  streamingMessageRef.current = null
                  // Keep thinking parts visible for a moment, then clear
                  setTimeout(() => {
                    setThinkingParts([])
                    setThinkingReasoning('')
                    setThinkingStatus('')
                  }, 2000)
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
                  // Error from SSE stream with better categorization
                  let errorContent = data.error
                  let errorCategory: 'transient' | 'persistent' | 'user-action' | 'fatal' =
                    data.category || 'persistent'
                  let retryable = data.retryable || false

                  // Categorize errors better
                  if (errorContent.includes('credit balance') || errorContent.includes('Anthropic API')) {
                    errorCategory = 'user-action' // User needs to add credits
                    retryable = false
                  } else if (errorContent.includes('rate limit') || errorContent.includes('too many requests')) {
                    errorCategory = 'transient' // Rate limit will reset
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
                  // Stop streaming on error
                  setIsStreaming(false)
                  streamingMessageRef.current = null
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
    [sessionId, isStreaming, initialMode],
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
    <div className="flex h-full flex-col bg-background">
      {/* Connection status indicator */}
      {wsStatus !== 'connected' && (
        <div className="bg-yellow-50 border-b border-yellow-200 px-4 py-2 text-sm text-yellow-800 dark:bg-yellow-900/20 dark:border-yellow-800 dark:text-yellow-200">
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-1.5 rounded-full bg-yellow-500 animate-pulse"></div>
            {wsStatus === 'connecting' ? 'Connecting...' : 'Disconnected - Reconnecting...'}
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-[820px]">
          <MessageList
            messages={messages}
            isStreaming={isStreaming}
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
            onLoadEarlier={handleLoadEarlier}
            hasMore={hasMore}
            onRetryError={handleRetryError}
            onOpenVSCode={onOpenVSCode}
            onOpenTerminal={onOpenTerminal}
          />

          {/* Show ThinkingIndicator when streaming to display all OpenCode activity */}
          {isStreaming && (thinkingParts.length > 0 || thinkingReasoning || thinkingStatus) && (
            <div className="px-6 pb-6">
              <ThinkingIndicator
                isThinking={isStreaming}
                parts={thinkingParts}
                reasoning={thinkingReasoning}
                statusLabel={thinkingStatus || currentTool || 'Processing...'}
                expanded={thinkingExpanded}
                onToggle={() => setThinkingExpanded(!thinkingExpanded)}
              />
            </div>
          )}
        </div>
      </div>

      <ChatInput
        onSend={(content) => handleSend(content)}
        onStop={handleStop}
        isStreaming={isStreaming}
        queueCount={messageQueue.length}
      />
    </div>
  )
}
