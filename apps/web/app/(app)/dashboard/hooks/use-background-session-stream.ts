'use client'

import { useCallback } from 'react'
import { createErrorMessage } from '@/lib/ai-elements-adapter'
import { REALTIME_V2_ENABLED } from '@/lib/config'
import { useSessionControllerRegistry } from '@/lib/realtime/session-controller-provider'
import { runBackgroundSessionStream } from './background-session-stream'
import type { useDashboardChat } from './use-dashboard-chat'

export function useBackgroundSessionStream(
  chat: ReturnType<typeof useDashboardChat>,
  processStreamEventForSession?: (sessionId: string, event: { type: string; [k: string]: unknown }) => void,
  selectedModelId?: string | null,
) {
  const registry = useSessionControllerRegistry()
  return useCallback(
    async (sessionId: string, content: string, sessionMode: string, modelId?: string) => {
      if (REALTIME_V2_ENABLED) {
        chat.setIsStreaming(true)
        try {
          await registry.get(sessionId).createTurn({
            content,
            mode: sessionMode === 'plan' ? 'plan' : 'agent',
            ...(modelId ?? selectedModelId ? { modelId: modelId ?? selectedModelId ?? undefined } : {}),
            clientCommandId: crypto.randomUUID(),
          })
        } catch (error) {
          chat.setIsStreaming(false)
          if (chat.activeSessionIdRef.current === sessionId) {
            chat.setMessages((previous) => [
              ...previous.filter((message) => message.content || message.role !== 'assistant'),
              createErrorMessage(
                error instanceof Error ? error.message : 'Could not start the turn.',
                'transient',
                true,
              ),
            ])
          }
        }
        return
      }
      await runBackgroundSessionStream(
        sessionId,
        content,
        sessionMode,
        modelId ?? selectedModelId ?? undefined,
        chat,
        processStreamEventForSession,
      )
    },
    [chat, processStreamEventForSession, registry, selectedModelId],
  )
}
