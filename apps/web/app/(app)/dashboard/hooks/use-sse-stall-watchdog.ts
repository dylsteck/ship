'use client'

import { useCallback } from 'react'
import { postSessionSync } from '@/lib/session-sync-channel'
import { sessionStatusStore } from './use-session-status-store'
import { createErrorMessage } from '@/lib/ai-elements-adapter'
import { finalizeStream } from './sse-event-dispatch'
import type { SSEHandlerContext } from './sse-event-handlers'
import type { useDashboardChat } from './use-dashboard-chat'

const CLIENT_TIMEOUT_MS = 300_000
const STALL_TIMEOUT_MS = 90_000

export interface UseSseStallWatchdogParams {
  chat: ReturnType<typeof useDashboardChat>
  streamStartTimeRef: React.MutableRefObject<number | null>
  flushTimerRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>
  terminalStreamSessionsRef: React.MutableRefObject<Set<string>>
}

/** Creates stall/overall timeout watchdogs for an active chat stream. */
export function useSseStallWatchdog({
  chat,
  streamStartTimeRef,
  flushTimerRef,
  terminalStreamSessionsRef,
}: UseSseStallWatchdogParams) {
  const { activeSessionIdRef, assistantTextRef, streamingMessageRef, setMessages, setIsStreaming, setStreamingStatus } =
    chat

  return useCallback(
    (targetSessionId: string, ctx: SSEHandlerContext) => {
      const onStall = () => {
        if (streamingMessageRef.current && targetSessionId === activeSessionIdRef?.current) {
          if (assistantTextRef.current.length > 0) {
            finalizeStream(ctx, streamStartTimeRef, flushTimerRef, targetSessionId)
            postSessionSync({ type: 'session-stopped', sessionId: targetSessionId })
            terminalStreamSessionsRef.current.add(targetSessionId)
            return
          }
          const msgId = streamingMessageRef.current
          setMessages((prev) => {
            const withoutPlaceholder = prev.filter((m) => m.id !== msgId)
            return [
              ...withoutPlaceholder,
              createErrorMessage('Request timed out. The agent took too long to respond.', 'transient', true),
            ]
          })
          setIsStreaming(false)
          setStreamingStatus('')
          streamingMessageRef.current = null
          sessionStatusStore.update(targetSessionId, { isRunning: false, status: 'Error' })
          postSessionSync({ type: 'session-stopped', sessionId: targetSessionId })
          terminalStreamSessionsRef.current.add(targetSessionId)
        }
      }

      let stallTimerId: ReturnType<typeof setTimeout> | null = setTimeout(onStall, STALL_TIMEOUT_MS)
      let timeoutId: ReturnType<typeof setTimeout> | null = setTimeout(onStall, CLIENT_TIMEOUT_MS)

      return {
        reset: () => {
          if (stallTimerId) clearTimeout(stallTimerId)
          stallTimerId = setTimeout(onStall, STALL_TIMEOUT_MS)
        },
        clear: () => {
          if (timeoutId) clearTimeout(timeoutId)
          if (stallTimerId) clearTimeout(stallTimerId)
          timeoutId = null
          stallTimerId = null
        },
      }
    },
    [
      activeSessionIdRef,
      assistantTextRef,
      flushTimerRef,
      setIsStreaming,
      setMessages,
      setStreamingStatus,
      streamStartTimeRef,
      streamingMessageRef,
      terminalStreamSessionsRef,
    ],
  )
}
