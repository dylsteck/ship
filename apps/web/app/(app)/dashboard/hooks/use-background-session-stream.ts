'use client'

import { useCallback } from 'react'
import { runBackgroundSessionStream } from './background-session-stream'
import type { useDashboardChat } from './use-dashboard-chat'

export function useBackgroundSessionStream(
  chat: ReturnType<typeof useDashboardChat>,
  processStreamEventForSession?: (sessionId: string, event: { type: string; [k: string]: unknown }) => void,
  selectedModelId?: string | null,
) {
  return useCallback(
    (sessionId: string, content: string, sessionMode: string, modelId?: string) =>
      runBackgroundSessionStream(
        sessionId,
        content,
        sessionMode,
        modelId ?? selectedModelId ?? undefined,
        chat,
        processStreamEventForSession,
      ),
    [chat, processStreamEventForSession, selectedModelId],
  )
}
