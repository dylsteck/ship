'use client'

import { useCallback, useRef } from 'react'
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
  const { isStreaming, setMessages, streamingMessageRef, assistantTextRef, reasoningRef } = chat

  const streamStartTimeRef = useRef<number | null>(null)
  const terminalStreamSessionsRef = useRef<Set<string>>(new Set())
  const seenStreamEventKeysRef = useRef<Set<string>>(new Set())
  const isStreamingRef = useRef(isStreaming)
  isStreamingRef.current = isStreaming

  const { scheduleFlush, clearPendingFlush, flushTimerRef } = useSseTextFlush({
    setMessages,
    streamingMessageRef,
    assistantTextRef,
    reasoningRef,
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

  /** Active turns are replayed through the SessionDO WebSocket `agent-event` path. */
  const resumeStream = useCallback((_sessionId: string) => {
    // The old `/subscribe` endpoint is intentionally not used.
  }, [])

  return { handleSend, processStreamEventForSession, resumeStream }
}
