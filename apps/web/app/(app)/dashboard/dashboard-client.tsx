'use client'

import { useCallback, useRef, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { useIsMobile } from '@ship/ui'
import { useGitHubRepos } from '@/lib/api/hooks/use-repos'
import { useGitHubBranches } from '@/lib/api/hooks/use-branches'
import { useModels, useDefaultModel } from '@/lib/api/hooks/use-models'
import { useAgents, useDefaultAgent } from '@/lib/api/hooks/use-agents'
import { useDefaultRepo } from '@/lib/api/hooks/use-default-repo'
import { useCreateSession, useDeleteSession, useSessions } from '@/lib/api/hooks/use-sessions'
import { replyPermission } from '@/lib/api/hooks/use-chat'
import type { ChatSession } from '@/lib/api/server'
import type { User } from '@/lib/api/types'
import type { SessionPanelData } from './types'
import { useDashboardChat } from './hooks/use-dashboard-chat'
import { useDashboardSSE } from './hooks/use-dashboard-sse'
import { useDashboardState } from './hooks/use-dashboard-state'
import { useDashboardDerived } from './hooks/use-dashboard-derived'
import { useRightSidebar } from './hooks/use-right-sidebar'
import { useSessionSync } from './hooks/use-session-sync'
import { DashboardLayout } from './components/dashboard-layout'
import { DashboardMainColumn } from './components/dashboard-main-column'

interface DashboardClientProps {
  sessions: ChatSession[]
  userId: string
  user: User
}

export function DashboardClient({ sessions: initialSessions, userId, user }: DashboardClientProps) {
  const searchParams = useSearchParams()
  const isMobile = useIsMobile()
  const modeRef = useRef('agent')

  const chat = useDashboardChat(initialSessions)

  const handlePermissionReply = useCallback(
    async (permissionId: string, approved: boolean) => {
      if (!chat.activeSessionId) return
      await replyPermission(chat.activeSessionId, permissionId, approved ? 'once' : 'reject')
    },
    [chat.activeSessionId],
  )

  const { handleSend } = useDashboardSSE({ chat, modeRef })

  const {
    repos,
    isLoading: reposLoading,
    loadMore: reposLoadMore,
    hasMore: reposHasMore,
    isLoadingMore: reposLoadingMore,
  } = useGitHubRepos(userId)
  const { models, isLoading: modelsLoading } = useModels()
  const { agents, isLoading: agentsLoading } = useAgents()
  const { defaultAgentId, isLoading: defaultAgentLoading } = useDefaultAgent(userId)
  const { defaultModelId, isLoading: defaultModelLoading } = useDefaultModel(userId)
  const { defaultRepoFullName, isLoading: defaultRepoLoading } = useDefaultRepo(userId)
  const { createSession, isCreating } = useCreateSession()
  const { deleteSession } = useDeleteSession()
  const {
    sessions: swrSessions,
    mutate: mutateSessions,
  } = useSessions(userId, {
    refreshInterval: !chat.activeSessionId ? 8000 : 0,
    revalidateOnFocus: true,
  })

  // Sync SWR sessions into local state when on homepage so list/sidebar stay fresh
  const prevSwrLenRef = useRef(0)
  useEffect(() => {
    if (chat.activeSessionId) return
    if (swrSessions.length === 0 && prevSwrLenRef.current === 0) return
    prevSwrLenRef.current = swrSessions.length
    chat.setLocalSessions(swrSessions)
  }, [chat.activeSessionId, swrSessions, chat])

  const state = useDashboardState({
    chat,
    handleSend,
    session: { createSession, deleteSession, userId, user, mutateSessions },
    data: {
      repos,
      isCreating,
      agents,
      agentsLoading,
      defaultAgentId,
      defaultAgentLoading,
      defaultRepoFullName,
      defaultRepoLoading,
      models,
    },
  })

  const { branches, isLoading: branchesLoading } = useGitHubBranches(
    userId,
    state.selectedRepo?.owner,
    state.selectedRepo?.name,
  )

  const derived = useDashboardDerived({
    chat,
    state,
    data: {
      repos,
      reposLoading: reposLoading ?? false,
      reposLoadMore,
      reposHasMore: reposHasMore ?? false,
      reposLoadingMore: reposLoadingMore ?? false,
      agents,
      agentsLoading,
      modelsLoading: modelsLoading ?? false,
      branches,
      branchesLoading: branchesLoading ?? false,
    },
    isCreating,
  })

  useSessionSync({
    sessionParam: searchParams.get('session'),
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
      models,
      selectedModel: state.selectedModel,
      setSelectedModel: state.setSelectedModel,
      defaultModelId,
      defaultModelLoading,
    },
    repo: {
      repos,
      selectedRepo: state.selectedRepo,
      setSelectedRepo: state.setSelectedRepo,
      defaultRepoLoading,
      defaultRepoFullName,
    },
  })

  const rightSidebar = useRightSidebar()

  modeRef.current = state.mode

  const rightSidebarData: SessionPanelData | null = chat.activeSessionId
    ? {
        sessionId: chat.activeSessionId,
        selectedRepo: state.selectedRepo,
        selectedAgent: state.selectedAgent,
        selectedModel: state.selectedModel,
        mode: state.mode,
        lastStepCost: chat.lastStepCost,
        totalCost: chat.totalCost,
        sessionTodos: chat.sessionTodos,
        fileDiffs: chat.fileDiffs,
        agentUrl: chat.agentUrl ?? '',
        agentSessionId: chat.agentSessionId || undefined,
        sessionInfo: chat.sessionInfo,
        messages: chat.messages,
      }
    : null

  return (
    <DashboardLayout
      defaultOpen={!!chat.activeSessionId}
      sidebarProps={{
        sessions: chat.localSessions,
        user,
        searchQuery: state.searchQuery,
        onSearchChange: state.setSearchQuery,
        currentSessionId: chat.activeSessionId ?? undefined,
        currentSessionTitle: derived.displayTitle,
        onSessionDeleted: (id) => chat.setLocalSessions((prev) => prev.filter((s) => s.id !== id)),
        onNewChat: () => {
          chat.setActiveSessionId(null)
          chat.setMessages([])
        },
        isStreaming: chat.isStreaming,
      }}
    >
      <DashboardMainColumn
        isMobile={isMobile ?? false}
        user={user}
        header={{
          activeSessionId: chat.activeSessionId,
          displayTitle: derived.displayTitle,
          wsStatus: chat.wsStatus,
          sandboxStatus: chat.sandboxStatus,
        }}
        messages={{
          messages: chat.messages,
          isStreaming: chat.isStreaming,
          streamingMessageId: chat.streamingMessageRef.current,
          streamStartTime: chat.streamStartTime,
          streamingStatus: chat.streamingStatus,
          streamingStatusSteps: chat.streamingStatusSteps,
          sessionTodos: chat.sessionTodos,
          onPermissionReply: handlePermissionReply,
        }}
        sessions={{
          localSessions: chat.localSessions,
          onSessionClick: state.handleSessionClick,
          onDeleteSession: state.handleDeleteSession,
        }}
        composer={{ context: derived.composerContext }}
        rightSidebar={rightSidebar}
        rightSidebarData={rightSidebarData}
        agentLabel={state.selectedAgent?.name ?? 'Ship'}
      />
    </DashboardLayout>
  )
}
