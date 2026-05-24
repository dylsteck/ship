'use client'

import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { stopChatStream } from '@/lib/api/chat-client'
import type { UIMessage } from '@/lib/ai-elements-adapter'
import { createAssistantPlaceholder } from '@/lib/ai-elements-adapter'
import type { ChatSession } from '@/lib/api/server'
import { createActiveSessionStreamingRefs, getStreamingRefs, useChatStore } from '@/lib/chat-store/store'
import { selectIsStreaming } from '@/lib/chat-store/selectors'
import { useSessionPersistence } from './use-session-persistence'
import { sessionStatusStore, useSessionStatus } from './use-session-status-store'
import { useSessionConnection } from './use-session-connection'
import { useChatHistoryLoader } from './use-chat-history-loader'

export interface UseDashboardChatOptions {
  onAgentEventRef?: React.MutableRefObject<
    ((sessionId: string, event: { type: string; [k: string]: unknown }) => void) | null
  >
  initialMessages?: UIMessage[]
  initialApiMessages?: Array<{ id: string; role: string; content: string; createdAt: number; parts?: string }>
  onResumeStream?: (sessionId: string) => void
}

export function useDashboardChat(
  initialSessions: ChatSession[],
  initialActiveSessionId: string | null = null,
  options?: UseDashboardChatOptions,
) {
  const { onAgentEventRef, initialMessages: rawInitialMessages, initialApiMessages, onResumeStream } = options ?? {}
  const [localSessions, setLocalSessions] = useState<ChatSession[]>(initialSessions)
  const [activeSessionId, setActiveSessionId] = useState<string | null>(initialActiveSessionId)
  const [messages, setMessages] = useState<UIMessage[]>([])
  const [internalIsStreaming, setInternalIsStreaming] = useState(false)
  const [messageQueue, setMessageQueue] = useState<string[]>([])

  const liveSessionStatus = useSessionStatus(activeSessionId ?? '')
  const storeIsStreaming = useChatStore(selectIsStreaming(activeSessionId ?? ''))
  const isStreaming =
    internalIsStreaming || storeIsStreaming || Boolean(activeSessionId && liveSessionStatus?.isRunning)

  const persistence = useSessionPersistence(activeSessionId)
  const { setAgentUrl, setAgentSessionId, setSandboxStatus } = persistence

  const messagesRef = useRef<UIMessage[]>([])
  const activeSessionIdRef = useRef<string | null>(activeSessionId)
  const streamingRefs = useMemo(
    () => createActiveSessionStreamingRefs(() => activeSessionIdRef.current),
    [],
  )
  const { streamingMessageRef, assistantTextRef, reasoningRef } = streamingRefs

  const setIsStreaming = useCallback(
    (value: boolean) => {
      setInternalIsStreaming(value)
      if (activeSessionIdRef.current) {
        useChatStore.getState().setIsStreaming(activeSessionIdRef.current, value)
      }
    },
    [],
  )

  useEffect(() => {
    activeSessionIdRef.current = activeSessionId
  }, [activeSessionId])
  useEffect(() => {
    messagesRef.current = messages
  }, [messages])

  useEffect(() => {
    if (!activeSessionId || !liveSessionStatus?.isRunning) return
    const hasStreamingPlaceholder = messagesRef.current.some(
      (m) => m.role === 'assistant' && !m.content && !m.toolInvocations?.length && !m.reasoning?.length,
    )
    if (!hasStreamingPlaceholder) {
      const placeholder = createAssistantPlaceholder()
      getStreamingRefs(activeSessionId).streamingMessageRef.current = placeholder.id
      setMessages((prev) => [...prev, placeholder])
    }
  }, [activeSessionId, liveSessionStatus?.isRunning, setMessages])

  const { wsStatus, connectWebSocket, consumeSSE } = useSessionConnection({
    activeSessionId,
    setMessages,
    streamingMessageRef,
    setAgentUrl,
    setAgentSessionId,
    setSandboxStatus,
    onAgentEventRef,
  })

  useChatHistoryLoader({
    activeSessionId,
    initialActiveSessionId,
    rawInitialMessages,
    initialApiMessages,
    onResumeStream,
    setMessages,
  })

  const handleStop = useCallback(async () => {
    if (!activeSessionId) return
    try {
      await stopChatStream(activeSessionId)
    } catch {
      // Ignore stop errors
    }
    setInternalIsStreaming(false)
    if (activeSessionId) {
      useChatStore.getState().setIsStreaming(activeSessionId, false)
    }
    sessionStatusStore.update(activeSessionId, { isRunning: false, status: 'Stopped' })
    streamingMessageRef.current = null
  }, [activeSessionId, streamingMessageRef])

  const updateSessionTitle = useCallback((sessionId: string, title: string) => {
    setLocalSessions((prev) => prev.map((s) => (s.id === sessionId ? { ...s, title } : s)))
  }, [])

  const updateSessionTitleIfEmpty = useCallback((sessionId: string, title: string) => {
    setLocalSessions((prev) =>
      prev.map((s) => {
        if (s.id !== sessionId || (s.title && s.title.trim())) return s
        const t = title.length > 60 ? `${title.slice(0, 57)}...` : title
        return { ...s, title: t }
      }),
    )
  }, [])

  return {
    localSessions,
    setLocalSessions,
    activeSessionId,
    setActiveSessionId,
    updateSessionTitle,
    updateSessionTitleIfEmpty,
    messages,
    setMessages,
    isStreaming,
    setIsStreaming,
    messageQueue,
    setMessageQueue,
    wsStatus,
    connectWebSocket,
    consumeSSE,
    streamingMessageRef,
    assistantTextRef,
    reasoningRef,
    messagesRef,
    activeSessionIdRef,
    ...persistence,
    handleStop,
  }
}
