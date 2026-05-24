'use client'

import { useSessionSync } from './use-session-sync'
import type { useDashboardChat } from './use-dashboard-chat'
import type { useDashboardState } from './use-dashboard-state'
import type { useDashboardDataHooks } from './dashboard-client-helpers'

export function useDashboardSessionSync({
  initialSessionId,
  sessionParam,
  handleSend,
  chat,
  state,
  dataHooks,
  defaultModelId,
  defaultModelLoading,
}: {
  initialSessionId: string | null
  sessionParam: string | null
  handleSend: (content: string) => Promise<void>
  chat: ReturnType<typeof useDashboardChat>
  state: ReturnType<typeof useDashboardState>
  dataHooks: ReturnType<typeof useDashboardDataHooks>
  defaultModelId: string | null
  defaultModelLoading: boolean
}) {
  useSessionSync({
    initialSessionId,
    sessionParam,
    handleSend,
    chat: {
      activeSessionId: chat.activeSessionId,
      setActiveSessionId: chat.setActiveSessionId,
      connectWebSocket: chat.connectWebSocket,
      localSessions: chat.localSessions,
      isStreaming: chat.isStreaming,
      messageQueue: chat.messageQueue,
      setMessageQueue: chat.setMessageQueue,
    },
    model: {
      models: dataHooks.models,
      selectedModel: state.selectedModel,
      setSelectedModel: state.setSelectedModel,
      defaultModelId,
      defaultModelLoading,
    },
    repo: {
      repos: dataHooks.repos,
      selectedRepo: state.selectedRepo,
      setSelectedRepo: state.setSelectedRepo,
      defaultRepoLoading: dataHooks.defaultRepoLoading,
      defaultRepoFullName: dataHooks.defaultRepoFullName,
    },
  })
}
