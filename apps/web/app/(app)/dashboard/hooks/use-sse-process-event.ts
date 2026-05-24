'use client'

import { useCallback } from 'react'
import { createAssistantPlaceholder } from '@/lib/ai-elements-adapter'
import { sessionStatusStore } from './use-session-status-store'
import { handleGenericError, handleSessionError } from './sse-event-handlers'
import { createSSEHandlerContext } from './sse-handler-context'
import { dispatchParsedSSEEvent, dispatchRawDataFallbacks } from './sse-event-dispatch'
import { actionForChatErrorPayload } from './sse-stream-utils'
import { ensureStreamingPlaceholder } from './sse-process-event-helpers'
import type { useDashboardChat } from './use-dashboard-chat'

export interface UseSseProcessEventParams {
  chat: ReturnType<typeof useDashboardChat>
  scheduleFlush: () => void
  flushTimerRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>
  claimStreamEvent: (sessionId: string, event: { type: string; [k: string]: unknown }) => boolean
  streamStartTimeRef: React.MutableRefObject<number | null>
  terminalStreamSessionsRef: React.MutableRefObject<Set<string>>
}

export function useSseProcessEvent({
  chat,
  scheduleFlush,
  flushTimerRef,
  claimStreamEvent,
  streamStartTimeRef,
  terminalStreamSessionsRef,
}: UseSseProcessEventParams) {
  const { streamingMessageRef, messagesRef, updateSessionTitle } = chat

  return useCallback(
    (sessionId: string, event: { type: string; [k: string]: unknown }) => {
      const isTerminalEvent =
        event.type === 'done' ||
        event.type === 'session.idle' ||
        event.type === 'session.error' ||
        event.type === 'error'
      if (terminalStreamSessionsRef.current.has(sessionId) && !isTerminalEvent) return
      if (!claimStreamEvent(sessionId, event)) return

      if (!streamingMessageRef.current) {
        const ready = ensureStreamingPlaceholder({
          sessionId,
          event,
          chat,
          streamStartTimeRef,
          terminalStreamSessionsRef,
        })
        if (!ready) return
      }

      const hasCompletedAssistant = messagesRef.current.some(
        (m) => m.role === 'assistant' && (m.content || m.toolInvocations?.length),
      )
      const ctx = createSSEHandlerContext(chat, sessionId, { current: !hasCompletedAssistant })

      dispatchParsedSSEEvent(event, {
        ctx,
        targetSessionId: sessionId,
        scheduleFlush,
        streamStartTimeRef,
        flushTimerRef,
        terminalStreamSessionsRef,
        updateSessionTitle,
        backgroundMode: true,
      })
      dispatchRawDataFallbacks(event, ctx)
    },
    [
      chat,
      claimStreamEvent,
      flushTimerRef,
      messagesRef,
      scheduleFlush,
      streamStartTimeRef,
      streamingMessageRef,
      terminalStreamSessionsRef,
      updateSessionTitle,
    ],
  )
}
