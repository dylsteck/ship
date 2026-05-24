'use client'

import { useCallback, useRef } from 'react'
import { createAssistantPlaceholder } from '@/lib/ai-elements-adapter'
import { getStreamingRefs } from '@/lib/chat-store/store'
import { sessionStatusStore } from './use-session-status-store'
import { useSseTextFlush } from './use-sse-text-flush'
import { streamEventKey } from './sse-stream-utils'
import { useSseHandleSend } from './use-sse-handle-send'
import { useSseProcessEvent } from './use-sse-process-event'
import type { useDashboardChat } from './use-dashboard-chat'

/** Compact params: chat context + mode ref. Avoids 20+ individual props. */
export interface UseDashboardSSEParams {
  chat: ReturnType<typeof useDashboardChat>
  modeRef: React.MutableRefObject<string>
  modelIdRef: React.MutableRefObject<string | null>
}

export function useDashboardSSE({ chat, modeRef, modelIdRef }: UseDashboardSSEParams) {
  const { isStreaming, setMessages, activeSessionId } = chat

  const streamStartTimeRef = useRef<number | null>(null)
  const terminalStreamSessionsRef = useRef<Set<string>>(new Set())
  const seenStreamEventKeysRef = useRef<Set<string>>(new Set())
  const isStreamingRef = useRef(isStreaming)
  isStreamingRef.current = isStreaming

  const { scheduleFlush, clearPendingFlush, flushTimerRef } = useSseTextFlush({
    sessionId: activeSessionId,
    setMessages,
  })

  const claimStreamEvent = useCallback((sessionId: string, event: { type: string; [k: string]: unknown }) => {
    const key = streamEventKey(sessionId, event)
    if (!key) return true
    const seen = seenStreamEventKeysRef.current
    if (seen.has(key)) return false
    seen.add(key)
    if (seen.size > 600) {
      const firstKey = seen.values().next().value
      if (firstKey) seen.delete(firstKey)
    }
    return true
  }, [])

  const handleSend = useSseHandleSend({
    chat,
    modeRef,
    modelIdRef,
    scheduleFlush,
    clearPendingFlush,
    flushTimerRef,
    claimStreamEvent,
    streamStartTimeRef,
    terminalStreamSessionsRef,
    isStreamingRef,
  })

  const processStreamEventForSession = useSseProcessEvent({
    chat,
    scheduleFlush,
    flushTimerRef,
    claimStreamEvent,
    streamStartTimeRef,
    terminalStreamSessionsRef,
  })

  /** Passive tabs catch up via SessionDO WebSocket `agent-event` broadcasts — not `/subscribe`. */
  const resumeStream = useCallback(
    (sessionId: string) => {
      const status = sessionStatusStore.get(sessionId)
      if (!status?.isRunning) return

      chat.connectWebSocket(sessionId)
      chat.setIsStreaming(true)

      const streamingRefs = getStreamingRefs(sessionId)
      const hasPlaceholder = chat.messagesRef.current.some(
        (m) => m.role === 'assistant' && !m.content && !m.toolInvocations?.length && !m.reasoning?.length,
      )
      if (!hasPlaceholder) {
        const placeholder = createAssistantPlaceholder()
        streamingRefs.streamingMessageRef.current = placeholder.id
        chat.setMessages((prev) => [...prev, placeholder])
      }
    },
    [chat],
  )

  return { handleSend, processStreamEventForSession, resumeStream }
}
