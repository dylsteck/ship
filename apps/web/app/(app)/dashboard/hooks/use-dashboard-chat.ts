'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { createReconnectingWebSocket, type WebSocketStatus } from '@/lib/websocket'
import { stopChatStream, getChatMessages, type Message as APIMessage } from '@/lib/api'
import type { UIMessage } from '@/lib/ai-elements-adapter'
import { createErrorMessage, mapApiMessagesToUI } from '@/lib/ai-elements-adapter'
import type { SessionInfo, StepFinishPart } from '@/lib/sse-types'
import type { ChatSession } from '@/lib/api'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8787'

export function useDashboardChat(initialSessions: ChatSession[]) {
  const [localSessions, setLocalSessions] = useState<ChatSession[]>(initialSessions)
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [messages, setMessages] = useState<UIMessage[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [wsStatus, setWsStatus] = useState<WebSocketStatus>('disconnected')
  const [messageQueue, setMessageQueue] = useState<string[]>([])

  // Sidebar-only state
  const [openCodeUrl, setOpenCodeUrl] = useState<string>('')
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
  const [lastStepCost, setLastStepCost] = useState<{ cost: number; tokens: StepFinishPart['tokens'] } | null>(null)
  const [sessionTitle, setSessionTitle] = useState<string>('')
  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null)
  const [streamStartTime, setStreamStartTime] = useState<number | null>(null)

  const wsRef = useRef<ReturnType<typeof createReconnectingWebSocket> | null>(null)
  const streamingMessageRef = useRef<string | null>(null)
  const assistantTextRef = useRef<string>('')
  const reasoningRef = useRef<string>('')

  const connectWebSocket = useCallback((sessionId: string) => {
    wsRef.current?.disconnect()

    const wsUrl = `${API_URL.replace('http', 'ws')}/sessions/${sessionId}/websocket`

    wsRef.current = createReconnectingWebSocket({
      url: wsUrl,
      onMessage: (data: unknown) => {
        const event = data as {
          type: string
          message?: APIMessage | string
          messageId?: string
          parts?: string
          category?: 'transient' | 'persistent' | 'user-action' | 'fatal'
          retryable?: boolean
          prUrl?: string
          status?: string
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
            // Dedup by ID or by matching role+content (for optimistic user messages)
            const exists = prev.some(
              (m) => m.id === uiMsg.id || (m.role === uiMsg.role && m.content === uiMsg.content),
            )
            if (exists) return prev
            return [...prev, uiMsg]
          })
        }

        if (event.type === 'error') {
          const errorMsg = createErrorMessage(
            typeof event.message === 'string' ? event.message : 'An error occurred',
            event.category || 'persistent',
            event.retryable || false,
          )
          setMessages((prev) => [...prev, errorMsg])
        }

        if (event.type === 'pr-created') {
          const prMsg: UIMessage = {
            id: `pr-${Date.now()}`,
            role: 'system',
            content: `Draft PR created: ${event.prUrl}`,
            type: 'pr-notification',
            createdAt: new Date(),
          }
          setMessages((prev) => [...prev, prMsg])
        }

        if (event.type === 'opencode-url') {
          const url = (event as { url?: string }).url
          if (url) {
            setOpenCodeUrl(url)
            try { localStorage.setItem(`opencode-url-${sessionId}`, url) } catch {}
          }
        }

        if (event.type === 'sandbox-status') {
          // Sidebar info only
        }
      },
      onStatusChange: setWsStatus,
    })
  }, [])

  useEffect(() => {
    return () => wsRef.current?.disconnect()
  }, [])

  // Load chat history and restore opencode URL when session changes
  const historyLoadedRef = useRef<string | null>(null)
  useEffect(() => {
    if (!activeSessionId) {
      setMessages([])
      historyLoadedRef.current = null
      return
    }
    // Only load if we haven't already loaded for this session
    if (historyLoadedRef.current === activeSessionId) return
    historyLoadedRef.current = activeSessionId

    // Restore persisted sidebar data from localStorage
    try {
      const savedUrl = localStorage.getItem(`opencode-url-${activeSessionId}`)
      if (savedUrl) setOpenCodeUrl(savedUrl)

      const savedCost = localStorage.getItem(`total-cost-${activeSessionId}`)
      if (savedCost) setTotalCost(Number(savedCost))

      const savedStepCost = localStorage.getItem(`step-cost-${activeSessionId}`)
      if (savedStepCost) setLastStepCost(JSON.parse(savedStepCost))

      const savedSessionInfo = localStorage.getItem(`session-info-${activeSessionId}`)
      if (savedSessionInfo) setSessionInfo(JSON.parse(savedSessionInfo))

      const savedTitle = localStorage.getItem(`session-title-${activeSessionId}`)
      if (savedTitle) setSessionTitle(savedTitle)
    } catch {}

    // Load historical messages
    getChatMessages(activeSessionId, { limit: 100 })
      .then((apiMessages) => {
        const uiMessages = mapApiMessagesToUI(apiMessages)
        setMessages((prev) => {
          // If we already have messages (from optimistic send), merge
          if (prev.length > 0) return prev
          return uiMessages
        })
      })
      .catch((err) => {
        console.error('Failed to load messages:', err)
      })
  }, [activeSessionId, setMessages, setOpenCodeUrl])

  // Persist sidebar stats to localStorage when they change
  useEffect(() => {
    if (!activeSessionId) return
    try {
      if (totalCost > 0) localStorage.setItem(`total-cost-${activeSessionId}`, String(totalCost))
      if (lastStepCost) localStorage.setItem(`step-cost-${activeSessionId}`, JSON.stringify(lastStepCost))
      if (sessionInfo) localStorage.setItem(`session-info-${activeSessionId}`, JSON.stringify(sessionInfo))
      if (sessionTitle) localStorage.setItem(`session-title-${activeSessionId}`, sessionTitle)
    } catch {}
  }, [activeSessionId, totalCost, lastStepCost, sessionInfo, sessionTitle])

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
    openCodeUrl,
    setOpenCodeUrl,
    sessionTodos,
    setSessionTodos,
    fileDiffs,
    setFileDiffs,
    totalCost,
    setTotalCost,
    lastStepCost,
    setLastStepCost,
    sessionTitle,
    setSessionTitle,
    sessionInfo,
    setSessionInfo,
    streamStartTime,
    setStreamStartTime,
    wsRef,
    streamingMessageRef,
    assistantTextRef,
    reasoningRef,
    connectWebSocket,
    handleStop,
  }
}
