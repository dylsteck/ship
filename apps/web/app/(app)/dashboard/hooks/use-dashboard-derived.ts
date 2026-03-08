'use client'

import { useMemo } from 'react'
import type { ModelInfo, AgentInfo, GitHubRepo } from '@/lib/api/types'
import type { useDashboardChat } from './use-dashboard-chat'
import type { useDashboardState } from './use-dashboard-state'
import type { ComposerContextValue } from '../components/composer/composer-context'

export interface UseDashboardDerivedParams {
  chat: ReturnType<typeof useDashboardChat>
  state: ReturnType<typeof useDashboardState>
  data: {
    repos: GitHubRepo[]
    reposLoading: boolean
    reposLoadMore: () => void
    reposHasMore: boolean
    reposLoadingMore: boolean
    agents: AgentInfo[]
    agentsLoading: boolean
    modelsLoading: boolean
  }
  isCreating: boolean
}

export function useDashboardDerived({
  chat,
  state,
  data,
  isCreating,
}: UseDashboardDerivedParams) {
  const {
    prompt,
    setPrompt,
    selectedRepo,
    setSelectedRepo,
    selectedAgent,
    selectedModel,
    setSelectedModel,
    mode,
    setMode,
    availableModes,
    handleKeyDown,
    handleAgentSelect,
    handleSubmit,
  } = state

  const groupedByProvider = useMemo(() => {
    const agentModels = selectedAgent?.models || []
    return agentModels.reduce<Record<string, ModelInfo[]>>((acc, model) => {
      const provider = model.provider || 'Other'
      if (!acc[provider]) acc[provider] = []
      acc[provider].push(model)
      return acc
    }, {})
  }, [selectedAgent])

  const displayTitle = useMemo(() => {
    if (chat.sessionInfo?.title) return chat.sessionInfo.title
    if (chat.sessionTitle) return chat.sessionTitle
    if (chat.activeSessionId) {
      const session = chat.localSessions.find((s) => s.id === chat.activeSessionId)
      if (session?.title) return session.title
    }
    const firstUser = chat.messages.find((m) => m.role === 'user')
    if (firstUser?.content) {
      const trimmed = firstUser.content.trim()
      if (trimmed) return trimmed.length > 60 ? `${trimmed.slice(0, 57)}...` : trimmed
    }
    return undefined
  }, [
    chat.sessionInfo?.title,
    chat.sessionTitle,
    chat.activeSessionId,
    chat.localSessions,
    chat.messages,
  ])

  const canSubmit = Boolean(
    chat.activeSessionId ? prompt.trim() && !chat.isStreaming : selectedRepo && prompt.trim() && !isCreating,
  )

  const composerContext: ComposerContextValue = useMemo(
    () => ({
      activeSessionId: chat.activeSessionId,
      prompt,
      onPromptChange: setPrompt,
      onKeyDown: handleKeyDown,
      selectedRepo,
      onRepoSelect: setSelectedRepo,
      repos: data.repos,
      reposLoading: data.reposLoading ?? false,
      reposLoadMore: data.reposLoadMore,
      reposHasMore: data.reposHasMore ?? false,
      reposLoadingMore: data.reposLoadingMore ?? false,
      selectedAgent,
      onAgentSelect: handleAgentSelect,
      agents: data.agents,
      agentsLoading: data.agentsLoading,
      selectedModel,
      onModelSelect: setSelectedModel,
      modelsLoading: data.modelsLoading ?? false,
      groupedByProvider,
      mode,
      onModeChange: setMode,
      availableModes,
      onSubmit: handleSubmit,
      onStop: chat.handleStop,
      isCreating: !!isCreating,
      isStreaming: !!chat.isStreaming,
      messageQueueLength: chat.messageQueue.length,
      canSubmit: !!canSubmit,
    }),
    [
      chat.activeSessionId,
      prompt,
      handleKeyDown,
      selectedRepo,
      data.repos,
      data.reposLoading,
      data.reposLoadMore,
      data.reposHasMore,
      data.reposLoadingMore,
      selectedAgent,
      handleAgentSelect,
      data.agents,
      data.agentsLoading,
      selectedModel,
      data.modelsLoading,
      groupedByProvider,
      mode,
      availableModes,
      handleSubmit,
      chat.handleStop,
      isCreating,
      chat.isStreaming,
      chat.messageQueue.length,
      canSubmit,
    ],
  )

  return {
    displayTitle,
    canSubmit,
    composerContext,
    groupedByProvider,
  }
}
