'use client'

import { useCallback, useRef } from 'react'
import { getStreamingRefs, useChatStore } from '@/lib/chat-store/store'
import type { UIMessage } from '@/lib/ai-elements-adapter'

const FLUSH_INTERVAL_MS = 33

export interface UseSseTextFlushParams {
  sessionId: string | null
  setMessages: React.Dispatch<React.SetStateAction<UIMessage[]>>
}

/** Throttled flush: batch rapid text deltas into a single React render (~30fps). */
export function useSseTextFlush({ sessionId, setMessages }: UseSseTextFlushParams) {
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastFlushTimeRef = useRef(0)

  const doFlush = useCallback(() => {
    flushTimerRef.current = null
    lastFlushTimeRef.current = performance.now()
    if (!sessionId) return

    const refs = getStreamingRefs(sessionId)
    const msgId = refs.streamingMessageRef.current
    if (!msgId) return

    useChatStore.getState().flushStreamingBuffer(sessionId)

    const text = refs.assistantTextRef.current
    const reasoning = refs.reasoningRef.current
    setMessages((prev) => {
      let changed = false
      const next = prev.map((m) => {
        if (m.id !== msgId) return m
        const updates: Partial<typeof m> = {}
        if (m.content !== text) updates.content = text
        if (reasoning && m.reasoning?.[0] !== reasoning) updates.reasoning = [reasoning]
        if (Object.keys(updates).length === 0) return m
        changed = true
        return { ...m, ...updates }
      })
      return changed ? next : prev
    })
  }, [sessionId, setMessages])

  const scheduleFlush = useCallback(() => {
    if (flushTimerRef.current != null) return
    const elapsed = performance.now() - lastFlushTimeRef.current
    if (elapsed >= FLUSH_INTERVAL_MS) {
      doFlush()
    } else {
      flushTimerRef.current = setTimeout(doFlush, FLUSH_INTERVAL_MS - elapsed)
    }
  }, [doFlush])

  const clearPendingFlush = useCallback(() => {
    if (flushTimerRef.current != null) {
      clearTimeout(flushTimerRef.current)
      flushTimerRef.current = null
    }
  }, [])

  return { scheduleFlush, clearPendingFlush, flushTimerRef }
}
