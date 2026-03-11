'use client'

import { useState, useCallback, useRef, useEffect, useSyncExternalStore } from 'react'
import { createReconnectingWebSocket, type WebSocketStatus } from '@/lib/websocket'
import { getApiToken } from '@/lib/api/client'
import { stopChatStream, getChatMessages, type Message as APIMessage } from '@/lib/api/server'
import type { UIMessage } from '@/lib/ai-elements-adapter'
import {
  createErrorMessage,
  createAssistantPlaceholder,
  mapApiMessagesToUI,
} from '@/lib/ai-elements-adapter'
import type { ChatSession } from '@/lib/api/server'
import { API_URL } from '@/lib/config'
import { useSessionPersistence } from './use-session-persistence'
import { sessionStatusStore } from './use-session-status-store'

export interface UseDashboardChatOptions {
  onAgentEventRef?: React.MutableRefObject<
    ((sessionId: string, event: { type: string; [k: string]: unknown }) => void) | null
  >
  /** Pre-loaded messages from server (e.g. session page). Skips client fetch when activeSessionId matches. */
  initialMessages?: UIMessage[]
  /** Called to resume an active stream (e.g. after page reload). */
  onResumeStream?: (sessionId: string) => void
}

/** Normalize messages from server — createdAt may be serialized as string. */
function normalizeInitialMessages(msgs: UIMessage[]): UIMessage[] {
  return msgs.map((m) => ({
    ...m,
    createdAt:
      m.createdAt instanceof Date
        ? m.createdAt
        : typeof m.createdAt === 'string'
          ? new Date(m.createdAt)
          : undefined,
  }))
}

export function useDashboardChat(
  initialSessions: ChatSession[],
  initialActiveSessionId: string | null = null,
  options?: UseDashboardChatOptions,
) {
  const { onAgentEventRef, initialMessages: rawInitialMessages, onResumeStream } = options ?? {}
  const [localSessions, setLocalSessions] = useState<ChatSession[]>(initialSessions)
  const [activeSessionId, setActiveSessionId] = useState<string | null>(initialActiveSessionId)
  const [messages, setMessages] = useState<UIMessage[]>(() =>
    rawInitialMessages ? normalizeInitialMessages(rawInitialMessages) : [],
  )
  const [internalIsStreaming, setInternalIsStreaming] = useState(false)
  const [wsStatus, setWsStatus] = useState<WebSocketStatus>('disconnected')
  const [messageQueue, setMessageQueue] = useState<string[]>([])

  // Sync with sessionStatusStore for sessions started from homepage (streamSessionInBackground)
  const storeMap = useSyncExternalStore(
    sessionStatusStore.subscribe,
    sessionStatusStore.getSnapshot,
    sessionStatusStore.getSnapshot,
  )
  const storeSessionRunning = Boolean(
    activeSessionId && storeMap.get(activeSessionId)?.isRunning,
  )
  const isStreaming = internalIsStreaming || storeSessionRunning

  // Sidebar / session persistence state
  const persistence = useSessionPersistence(activeSessionId)
  const { setAgentUrl, setAgentSessionId, setSandboxStatus } = persistence

  const wsRef = useRef<ReturnType<typeof createReconnectingWebSocket> | null>(null)
  const streamingMessageRef = useRef<string | null>(null)
  const assistantTextRef = useRef<string>('')
  const reasoningRef = useRef<string>('')
  const messagesRef = useRef<UIMessage[]>([])
  const activeSessionIdRef = useRef<string | null>(activeSessionId)

  useEffect(() => {
    activeSessionIdRef.current = activeSessionId
  }, [activeSessionId])

  useEffect(() => {
    messagesRef.current = messages
  }, [messages])

  // When navigating to a session that's streaming (from homepage), add assistant placeholder
  // so SessionSetup/Loader shows with status from sessionStatusStore
  useEffect(() => {
    if (!activeSessionId || !storeSessionRunning) return
    const hasStreamingPlaceholder = messages.some(
      (m) =>
        m.role === 'assistant' &&
        !m.content &&
        !m.toolInvocations?.length &&
        !m.reasoning?.length,
    )
    if (!hasStreamingPlaceholder) {
      const placeholder = createAssistantPlaceholder()
      streamingMessageRef.current = placeholder.id
      setMessages((prev) => [...prev, placeholder])
    }
  }, [activeSessionId, storeSessionRunning, messages])

  const connectWebSocket = useCallback((sessionId: string) => {
    wsRef.current?.disconnect()

    const token = getApiToken()
    const wsUrl = `${API_URL.replace('http', 'ws')}/sessions/${sessionId}/websocket${token ? `?token=${encodeURIComponent(token)}` : ''}`

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
            setAgentUrl(url)
            try { localStorage.setItem(`agent-url-${sessionId}`, url) } catch {}
          }
        }

        if (event.type === 'agent-session') {
          const id = (event as { agentSessionId?: string }).agentSessionId
          if (id) {
            setAgentSessionId(id)
            try { localStorage.setItem(`agent-session-id-${sessionId}`, id) } catch {}
          }
        }

        if (event.type === 'sandbox-status') {
          const status = (event as { status?: string }).status
          if (status) setSandboxStatus(status)
        }

        if (event.type === 'agent-event') {
          const inner = (event as { event?: { type: string; [k: string]: unknown } }).event
          if (inner) {
            onAgentEventRef?.current?.(sessionId, inner)
          }
        }
      },
      onStatusChange: setWsStatus,
    })
  }, [setAgentSessionId, setAgentUrl, setSandboxStatus, onAgentEventRef])

  useEffect(() => {
    return () => wsRef.current?.disconnect()
  }, [])

  useEffect(() => {
    if (!activeSessionId) {
      wsRef.current?.disconnect()
      return
    }
    connectWebSocket(activeSessionId)
  }, [activeSessionId, connectWebSocket])

  // Load chat history when session changes (skip if server provided initialMessages for this session)
  const historyLoadedRef = useRef<string | null>(null)
  useEffect(() => {
    if (!activeSessionId) {
      setMessages([])
      historyLoadedRef.current = null
      return
    }
    const hadInitialForThisSession =
      rawInitialMessages !== undefined && activeSessionId === initialActiveSessionId
    if (hadInitialForThisSession) {
      historyLoadedRef.current = activeSessionId
      setMessages(normalizeInitialMessages(rawInitialMessages!))
      onResumeStream?.(activeSessionId)
      return
    }
    if (historyLoadedRef.current === activeSessionId) return
    historyLoadedRef.current = activeSessionId

    getChatMessages(activeSessionId, { limit: 100 })
      .then((apiMessages) => {
        const uiMessages = mapApiMessagesToUI(apiMessages)
        setMessages(uiMessages)
        onResumeStream?.(activeSessionId)
      })
      .catch((err) => {
        console.error('Failed to load messages:', err)
      })

    return () => {
      historyLoadedRef.current = null
    }
  }, [activeSessionId, initialActiveSessionId, rawInitialMessages, onResumeStream])

  const handleStop = useCallback(async () => {
    if (!activeSessionId) return
    try {
      await stopChatStream(activeSessionId)
    } catch {
      // Ignore stop errors
    }
    setInternalIsStreaming(false)
    streamingMessageRef.current = null
  }, [activeSessionId])

  const updateSessionTitle = useCallback((sessionId: string, title: string) => {
    setLocalSessions((prev) => prev.map((s) => (s.id === sessionId ? { ...s, title } : s)))
  }, [setLocalSessions])

  const updateSessionTitleIfEmpty = useCallback(
    (sessionId: string, title: string) => {
      setLocalSessions((prev) =>
        prev.map((s) => {
          if (s.id !== sessionId || (s.title && s.title.trim())) return s
          const t = title.length > 60 ? `${title.slice(0, 57)}...` : title
          return { ...s, title: t }
        }),
      )
    },
    [setLocalSessions],
  )

  return {
    // Session management
    localSessions,
    setLocalSessions,
    activeSessionId,
    setActiveSessionId,
    updateSessionTitle,
    updateSessionTitleIfEmpty,
    // Messages
    messages,
    setMessages,
    isStreaming,
    setIsStreaming: setInternalIsStreaming,
    messageQueue,
    setMessageQueue,
    // WebSocket
    wsStatus,
    connectWebSocket,
    // Refs (needed by SSE hook)
    streamingMessageRef,
    assistantTextRef,
    reasoningRef,
    messagesRef,
    activeSessionIdRef,
    // Persistence (sidebar data)
    ...persistence,
    // Actions
    handleStop,
  }
}
