'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { createReconnectingWebSocket, type WebSocketStatus } from '@/lib/websocket'
import { sendChatMessage, stopChatStream, type Message } from '@/lib/api'
import { parseSSEEvent, extractCostInfo, getEventStatus } from '@/lib/sse-parser'
import type { ToolPart as SSEToolPart, ReasoningPart, StepFinishPart } from '@/lib/sse-types'
import type { ChatSession } from '@/lib/api'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8787'

// Simple ToolPart type for backward compatibility
type ToolPart = {
  type: 'tool'
  callID: string
  tool: string
  state: {
    title: string
    status?: 'pending' | 'running' | 'complete' | 'error'
  }
}

export function useDashboardChat(initialSessions: ChatSession[]) {
  const [localSessions, setLocalSessions] = useState<ChatSession[]>(initialSessions)
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [wsStatus, setWsStatus] = useState<WebSocketStatus>('disconnected')
  const [messageQueue, setMessageQueue] = useState<string[]>([])

  // Thinking state (backward compatibility)
  const [thinkingReasoning, setThinkingReasoning] = useState<string>('')
  const [thinkingStatus, setThinkingStatus] = useState<string>('')
  const [thinkingExpanded, setThinkingExpanded] = useState(false)
  const [thinkingParts, setThinkingParts] = useState<ToolPart[]>([])

  // SSE state
  const [activityTools, setActivityTools] = useState<SSEToolPart[]>([])
  const [reasoningParts, setReasoningParts] = useState<ReasoningPart[]>([])
  const [statusEvents, setStatusEvents] = useState<Array<{ status: string; message: string; time: number }>>([])
  const [openCodeUrl, setOpenCodeUrl] = useState<string>('')
  const [lastStepCost, setLastStepCost] = useState<{ cost: number; tokens: StepFinishPart['tokens'] } | null>(null)
  const [sessionTodos, setSessionTodos] = useState<
    Array<{
      id: string
      content: string
      status: 'pending' | 'in_progress' | 'completed' | 'cancelled'
      priority: 'high' | 'medium' | 'low'
    }>
  >([])
  const [fileDiffs, setFileDiffs] = useState<Array<{ filename: string; additions: number; deletions: number }>>([])
  const [totalCost, setTotalCost] = useState<number>(0)
  const [streamStartTime, setStreamStartTime] = useState<number | null>(null)
  const [sessionTitle, setSessionTitle] = useState<string>('')
  const [sessionInfo, setSessionInfo] = useState<import('@/lib/sse-types').SessionInfo | null>(null)

  const wsRef = useRef<ReturnType<typeof createReconnectingWebSocket> | null>(null)
  const streamingMessageRef = useRef<string | null>(null)
  const assistantTextRef = useRef<string>('')

  const connectWebSocket = useCallback((sessionId: string) => {
    wsRef.current?.disconnect()

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

        if (event.type === 'sandbox-status') {
          const status = (event as { status?: string }).status
          if (status === 'ready') {
            setThinkingStatus('Sandbox ready')
            setStatusEvents((prev) => [
              ...prev,
              { status: 'sandbox-ready', message: 'Sandbox ready', time: Date.now() },
            ])
          } else if (status === 'error') {
            setThinkingStatus('Sandbox error')
            setStatusEvents((prev) => [...prev, { status: 'error', message: 'Sandbox error', time: Date.now() }])
          } else if (status === 'provisioning') {
            setStatusEvents((prev) => [
              ...prev,
              { status: 'provisioning', message: 'Provisioning sandbox...', time: Date.now() },
            ])
          }
        }

        if (event.type === 'opencode-started') {
          setThinkingStatus('OpenCode started')
          setStatusEvents((prev) => [
            ...prev,
            { status: 'starting-opencode', message: 'Starting OpenCode server...', time: Date.now() },
          ])
        }

        if (event.type === 'opencode-url') {
          const url = (event as { url?: string }).url
          if (url) {
            setOpenCodeUrl(url)
          }
        }

        if (event.type === 'opencode-event') {
          const ocEvent = (
            event as {
              event?: {
                type?: string
                payload?: { type?: string }
                properties?: {
                  part?: {
                    type?: string
                    tool?: string | { name?: string }
                    callID?: string
                    state?: { title?: string; status?: string }
                  }
                  delta?: string
                }
              }
            }
          ).event

          if (ocEvent?.payload?.type === 'server.connected') {
            setThinkingStatus('Connected to agent')
            setStatusEvents((prev) => [
              ...prev,
              { status: 'agent-active', message: 'Connected to agent', time: Date.now() },
            ])
            return
          }

          if (ocEvent?.type === 'message.part.updated') {
            const part = ocEvent.properties?.part
            if (part?.type === 'tool') {
              const toolName = typeof part.tool === 'string' ? part.tool : part.tool?.name
              const toolTitle = part.state?.title || ''
              const toolStatus = part.state?.status

              if (toolName && part.callID) {
                const toolPart: ToolPart = {
                  type: 'tool',
                  callID: part.callID,
                  tool: toolName,
                  state: {
                    title: toolTitle,
                    status: toolStatus as 'pending' | 'running' | 'complete' | 'error' | undefined,
                  },
                }
                setThinkingParts((prev) => {
                  const existing = prev.findIndex((p) => p.callID === toolPart.callID)
                  if (existing >= 0) {
                    return prev.map((p, i) => (i === existing ? toolPart : p))
                  }
                  return [...prev, toolPart]
                })
              }

              if (toolName) {
                const name = toolName.toLowerCase()
                if (name.includes('read') || name.includes('glob') || name.includes('grep')) {
                  setThinkingStatus(`Reading: ${toolTitle.slice(0, 40) || 'files...'}`)
                } else if (name.includes('write') || name.includes('edit')) {
                  setThinkingStatus(`Writing: ${toolTitle.slice(0, 40) || 'code...'}`)
                } else if (name.includes('bash') || name.includes('run') || name.includes('shell')) {
                  setThinkingStatus(`Running: ${toolTitle.slice(0, 40) || 'command...'}`)
                } else if (name.includes('task') || name.includes('agent')) {
                  setThinkingStatus('Creating task...')
                } else if (name.includes('search') || name.includes('semantic')) {
                  setThinkingStatus(`Searching: ${toolTitle.slice(0, 40) || '...'}`)
                } else {
                  setThinkingStatus(`${toolName}: ${toolTitle.slice(0, 30)}`)
                }
              }
            } else if (part?.type === 'text') {
              setThinkingStatus('Thinking...')
            } else if (part?.type === 'reasoning') {
              setThinkingStatus('Reasoning...')
            }
          }

          if (ocEvent?.type === 'session.status') {
            const status = (ocEvent as { properties?: { status?: string } }).properties?.status
            if (status) {
              setThinkingStatus(status)
            }
          }

          if (ocEvent?.type === 'todo.updated') {
            setThinkingStatus('Updating tasks...')
          }

          if (ocEvent?.type === 'file-watcher.updated') {
            const props = (ocEvent as { properties?: { event?: string; path?: string } }).properties
            if (props?.event && props?.path) {
              setThinkingStatus(`${props.event}: ${props.path.split('/').pop()}`)
            }
          }
        }
      },
      onStatusChange: setWsStatus,
    })
  }, [])

  useEffect(() => {
    return () => wsRef.current?.disconnect()
  }, [])

  const handleStop = useCallback(async () => {
    if (!activeSessionId) return
    try {
      await stopChatStream(activeSessionId)
    } catch {
      // Ignore stop errors
    }
    setIsStreaming(false)
    streamingMessageRef.current = null
  }, [activeSessionId])

  return {
    localSessions,
    setLocalSessions,
    activeSessionId,
    setActiveSessionId,
    messages,
    setMessages,
    isStreaming,
    setIsStreaming,
    wsStatus,
    messageQueue,
    setMessageQueue,
    thinkingReasoning,
    setThinkingReasoning,
    thinkingStatus,
    setThinkingStatus,
    thinkingExpanded,
    setThinkingExpanded,
    thinkingParts,
    setThinkingParts,
    activityTools,
    setActivityTools,
    reasoningParts,
    setReasoningParts,
    statusEvents,
    setStatusEvents,
    openCodeUrl,
    setOpenCodeUrl,
    lastStepCost,
    setLastStepCost,
    sessionTodos,
    setSessionTodos,
    fileDiffs,
    setFileDiffs,
    totalCost,
    setTotalCost,
    streamStartTime,
    setStreamStartTime,
    sessionTitle,
    setSessionTitle,
    sessionInfo,
    setSessionInfo,
    wsRef,
    streamingMessageRef,
    assistantTextRef,
    connectWebSocket,
    handleStop,
  }
}
