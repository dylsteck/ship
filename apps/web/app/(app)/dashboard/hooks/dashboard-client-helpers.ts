'use client'

import { useCallback, useMemo } from 'react'
import type { ShellSessionSummary } from '@ship/contracts'
import { REALTIME_V2_ENABLED } from '@/lib/config'
import type { ChatSession } from '@/lib/api/server'
import { useShellState } from '@/lib/realtime/shell-provider'
import { useGitHubRepos } from '@/lib/api/hooks/use-repos'
import {
  useModels,
  useDefaultModel,
  useSessionModel,
  useSetSessionModel,
} from '@/lib/api/hooks/use-models'
import { useAgents, useDefaultAgent } from '@/lib/api/hooks/use-agents'
import { useDefaultRepo } from '@/lib/api/hooks/use-default-repo'
import { useCreateSession, useDeleteSession, useSessions } from '@/lib/api/hooks/use-sessions'
import { replyPermission, replyQuestion, rejectQuestion } from '@/lib/api/hooks/use-chat'
import type { AgentInfo } from '@/lib/api/types'
import type { SessionPanelData } from '../types'
import { getSessionDisplayTitle } from '@/lib/session-display'
import type { useDashboardChat } from './use-dashboard-chat'
import type { useDashboardState } from './use-dashboard-state'
import { buildTerminalConnectionHint, type useActiveSessionSync } from './use-dashboard-client-effects'

function mapShellSessions(
  orderedSessionIds: readonly string[],
  sessionsById: ReadonlyMap<string, ShellSessionSummary>,
): ChatSession[] {
  return orderedSessionIds.flatMap((id) => {
    const summary = sessionsById.get(id)
    if (!summary) return []
    return [
      {
        id: summary.id,
        userId: '',
        repoOwner: summary.repoOwner,
        repoName: summary.repoName,
        status: summary.status,
        lastActivity: summary.lastActivity,
        createdAt: summary.createdAt,
        archivedAt: summary.archivedAt,
        title: summary.title,
        model: summary.modelId,
        agentType: summary.agentId,
        revision: summary.revision,
      },
    ]
  })
}

export function useDashboardDataHooks(chat: ReturnType<typeof useDashboardChat>) {
  const shell = useShellState()
  const reposQuery = useGitHubRepos(true)
  const { models, isLoading: modelsLoading } = useModels(true)
  const { agents, isLoading: agentsLoading } = useAgents()
  const { defaultAgentId, isLoading: defaultAgentLoading, mutate: mutateDefaultAgent } = useDefaultAgent(true)
  const { defaultModelId: globalDefaultModelId, isLoading: globalDefaultModelLoading } = useDefaultModel(true)
  const { defaultRepoFullName, isLoading: defaultRepoLoading, mutate: mutateDefaultRepo } = useDefaultRepo(true)
  const { createSession, isCreating } = useCreateSession()
  const { deleteSession } = useDeleteSession()
  const { sessionModelId, mutate: mutateSessionModel } = useSessionModel(chat.activeSessionId ?? undefined)
  const { setSessionModel } = useSetSessionModel()
  const sessionsQuery = useSessions(!REALTIME_V2_ENABLED, {
    refreshInterval: REALTIME_V2_ENABLED ? undefined : 3000,
    refetchOnFocus: !REALTIME_V2_ENABLED,
  })
  const shellSessions = useMemo(
    () => mapShellSessions(shell.orderedSessionIds, shell.sessionsById),
    [shell.orderedSessionIds, shell.sessionsById],
  )
  const mutateSessions = REALTIME_V2_ENABLED ? () => undefined : sessionsQuery.mutate
  const swrSessions = REALTIME_V2_ENABLED ? shellSessions : sessionsQuery.sessions
  const sessionsLoading = REALTIME_V2_ENABLED
    ? !shell.hasSnapshot && shell.orderedSessionIds.length === 0
    : sessionsQuery.isLoading
  const shellStreamingSessionIds = useMemo(
    () => new Set(
      [...shell.sessionsById.values()]
        .filter((session) => ['starting', 'running', 'stopping'].includes(session.runtime.state))
        .map((session) => session.id),
    ),
    [shell.sessionsById],
  )

  return {
    repos: reposQuery.repos,
    reposLoading: reposQuery.isLoading,
    reposLoadMore: reposQuery.loadMore,
    reposHasMore: reposQuery.hasMore,
    reposLoadingMore: reposQuery.isLoadingMore,
    models,
    modelsLoading,
    agents,
    agentsLoading,
    defaultAgentId,
    defaultAgentLoading,
    defaultRepoFullName,
    defaultRepoLoading,
    createSession,
    deleteSession,
    isCreating,
    sessionModelId,
    mutateSessionModel,
    setSessionModel,
    swrSessions,
    sessionsLoading,
    mutateSessions,
    shellPhase: shell.phase,
    shellStreamingSessionIds,
    globalDefaultModelId,
    globalDefaultModelLoading,
    mutateDefaultAgent,
    mutateDefaultRepo,
    stateData: {
      repos: reposQuery.repos,
      isCreating,
      agents,
      agentsLoading,
      defaultAgentId,
      defaultAgentLoading,
      defaultRepoFullName,
      defaultRepoLoading,
      models,
    },
    derivedData: {
      repos: reposQuery.repos,
      reposLoading: reposQuery.isLoading ?? false,
      reposLoadMore: reposQuery.loadMore,
      reposHasMore: reposQuery.hasMore ?? false,
      reposLoadingMore: reposQuery.isLoadingMore ?? false,
      agents,
      agentsLoading,
      modelsLoading: modelsLoading ?? false,
    },
  }
}

export function useDashboardModelSelect(
  chat: ReturnType<typeof useDashboardChat>,
  state: ReturnType<typeof useDashboardState>,
  dataHooks: ReturnType<typeof useDashboardDataHooks>,
  options?: {
    agents: AgentInfo[]
    persistDefaultModel: (model: NonNullable<ReturnType<typeof useDashboardState>['selectedModel']>, agentIdOverride?: string) => Promise<void>
  },
) {
  const { setSelectedModel, selectedAgent } = state
  const { activeSessionId, setLocalSessions } = chat
  const { setSessionModel, mutateSessionModel, mutateSessions } = dataHooks

  return useCallback(
    async (model: NonNullable<ReturnType<typeof useDashboardState>['selectedModel']>) => {
      setSelectedModel(model)
      if (!activeSessionId) {
        if (options?.persistDefaultModel) {
          const agentId =
            options.agents.find((agent) => agent.models.some((entry) => entry.id === model.id))?.id ??
            selectedAgent?.id
          await options.persistDefaultModel(model, agentId)
        }
        return
      }

      setLocalSessions((prev) =>
        prev.map((session) => (session.id === activeSessionId ? { ...session, model: model.id } : session)),
      )
      try {
        await setSessionModel({ sessionId: activeSessionId, modelId: model.id })
        await mutateSessionModel()
        mutateSessions()
      } catch (error) {
        console.error('Failed to set session model:', error)
      }
    },
    [
      activeSessionId,
      mutateSessionModel,
      mutateSessions,
      options,
      selectedAgent?.id,
      setLocalSessions,
      setSelectedModel,
      setSessionModel,
    ],
  )
}

export function useDashboardPromptHandlers(chat: ReturnType<typeof useDashboardChat>) {
  const { activeSessionId } = chat

  const handlePermissionReply = useCallback(
    async (permissionId: string, approved: boolean) => {
      if (!activeSessionId) return
      await replyPermission(activeSessionId, permissionId, approved ? 'once' : 'reject')
    },
    [activeSessionId],
  )

  const handleQuestionReply = useCallback(
    async (questionId: string, response: string) => {
      if (!activeSessionId) return
      await replyQuestion(activeSessionId, questionId, response)
    },
    [activeSessionId],
  )

  const handleQuestionSkip = useCallback(
    async (questionId: string) => {
      if (!activeSessionId) return
      await rejectQuestion(activeSessionId, questionId)
    },
    [activeSessionId],
  )

  return { handlePermissionReply, handleQuestionReply, handleQuestionSkip }
}

export function buildRightSidebarData(
  chat: ReturnType<typeof useDashboardChat>,
  state: ReturnType<typeof useDashboardState>,
  activeSession: ReturnType<typeof useActiveSessionSync>['activeSession'],
  activeSessionAgent: ReturnType<typeof useActiveSessionSync>['activeSessionAgent'],
  activeSessionModel: ReturnType<typeof useActiveSessionSync>['activeSessionModel'],
): SessionPanelData | null {
  if (!chat.activeSessionId) return null

  return {
    sessionId: chat.activeSessionId,
    sessionTitle: getSessionDisplayTitle(activeSession, { preferredTitle: chat.sessionTitle }),
    selectedRepo: activeSession
      ? {
          id: -1,
          name: activeSession.repoName,
          fullName: `${activeSession.repoOwner}/${activeSession.repoName}`,
          owner: activeSession.repoOwner,
          private: false,
          description: null,
        }
      : state.selectedRepo,
    selectedAgent: activeSessionAgent ? { id: activeSessionAgent.id, name: activeSessionAgent.name } : null,
    selectedModel: activeSessionModel
      ? { id: activeSessionModel.id, name: activeSessionModel.name, provider: activeSessionModel.provider }
      : null,
    mode: state.mode,
    lastStepCost: chat.lastStepCost,
    totalCost: chat.totalCost,
    sessionTodos: chat.sessionTodos,
    fileDiffs: chat.fileDiffs,
    agentUrl: chat.agentUrl ?? '',
    agentSessionId: chat.agentSessionId || undefined,
    sessionInfo: chat.sessionInfo,
    messages: chat.messages,
    sandboxStatus: chat.sandboxStatus ?? undefined,
    terminalConnectionHint: buildTerminalConnectionHint(chat.messages),
  }
}
