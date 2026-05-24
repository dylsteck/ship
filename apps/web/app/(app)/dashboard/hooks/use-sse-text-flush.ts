'use client'

import { useCallback, useRef } from 'react'
import type { UIMessage } from '@/lib/ai-elements-adapter'

const FLUSH_INTERVAL_MS = 33

export interface UseSseTextFlushParams {
  setMessages: React.Dispatch<React.SetStateAction<UIMessage[]>>
  streamingMessageRef: React.MutableRefObject<string | null>
  assistantTextRef: React.MutableRefObject<string>
  reasoningRef: React.MutableRefObject<string>
}

/** Throttled flush: batch rapid text deltas into a single React render (~30fps). */
export function useSseTextFlush({
  setMessages,
  streamingMessageRef,
  assistantTextRef,
  reasoningRef,
}: UseSseTextFlushParams) {
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastFlushTimeRef = useRef(0)

  const doFlush = useCallback(() => {
    flushTimerRef.current = null
    lastFlushTimeRef.current = performance.now()
    const msgId = streamingMessageRef.current
    if (!msgId) return
    const text = assistantTextRef.current
    const reasoning = reasoningRef.current
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id !== msgId) return m
        const updates: Partial<typeof m> = {}
        if (m.content !== text) updates.content = text
        if (reasoning && m.reasoning?.[0] !== reasoning) updates.reasoning = [reasoning]
        if (Object.keys(updates).length === 0) return m
        return { ...m, ...updates }
      }),
    )
  }, [setMessages, streamingMessageRef, assistantTextRef, reasoningRef])

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
