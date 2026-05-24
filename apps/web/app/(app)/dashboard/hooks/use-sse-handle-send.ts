'use client'

import { useCallback } from 'react'
import { useSseStallWatchdog } from './use-sse-stall-watchdog'
import { executeChatSend } from './sse-handle-send-execute'
import type { useDashboardChat } from './use-dashboard-chat'

export interface UseSseHandleSendParams {
  chat: ReturnType<typeof useDashboardChat>
  modeRef: React.MutableRefObject<string>
  modelIdRef: React.MutableRefObject<string | null>
  scheduleFlush: () => void
  clearPendingFlush: () => void
  flushTimerRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>
  claimStreamEvent: (sessionId: string, event: { type: string; [k: string]: unknown }) => boolean
  streamStartTimeRef: React.MutableRefObject<number | null>
  terminalStreamSessionsRef: React.MutableRefObject<Set<string>>
  isStreamingRef: React.MutableRefObject<boolean>
}

export function useSseHandleSend(params: UseSseHandleSendParams) {
  const createWatchdog = useSseStallWatchdog(params)

  return useCallback(
    (content: string, modeOverride?: string, sessionIdOverride?: string) =>
      executeChatSend(content, modeOverride, sessionIdOverride, params, createWatchdog),
    [params, createWatchdog],
  )
}
