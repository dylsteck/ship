'use client'

import { useState, useCallback, useMemo, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { HugeiconsIcon } from '@hugeicons/react'
import { Cancel01Icon } from '@hugeicons/core-free-icons'
import { SidebarProvider, SidebarInset, cn, useIsMobile } from '@ship/ui'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@ship/ui'
import { AppSidebar } from '@/components/app-sidebar'
import { useGitHubRepos } from '@/lib/api/hooks/use-repos'
import { useModels, useDefaultModel } from '@/lib/api/hooks/use-models'
import { useAgents, useDefaultAgent } from '@/lib/api/hooks/use-agents'
import { useDefaultRepo } from '@/lib/api/hooks/use-default-repo'
import { useCreateSession, useDeleteSession } from '@/lib/api/hooks/use-sessions'
import { replyPermission } from '@/lib/api/hooks/use-chat'
import type { ChatSession } from '@/lib/api/server'
import type { GitHubRepo, ModelInfo, AgentInfo, AgentMode, AgentModeId, User } from '@/lib/api/types'
import type { ComposerContextValue } from './components/composer/composer-context'
import { useDashboardChat } from './hooks/use-dashboard-chat'
import { useDashboardSSE } from './hooks/use-dashboard-sse'
import { useRightSidebar } from './hooks/use-right-sidebar'
import { useSessionSync } from './hooks/use-session-sync'
import { DashboardHeader } from './components/dashboard-header'
import { DashboardMessages } from './components/dashboard-messages'
import { DashboardComposer } from './components/composer'
import { RightSidebar } from './components/right-sidebar'
import { MobileSessionList } from './components/mobile-session-list'

function formatRelativeTime(timestamp: number): string {
  const seconds = Math.floor(Date.now() / 1000 - timestamp)
  if (seconds < 60) return 'now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`
  const days = Math.floor(seconds / 86400)
  if (days < 14) return `${days}d`
  if (days < 60) return `${Math.floor(days / 7)}w`
  return `${Math.floor(days / 30)}mo`
}

interface DashboardClientProps {
  sessions: ChatSession[]
  userId: string
  user: User
}

const DEFAULT_MODES: AgentMode[] = [
  { id: 'agent', label: 'agent' },
  { id: 'plan', label: 'plan' },
  { id: 'ask', label: 'ask' },
]

export function DashboardClient({ sessions: initialSessions, userId, user }: DashboardClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [selectedRepo, setSelectedRepo] = useState<GitHubRepo | null>(null)
  const [selectedAgent, setSelectedAgent] = useState<AgentInfo | null>(null)
  const [selectedModel, setSelectedModel] = useState<ModelInfo | null>(null)
  const [mode, setMode] = useState<AgentModeId>('agent')
  const [availableModes, setAvailableModes] = useState<AgentMode[]>(DEFAULT_MODES)
  const [prompt, setPrompt] = useState<string>('')

  const { deleteSession } = useDeleteSession()
  const isMobile = useIsMobile()

  // ---- Core chat state ----
  const chat = useDashboardChat(initialSessions)

  const handlePermissionReply = useCallback(
    async (permissionId: string, approved: boolean) => {
      if (!chat.activeSessionId) return
      await replyPermission(chat.activeSessionId, permissionId, approved ? 'once' : 'reject')
    },
    [chat.activeSessionId],
  )

  // ---- SSE streaming ----
  const { handleSend } = useDashboardSSE({
    activeSessionId: chat.activeSessionId,
    isStreaming: chat.isStreaming,
    mode,
    setIsStreaming: chat.setIsStreaming,
    setMessages: chat.setMessages,
    setTotalCost: chat.setTotalCost,
    setLastStepCost: chat.setLastStepCost,
    setSessionTodos: chat.setSessionTodos,
    setFileDiffs: chat.setFileDiffs,
    setMessageQueue: chat.setMessageQueue,
    setAgentUrl: chat.setAgentUrl,
    setSessionTitle: chat.setSessionTitle,
    setSessionInfo: chat.setSessionInfo,
    updateSessionTitle: chat.updateSessionTitle,
    streamingMessageRef: chat.streamingMessageRef,
    assistantTextRef: chat.assistantTextRef,
    reasoningRef: chat.reasoningRef,
    setStreamStartTime: chat.setStreamStartTime,
  })

  // ---- Data fetching ----
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

  // ---- Agent initialization (runs once when agents load) ----
  useEffect(() => {
    if (agentsLoading || defaultAgentLoading || agents.length === 0 || selectedAgent) return
    const agentId = defaultAgentId || 'cursor'
    const agent = agents.find((a) => a.id === agentId) || agents[0]
    if (agent) {
      setSelectedAgent(agent)
      setAvailableModes(agent.modes)
      setMode(agent.modes[0]?.id || 'agent')
      if (agent.models.length > 0) {
        setSelectedModel(agent.models[0])
      }
    }
  }, [agents, agentsLoading, defaultAgentId, defaultAgentLoading, selectedAgent])

  const handleAgentSelect = useCallback((agent: AgentInfo) => {
    setSelectedAgent(agent)
    setAvailableModes(agent.modes)
    setMode(agent.modes[0]?.id || 'agent')
    if (agent.models.length > 0) {
      setSelectedModel(agent.models[0])
    }
  }, [])

  // Group agent's models by provider
  const groupedByProvider = useMemo(() => {
    const agentModels = selectedAgent?.models || []
    return agentModels.reduce<Record<string, ModelInfo[]>>((acc, model) => {
      const provider = model.provider || 'Other'
      if (!acc[provider]) acc[provider] = []
      acc[provider].push(model)
      return acc
    }, {})
  }, [selectedAgent])

  // ---- Sync effects (URL param, default model, repo, message queue) ----
  useSessionSync({
    sessionParam: searchParams.get('session'),
    activeSessionId: chat.activeSessionId,
    setActiveSessionId: chat.setActiveSessionId,
    connectWebSocket: chat.connectWebSocket,
    models,
    selectedModel,
    setSelectedModel,
    defaultModelId,
    defaultModelLoading,
    repos,
    selectedRepo,
    setSelectedRepo,
    localSessions: chat.localSessions,
    defaultRepoLoading,
    defaultRepoFullName,
    isStreaming: chat.isStreaming,
    messageQueue: chat.messageQueue,
    setMessageQueue: chat.setMessageQueue,
    handleSend,
  })

  // ---- Default repo fallback when no saved default ----
  useEffect(() => {
    if (chat.activeSessionId || defaultRepoLoading || selectedRepo) return
    if (repos.length === 0) return
    if (defaultRepoFullName) return // useSessionSync handles saved default

    const userOwnedRepo = repos.find((r) => r.owner === user.username)
    if (userOwnedRepo) setSelectedRepo(userOwnedRepo)
  }, [chat.activeSessionId, defaultRepoLoading, defaultRepoFullName, repos, selectedRepo, user.username, setSelectedRepo])

  // ---- Right sidebar ----
  const rightSidebar = useRightSidebar()

  // ---- Session creation ----
  const handleCreate = useCallback(
    async (data: { repoOwner: string; repoName: string; model?: string }) => {
      try {
        const newSession = await createSession({
          userId,
          repoOwner: data.repoOwner,
          repoName: data.repoName,
          model: data.model || selectedModel?.id || 'cursor/default',
          agentType: selectedAgent?.id || 'cursor',
        })

        if (newSession) {
          const newSessionData: ChatSession = {
            id: newSession.id,
            userId,
            repoOwner: data.repoOwner,
            repoName: data.repoName,
            status: 'active',
            lastActivity: Math.floor(Date.now() / 1000),
            createdAt: Math.floor(Date.now() / 1000),
            archivedAt: null,
            messageCount: 0,
          }
          chat.setLocalSessions((prev) => [newSessionData, ...prev])
          chat.setActiveSessionId(newSession.id)
          window.history.replaceState({}, '', `/session/${newSession.id}`)
          chat.connectWebSocket(newSession.id)

          const trimmedPrompt = prompt.trim()
          if (trimmedPrompt) {
            setPrompt('')
            handleSend(trimmedPrompt, mode, newSession.id)
          }
        }
      } catch (error) {
        console.error('Failed to create session:', error)
      }
    },
    [createSession, userId, selectedModel, selectedAgent, prompt, mode, chat, handleSend],
  )

  // ---- Submit / keyboard ----
  const handleSubmit = useCallback(() => {
    if (chat.activeSessionId) {
      if (!prompt.trim() || chat.isStreaming) return
      const content = prompt.trim()
      setPrompt('')
      handleSend(content, mode)
    } else {
      if (!selectedRepo || !prompt.trim() || isCreating) return
      handleCreate({
        repoOwner: selectedRepo.owner,
        repoName: selectedRepo.name,
        model: selectedModel?.id,
      })
    }
  }, [
    chat.activeSessionId,
    chat.isStreaming,
    prompt,
    selectedRepo,
    isCreating,
    selectedModel,
    handleSend,
    handleCreate,
    mode,
  ])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSubmit()
      }
    },
    [handleSubmit],
  )

  // ---- Derived values ----
  const displayTitle = useMemo(
    () => chat.sessionInfo?.title || chat.sessionTitle || undefined,
    [chat.sessionInfo?.title, chat.sessionTitle],
  )

  const stats = useMemo(() => {
    const now = Math.floor(Date.now() / 1000)
    const oneDay = 24 * 60 * 60
    const oneWeekAgo = now - 7 * oneDay
    const recent = chat.localSessions.filter((s) => s.lastActivity > oneWeekAgo)

    const sessionsChartData: number[] = []
    const messagesChartData: number[] = []
    const activeReposChartData: number[] = []

    for (let i = 6; i >= 0; i--) {
      const bucketStart = now - (i + 1) * oneDay
      const bucketEnd = now - i * oneDay
      const inBucket = chat.localSessions.filter((s) => s.lastActivity >= bucketStart && s.lastActivity < bucketEnd)
      sessionsChartData.push(inBucket.length)
      messagesChartData.push(inBucket.reduce((acc, s) => acc + (s.messageCount || 0), 0))
      activeReposChartData.push(new Set(inBucket.map((s) => `${s.repoOwner}/${s.repoName}`)).size)
    }

    return {
      sessionsPastWeek: recent.length,
      messagesPastWeek: recent.reduce((acc, s) => acc + (s.messageCount || 0), 0),
      activeRepos: new Set(chat.localSessions.map((s) => `${s.repoOwner}/${s.repoName}`)).size,
      sessionsChartData,
      messagesChartData,
      activeReposChartData,
    }
  }, [chat.localSessions])

  const canSubmit = Boolean(
    chat.activeSessionId ? prompt.trim() && !chat.isStreaming : selectedRepo && prompt.trim() && !isCreating,
  )

  // ---- Build composer context once, reuse everywhere ----
  const composerContext: ComposerContextValue = useMemo(
    () => ({
      activeSessionId: chat.activeSessionId,
      prompt,
      onPromptChange: setPrompt,
      onKeyDown: handleKeyDown,
      selectedRepo,
      onRepoSelect: setSelectedRepo,
      repos,
      reposLoading: reposLoading ?? false,
      reposLoadMore,
      reposHasMore: reposHasMore ?? false,
      reposLoadingMore: reposLoadingMore ?? false,
      selectedAgent,
      onAgentSelect: handleAgentSelect,
      agents,
      agentsLoading,
      selectedModel,
      onModelSelect: setSelectedModel,
      modelsLoading: modelsLoading ?? false,
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
      chat.activeSessionId, prompt, handleKeyDown,
      selectedRepo, repos, reposLoading, reposLoadMore, reposHasMore, reposLoadingMore,
      selectedAgent, handleAgentSelect, agents, agentsLoading,
      selectedModel, modelsLoading, groupedByProvider,
      mode, availableModes,
      handleSubmit, chat.handleStop, isCreating, chat.isStreaming, chat.messageQueue.length, canSubmit,
    ],
  )

  // ---- Session list handlers ----
  const handleSessionClick = useCallback(
    (session: ChatSession) => {
      chat.setActiveSessionId(session.id)
      chat.connectWebSocket(session.id)
      window.history.replaceState({}, '', `/session/${session.id}`)
    },
    [chat],
  )

  const handleDeleteSession = useCallback(
    async (sessionId: string) => {
      try {
        await deleteSession({ sessionId })
        chat.setLocalSessions((prev) => prev.filter((s) => s.id !== sessionId))
        if (chat.activeSessionId === sessionId) {
          chat.setActiveSessionId(null)
          chat.setMessages([])
          router.push('/')
          window.location.href = '/'
        } else {
          router.refresh()
        }
      } catch (error) {
        console.error('Failed to delete session:', error)
        router.refresh()
      }
    },
    [chat, deleteSession, router],
  )

  // ---- Render ----
  return (
    <SidebarProvider defaultOpen={!!chat.activeSessionId}>
      <AppSidebar
        className="hidden md:block"
        sessions={chat.localSessions}
        user={user}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        currentSessionId={chat.activeSessionId || undefined}
        currentSessionTitle={displayTitle}
        onSessionDeleted={(id) => chat.setLocalSessions((prev) => prev.filter((s) => s.id !== id))}
        onNewChat={() => {
          chat.setActiveSessionId(null)
          chat.setMessages([])
        }}
        isStreaming={chat.isStreaming}
      />

      <SidebarInset>
        <div className="flex h-screen h-[100dvh] relative overflow-hidden">
          {/* Main column */}
          <div className="flex-1 flex flex-col min-w-0">
            <DashboardHeader
              activeSessionId={chat.activeSessionId}
              sessionTitle={displayTitle}
              wsStatus={chat.wsStatus}
              sandboxStatus={chat.sandboxStatus}
              rightSidebarOpen={rightSidebar.desktopOpen}
              onToggleRightSidebar={rightSidebar.toggle}
              showBackButton={true}
              user={user}
            />

            <div className="flex-1 flex flex-col relative z-10 overflow-hidden">
              {/* Mobile: composer at top + session list (no active session) OR messages + composer at bottom (active session) */}
              <div className="md:hidden flex-1 flex flex-col overflow-hidden">
                {!chat.activeSessionId && (
                  <>
                    <div className="shrink-0">
                      <DashboardComposer context={composerContext} stats={stats} compactLayout={true} />
                    </div>
                    <MobileSessionList
                      sessions={chat.localSessions}
                      isMobile={isMobile ?? false}
                      onSessionClick={handleSessionClick}
                      onDeleteSession={handleDeleteSession}
                    />
                  </>
                )}

                {/* Active session on mobile: messages + composer at bottom */}
                {chat.activeSessionId && (
                  <div className="flex-1 flex flex-col overflow-hidden">
                    <div className="flex-1 overflow-hidden">
                      <DashboardMessages
                        activeSessionId={chat.activeSessionId}
                        messages={chat.messages}
                        isStreaming={chat.isStreaming}
                        streamingMessageId={chat.streamingMessageRef.current}
                        streamStartTime={chat.streamStartTime}
                        sessionTodos={chat.sessionTodos}
                        onPermissionReply={handlePermissionReply}
                      />
                    </div>
                    <DashboardComposer context={composerContext} stats={stats} compactLayout={false} />
                  </div>
                )}
              </div>

              {/* Desktop: composer at bottom */}
              <div className="hidden md:flex flex-col h-full">
                <div className={cn('flex-1 overflow-hidden', chat.activeSessionId ? 'opacity-100' : 'opacity-0 h-0')}>
                  <DashboardMessages
                    activeSessionId={chat.activeSessionId}
                    messages={chat.messages}
                    isStreaming={chat.isStreaming}
                    streamingMessageId={chat.streamingMessageRef.current}
                    streamStartTime={chat.streamStartTime}
                    sessionTodos={chat.sessionTodos}
                    onPermissionReply={handlePermissionReply}
                  />
                </div>

                <DashboardComposer context={composerContext} stats={stats} />
              </div>
            </div>
          </div>

          {/* Right sidebar (desktop + mobile) */}
          {chat.activeSessionId && (
            <RightSidebar
              data={{
                sessionId: chat.activeSessionId,
                selectedRepo,
                selectedAgent,
                selectedModel,
                mode,
                lastStepCost: chat.lastStepCost,
                totalCost: chat.totalCost,
                sessionTodos: chat.sessionTodos,
                fileDiffs: chat.fileDiffs,
                agentUrl: chat.agentUrl,
                sessionInfo: chat.sessionInfo,
                messages: chat.messages,
              }}
              desktopOpen={rightSidebar.desktopOpen}
              mobileOpen={rightSidebar.mobileOpen}
              isMobile={rightSidebar.isMobile ?? false}
              onMobileOpenChange={rightSidebar.setMobileOpen}
            />
          )}
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
