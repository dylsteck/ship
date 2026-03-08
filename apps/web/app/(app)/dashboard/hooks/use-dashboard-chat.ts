'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { createReconnectingWebSocket, type WebSocketStatus } from '@/lib/websocket'
import { stopChatStream, getChatMessages, type Message as APIMessage } from '@/lib/api/server'
import type { UIMessage } from '@/lib/ai-elements-adapter'
import { createErrorMessage, mapApiMessagesToUI } from '@/lib/ai-elements-adapter'
import type { ChatSession } from '@/lib/api/server'
import { API_URL } from '@/lib/config'
import { useSessionPersistence } from './use-session-persistence'

export function useDashboardChat(initialSessions: ChatSession[]) {
  const [localSessions, setLocalSessions] = useState<ChatSession[]>(initialSessions)
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [messages, setMessages] = useState<UIMessage[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [wsStatus, setWsStatus] = useState<WebSocketStatus>('disconnected')
  const [messageQueue, setMessageQueue] = useState<string[]>([])

  // Sidebar / session persistence state
  const persistence = useSessionPersistence(activeSessionId)

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

        if (event.type === 'agent-url' || event.type === 'opencode-url') {
          const url = (event as { url?: string }).url
          if (url) {
            persistence.setAgentUrl(url)
            try { localStorage.setItem(`agent-url-${sessionId}`, url) } catch {}
          }
        }

        if (event.type === 'sandbox-status') {
          const status = (event as { status?: string }).status
          if (status) persistence.setSandboxStatus(status)
        }
      },
      onStatusChange: setWsStatus,
    })
  }, [persistence])

  useEffect(() => {
    return () => wsRef.current?.disconnect()
  }, [])

  // Load chat history when session changes
  const historyLoadedRef = useRef<string | null>(null)
  useEffect(() => {
    if (!activeSessionId) {
      setMessages([])
      historyLoadedRef.current = null
      return
    }
    if (historyLoadedRef.current === activeSessionId) return
    historyLoadedRef.current = activeSessionId

    getChatMessages(activeSessionId, { limit: 100 })
      .then((apiMessages) => {
        const uiMessages = mapApiMessagesToUI(apiMessages)
        setMessages((prev) => {
          if (prev.length > 0) return prev
          return uiMessages
        })
      })
      .catch((err) => {
        console.error('Failed to load messages:', err)
      })
  }, [activeSessionId])

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

  const updateSessionTitle = useCallback((sessionId: string, title: string) => {
    setLocalSessions((prev) => prev.map((s) => s.id === sessionId ? { ...s, title } : s))
  }, [setLocalSessions])

  return {
    // Session management
    localSessions,
    setLocalSessions,
    activeSessionId,
    setActiveSessionId,
    updateSessionTitle,
    // Messages
    messages,
    setMessages,
    isStreaming,
    setIsStreaming,
    messageQueue,
    setMessageQueue,
    // WebSocket
    wsStatus,
    connectWebSocket,
    // Refs (needed by SSE hook)
    streamingMessageRef,
    assistantTextRef,
    reasoningRef,
    // Persistence (sidebar data)
    ...persistence,
    // Actions
    handleStop,
  }
}
