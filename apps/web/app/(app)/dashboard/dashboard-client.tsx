'use client'

import { useCallback, useRef, useEffect, useState, useMemo } from 'react'
import { postSessionSync, subscribeSessionSync } from '@/lib/session-sync-channel'
import { useSyncExternalStore } from 'react'
import { sessionStatusStore } from './hooks/use-session-status-store'
import { useSearchParams } from 'next/navigation'
import { useIsMobile } from '@ship/ui'
import { setApiToken } from '@/lib/api/client'
import { useGitHubRepos } from '@/lib/api/hooks/use-repos'
import { useGitHubBranches } from '@/lib/api/hooks/use-branches'
import { useModels, useDefaultModel, useSessionModel } from '@/lib/api/hooks/use-models'
import { useAgents, useDefaultAgent } from '@/lib/api/hooks/use-agents'
import { useDefaultRepo } from '@/lib/api/hooks/use-default-repo'
import { useCreateSession, useDeleteSession, useSessions } from '@/lib/api/hooks/use-sessions'
import { replyPermission, replyQuestion, rejectQuestion } from '@/lib/api/hooks/use-chat'
import type { ChatSession } from '@/lib/api/server'
import type { User } from '@/lib/api/types'
import type { UIMessage } from '@/lib/ai-elements-adapter'
import type { SessionPanelData } from './types'
import { useDashboardChat } from './hooks/use-dashboard-chat'
import { useDashboardSSE } from './hooks/use-dashboard-sse'
import { useDashboardState } from './hooks/use-dashboard-state'
import { useDashboardDerived } from './hooks/use-dashboard-derived'
import { useRightSidebar } from './hooks/use-right-sidebar'
import { useSessionSync } from './hooks/use-session-sync'
import { useProvisionSandboxWhenNeeded } from './hooks/use-provision-sandbox-when-needed'
import { DashboardLayout } from './components/dashboard-layout'
import { DashboardMainColumn } from './components/dashboard-main-column'

interface DashboardClientProps {
  sessions: ChatSession[]
  userId: string
  user: User
  initialSessionId?: string | null
  initialMessages?: UIMessage[]
  /** Stable timestamp from server for SSR-safe time formatting (avoids hydration mismatch) */
  serverTimestamp?: number
  /** Session JWT for API authentication */
  apiToken?: string
}

export function DashboardClient({
  sessions: initialSessions,
  userId,
  user,
  initialSessionId = null,
  initialMessages,
  serverTimestamp = Math.floor(Date.now() / 1000),
  apiToken,
}: DashboardClientProps) {
  // Set API auth token on mount (session JWT passed from server component)
  useEffect(() => {
    if (apiToken) setApiToken(apiToken)
  }, [apiToken])
  const searchParams = useSearchParams()
  const isMobile = useIsMobile()
  const modeRef = useRef('agent')
  const onAgentEventRef = useRef<((sessionId: string, event: { type: string; [k: string]: unknown }) => void) | null>(
    null,
  )

  const resumeStreamRef = useRef<((sessionId: string) => void) | null>(null)
  const onResumeStream = useCallback((id: string) => resumeStreamRef.current?.(id), [])
  const chat = useDashboardChat(initialSessions, initialSessionId, {
    onAgentEventRef,
    initialMessages,
    onResumeStream,
  })

  // Provision sandbox when opening a session that has none (error or never provisioned)
  useProvisionSandboxWhenNeeded(chat.activeSessionId)

  const handlePermissionReply = useCallback(
    async (permissionId: string, approved: boolean) => {
      if (!chat.activeSessionId) return
      await replyPermission(chat.activeSessionId, permissionId, approved ? 'once' : 'reject')
    },
    [chat.activeSessionId],
  )

  const handleQuestionReply = useCallback(
    async (questionId: string, response: string) => {
      if (!chat.activeSessionId) return
      await replyQuestion(chat.activeSessionId, questionId, response)
    },
    [chat.activeSessionId],
  )

  const handleQuestionSkip = useCallback(
    async (questionId: string) => {
      if (!chat.activeSessionId) return
      await rejectQuestion(chat.activeSessionId, questionId)
    },
    [chat.activeSessionId],
  )

  const { handleSend, processStreamEventForSession, resumeStream } = useDashboardSSE({ chat, modeRef })

  useEffect(() => {
    resumeStreamRef.current = resumeStream
    return () => {
      resumeStreamRef.current = null
    }
  }, [resumeStream])

  useEffect(() => {
    onAgentEventRef.current = processStreamEventForSession
    return () => {
      onAgentEventRef.current = null
    }
  }, [processStreamEventForSession])

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
  const { sessionModelId } = useSessionModel(chat.activeSessionId ?? undefined)
  const {
    sessions: swrSessions,
    mutate: mutateSessions,
  } = useSessions(userId, {
    refreshInterval: 8000,
    revalidateOnFocus: true,
  })

  // Sync SWR sessions into local state so list/sidebar stay fresh across tabs.
  // Merge to preserve optimistic session creates and titles (in localSessions but not yet in swrSessions).
  const prevSwrLenRef = useRef(0)
  const { activeSessionId, setLocalSessions } = chat
  useEffect(() => {
    if (swrSessions.length === 0 && prevSwrLenRef.current === 0) return
    prevSwrLenRef.current = swrSessions.length
    setLocalSessions((prev) => {
      const swrIds = new Set(swrSessions.map((s) => s.id))
      const optimisticOnly = prev.filter((s) => !swrIds.has(s.id))
      // Preserve optimistic titles when API returns session without title
      const merged = swrSessions.map((s) => {
        const p = prev.find((x) => x.id === s.id)
        return p && p.title && !s.title ? { ...s, title: p.title } : s
      })
      return [...optimisticOnly, ...merged]
    })
  }, [swrSessions, setLocalSessions])

  // Cross-tab sync: when another tab creates/deletes a session, revalidate; when streaming state changes, update
  const [streamingFromOtherTabs, setStreamingFromOtherTabs] = useState<Set<string>>(new Set())
  useEffect(() => {
    return subscribeSessionSync((msg) => {
      if (msg.type === 'session-created' || msg.type === 'session-deleted' || msg.type === 'sessions-invalidate') {
        mutateSessions()
      } else if (msg.type === 'session-streaming') {
        setStreamingFromOtherTabs((prev) => new Set(prev).add(msg.sessionId))
      } else if (msg.type === 'session-stopped') {
        setStreamingFromOtherTabs((prev) => {
          const next = new Set(prev)
          next.delete(msg.sessionId)
          return next
        })
      }
    })
  }, [mutateSessions])

  // Cross-tab streaming: broadcast when our sessions start/stop
  const storeMap = useSyncExternalStore(
    sessionStatusStore.subscribe,
    sessionStatusStore.getSnapshot,
    sessionStatusStore.getSnapshot,
  )
  const prevStoreRef = useRef<Map<string, { isRunning: boolean }>>(new Map())
  useEffect(() => {
    const toPost: Array<{ type: 'session-streaming' | 'session-stopped'; sessionId: string }> = []
    for (const [sessionId, status] of storeMap) {
      const prev = prevStoreRef.current.get(sessionId)?.isRunning ?? false
      if (status.isRunning !== prev) {
        toPost.push({ type: status.isRunning ? 'session-streaming' : 'session-stopped', sessionId })
      }
      prevStoreRef.current.set(sessionId, { isRunning: status.isRunning })
    }
    for (const msg of toPost) {
      postSessionSync(msg)
    }
  }, [storeMap])

  const streamingSessionIds = useMemo(() => {
    const ids = new Set(streamingFromOtherTabs)
    if (chat.activeSessionId && chat.isStreaming) ids.add(chat.activeSessionId)
    for (const [sessionId, status] of storeMap) {
      if (status.isRunning) ids.add(sessionId)
    }
    return ids
  }, [streamingFromOtherTabs, chat.activeSessionId, chat.isStreaming, storeMap])

  const state = useDashboardState({
    chat,
    handleSend,
    processStreamEventForSession,
    session: {
      createSession,
      deleteSession,
      userId,
      user,
      mutateSessions,
      onSessionCreated: () => postSessionSync({ type: 'session-created' }),
      onSessionDeleted: () => postSessionSync({ type: 'session-deleted' }),
    },
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
    initialSessionId,
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

  const activeSession = chat.activeSessionId
    ? chat.localSessions.find((session) => session.id === chat.activeSessionId) ?? null
    : null

  const activeSessionAgent =
    chat.activeSessionId
      ? agents.find(
          (agent) =>
            agent.id === activeSession?.agentType ||
            agent.id === chat.sessionInfo?.agentType ||
            (!!(activeSession?.model || sessionModelId) &&
              agent.models.some((model) => model.id === (activeSession?.model || sessionModelId))),
        ) ?? null
      : state.selectedAgent

  const activeSessionModel =
    chat.activeSessionId
      ? models.find((model) => model.id === (activeSession?.model || sessionModelId)) ?? null
      : state.selectedModel

  useEffect(() => {
    if (!chat.activeSessionId || !activeSessionAgent) return
    if (state.selectedAgent?.id !== activeSessionAgent.id) {
      state.handleAgentSelect(activeSessionAgent)
      return
    }

    if (activeSessionModel && state.selectedModel?.id !== activeSessionModel.id) {
      state.setSelectedModel(activeSessionModel)
    }
  }, [
    chat.activeSessionId,
    activeSessionAgent,
    activeSessionModel,
    state.selectedAgent,
    state.selectedModel,
    state.handleAgentSelect,
    state.setSelectedModel,
  ])

  const rightSidebarData: SessionPanelData | null = chat.activeSessionId
    ? {
        sessionId: chat.activeSessionId,
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
        selectedAgent: activeSessionAgent
          ? { id: activeSessionAgent.id, name: activeSessionAgent.name }
          : null,
        selectedModel: activeSessionModel
          ? {
              id: activeSessionModel.id,
              name: activeSessionModel.name,
              provider: activeSessionModel.provider,
            }
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
        onSessionDeleted: (id) => {
          chat.setLocalSessions((prev) => prev.filter((s) => s.id !== id))
          mutateSessions()
          postSessionSync({ type: 'session-deleted' })
        },
        onSessionDeleteFailed: (session) => {
          chat.setLocalSessions((prev) => {
            if (prev.some((s) => s.id === session.id)) return prev
            return [...prev, session].sort((a, b) => (b.lastActivity ?? 0) - (a.lastActivity ?? 0))
          })
        },
        onNewChat: () => {
          chat.setActiveSessionId(null)
          chat.setMessages([])
        },
        isStreaming: chat.isStreaming,
        streamingSessionIds,
      }}
    >
      <DashboardMainColumn
        isMobile={isMobile ?? false}
        user={user}
        serverTimestamp={serverTimestamp}
        header={{
          activeSessionId: chat.activeSessionId,
          displayTitle: derived.displayTitle,
          displayRepoLabel: derived.displayRepoLabel,
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
          onQuestionReply: handleQuestionReply,
          onQuestionSkip: handleQuestionSkip,
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
