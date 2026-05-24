'use client'

import { useMemo } from 'react'
import type { ModelInfo, AgentInfo, GitHubRepo } from '@/lib/api/types'
import { getSessionDisplayTitle, getSessionRepoLabel } from '@/lib/session-display'
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
  onRepoSelect?: (repo: GitHubRepo) => void
  onAgentSelect?: (agent: AgentInfo) => void
  onModelSelect?: (model: ModelInfo) => void
}

function buildComposerContext(
  chat: ReturnType<typeof useDashboardChat>,
  state: ReturnType<typeof useDashboardState>,
  data: UseDashboardDerivedParams['data'],
  groupedByProvider: Record<string, ModelInfo[]>,
  canSubmit: boolean,
  isCreating: boolean,
  onRepoSelect?: (repo: GitHubRepo) => void,
  onAgentSelect?: (agent: AgentInfo) => void,
  onModelSelect?: (model: ModelInfo) => void,
): ComposerContextValue {
  return {
    activeSessionId: chat.activeSessionId,
    prompt: state.prompt,
    onPromptChange: state.setPrompt,
    onKeyDown: state.handleKeyDown,
    selectedRepo: state.selectedRepo,
    onRepoSelect: onRepoSelect ?? state.setSelectedRepo,
    repos: data.repos,
    reposLoading: data.reposLoading ?? false,
    reposLoadMore: data.reposLoadMore,
    reposHasMore: data.reposHasMore ?? false,
    reposLoadingMore: data.reposLoadingMore ?? false,
    selectedAgent: state.selectedAgent,
    onAgentSelect: onAgentSelect ?? state.handleAgentSelect,
    agents: data.agents,
    agentsLoading: data.agentsLoading,
    selectedModel: state.selectedModel,
    onModelSelect: onModelSelect ?? state.setSelectedModel,
    modelsLoading: data.modelsLoading ?? false,
    groupedByProvider,
    mode: state.mode,
    onModeChange: state.setMode,
    availableModes: state.availableModes,
    onSubmit: state.handleSubmit,
    onStop: chat.handleStop,
    isCreating: !!isCreating,
    isStreaming: !!chat.isStreaming,
    messageQueueLength: chat.messageQueue.length,
    canSubmit: !!canSubmit,
  }
}

export function useDashboardDerived({
  chat,
  state,
  data,
  isCreating,
  onRepoSelect,
  onAgentSelect,
  onModelSelect,
}: UseDashboardDerivedParams) {
  const groupedByProvider = useMemo(() => {
    const agentModels = state.selectedAgent?.models || []
    return agentModels.reduce<Record<string, ModelInfo[]>>((acc, model) => {
      const provider = model.provider || 'Other'
      if (!acc[provider]) acc[provider] = []
      acc[provider].push(model)
      return acc
    }, {})
  }, [state.selectedAgent])

  const activeSession = useMemo(
    () => chat.localSessions.find((session) => session.id === chat.activeSessionId),
    [chat.localSessions, chat.activeSessionId],
  )

  const fallbackTitle = useMemo(() => {
    const firstUser = chat.messages.find((m) => m.role === 'user')
    if (firstUser?.content) {
      const trimmed = firstUser.content.trim()
      if (trimmed) return trimmed.length > 60 ? `${trimmed.slice(0, 57)}...` : trimmed
    }
    return undefined
  }, [chat.messages])

  const displayTitle = useMemo(() => {
    return getSessionDisplayTitle(activeSession, {
      preferredTitle: chat.sessionInfo?.title || chat.sessionTitle,
      fallbackTitle,
    })
  }, [activeSession, chat.sessionInfo?.title, chat.sessionTitle, fallbackTitle])

  const displayRepoLabel = useMemo(() => getSessionRepoLabel(activeSession), [activeSession])

  const canSubmit = Boolean(
    chat.activeSessionId ? state.prompt.trim() && !chat.isStreaming : state.selectedRepo && state.prompt.trim() && !isCreating,
  )

  const composerContext = useMemo(
    () =>
      buildComposerContext(
        chat,
        state,
        data,
        groupedByProvider,
        canSubmit,
        isCreating,
        onRepoSelect,
        onAgentSelect,
        onModelSelect,
      ),
    [
      chat,
      state,
      data,
      groupedByProvider,
      canSubmit,
      isCreating,
      onRepoSelect,
      onAgentSelect,
      onModelSelect,
    ],
  )

  return {
    displayTitle,
    displayRepoLabel,
    canSubmit,
    composerContext,
    groupedByProvider,
  }
}
