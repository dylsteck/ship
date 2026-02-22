'use client'

import { useState, useCallback, useMemo, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { SidebarProvider, SidebarInset, cn } from '@ship/ui'
import { AppSidebar } from '@/components/app-sidebar'
import { useGitHubRepos } from '@/lib/api/hooks/use-repos'
import { useModels, useDefaultModel } from '@/lib/api/hooks/use-models'
import { useDefaultRepo } from '@/lib/api/hooks/use-default-repo'
import { useCreateSession } from '@/lib/api/hooks/use-sessions'
import type { ChatSession } from '@/lib/api/server'
import type { GitHubRepo, ModelInfo, User } from '@/lib/api/types'
import { useDashboardChat } from './hooks/use-dashboard-chat'
import { useDashboardSSE } from './hooks/use-dashboard-sse'
import { useRightSidebar } from './hooks/use-right-sidebar'
import { useSessionSync } from './hooks/use-session-sync'
import { DashboardHeader } from './components/dashboard-header'
import { DashboardMessages } from './components/dashboard-messages'
import { DashboardComposer } from './components/composer'
import { RightSidebar } from './components/right-sidebar'

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

function groupSessionsByTime(sessions: ChatSession[]): { label: string; sessions: ChatSession[] }[] {
  const now = Math.floor(Date.now() / 1000)
  const oneDay = 24 * 60 * 60
  const todayStart = now - oneDay
  const yesterdayStart = now - 2 * oneDay
  const weekStart = now - 7 * oneDay
  const monthStart = now - 30 * oneDay

  const today: ChatSession[] = []
  const yesterday: ChatSession[] = []
  const thisWeek: ChatSession[] = []
  const thisMonth: ChatSession[] = []
  const older: ChatSession[] = []

  for (const s of sessions) {
    const t = s.lastActivity
    if (t >= todayStart) today.push(s)
    else if (t >= yesterdayStart) yesterday.push(s)
    else if (t >= weekStart) thisWeek.push(s)
    else if (t >= monthStart) thisMonth.push(s)
    else older.push(s)
  }

  const sortByActivity = (a: ChatSession, b: ChatSession) => b.lastActivity - a.lastActivity
  const groups: { label: string; sessions: ChatSession[] }[] = []
  if (today.length) groups.push({ label: 'Today', sessions: today.sort(sortByActivity) })
  if (yesterday.length) groups.push({ label: 'Yesterday', sessions: yesterday.sort(sortByActivity) })
  if (thisWeek.length) groups.push({ label: 'This Week', sessions: thisWeek.sort(sortByActivity) })
  if (thisMonth.length) groups.push({ label: 'This Month', sessions: thisMonth.sort(sortByActivity) })
  if (older.length) groups.push({ label: 'Older', sessions: older.sort(sortByActivity) })
  return groups
}

interface DashboardClientProps {
  sessions: ChatSession[]
  userId: string
  user: User
}

export function DashboardClient({ sessions: initialSessions, userId, user }: DashboardClientProps) {
  const searchParams = useSearchParams()
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedRepo, setSelectedRepo] = useState<GitHubRepo | null>(null)
  const [selectedModel, setSelectedModel] = useState<ModelInfo | null>(null)
  const [mode, setMode] = useState<'build' | 'plan'>('build')
  const [prompt, setPrompt] = useState('')

  // ---- Core chat state ----
  const chat = useDashboardChat(initialSessions)

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
    setOpenCodeUrl: chat.setOpenCodeUrl,
    setSessionTitle: chat.setSessionTitle,
    setSessionInfo: chat.setSessionInfo,
    updateSessionTitle: chat.updateSessionTitle,
    streamingMessageRef: chat.streamingMessageRef,
    assistantTextRef: chat.assistantTextRef,
    reasoningRef: chat.reasoningRef,
    setStreamStartTime: chat.setStreamStartTime,
  })

  // ---- Data fetching ----
  const { repos, isLoading: reposLoading } = useGitHubRepos(userId)
  const { models, groupedByProvider, isLoading: modelsLoading } = useModels()
  const { defaultModelId, isLoading: defaultModelLoading } = useDefaultModel(userId)
  const { defaultRepoFullName, isLoading: defaultRepoLoading } = useDefaultRepo(userId)
  const { createSession, isCreating } = useCreateSession()

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

    // No saved default: use first repo owned by user
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
          model: data.model || selectedModel?.id || 'opencode/kimi-k2.5-free',
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
    [createSession, userId, selectedModel, prompt, mode, chat, handleSend],
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

    // Build 7 daily buckets (oldest to newest) for chart data
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
                      <DashboardComposer
                        compactLayout
                        activeSessionId={chat.activeSessionId}
                        prompt={prompt}
                        onPromptChange={setPrompt}
                        onKeyDown={handleKeyDown}
                        selectedRepo={selectedRepo}
                        onRepoSelect={setSelectedRepo}
                        repos={repos}
                        reposLoading={reposLoading}
                        selectedModel={selectedModel}
                        onModelSelect={setSelectedModel}
                        modelsLoading={modelsLoading}
                        groupedByProvider={groupedByProvider}
                        mode={mode}
                        onModeChange={setMode}
                        onSubmit={handleSubmit}
                        onStop={chat.handleStop}
                        isCreating={isCreating}
                        isStreaming={chat.isStreaming}
                        messageQueueLength={chat.messageQueue.length}
                        stats={stats}
                        canSubmit={canSubmit}
                      />
                    </div>

                    {chat.localSessions.length > 0 && (
                      <div className="flex-1 overflow-y-auto px-3 pb-3 pt-2 min-h-0">
                        {groupSessionsByTime(chat.localSessions.filter((s) => !s.archivedAt)).map((group) => (
                          <div key={group.label} className="mb-6">
                            <h3 className="text-xs font-medium text-muted-foreground mb-2 sticky top-0 bg-background py-1">
                              {group.label}
                            </h3>
                            <div className="space-y-1">
                              {group.sessions.map((session) => {
                                const sessionName = session.title || session.repoName
                                const repoPath = `${session.repoOwner}/${session.repoName}`
                                return (
                                  <button
                                    key={session.id}
                                    onClick={() => {
                                      chat.setActiveSessionId(session.id)
                                      chat.connectWebSocket(session.id)
                                      window.history.replaceState({}, '', `/session/${session.id}`)
                                    }}
                                    className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-muted/50 transition-colors border border-transparent hover:border-border/50"
                                  >
                                    <div className="text-sm font-medium truncate">{sessionName}</div>
                                    <div className="flex items-center justify-between gap-2 mt-0.5">
                                      <span className="text-xs text-muted-foreground truncate">
                                        {repoPath}
                                      </span>
                                      <span className="text-xs text-muted-foreground shrink-0">
                                        {formatRelativeTime(session.lastActivity)}
                                      </span>
                                    </div>
                                  </button>
                                )
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
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
                      />
                    </div>
                    <DashboardComposer
                      activeSessionId={chat.activeSessionId}
                      prompt={prompt}
                      onPromptChange={setPrompt}
                      onKeyDown={handleKeyDown}
                      selectedRepo={selectedRepo}
                      onRepoSelect={setSelectedRepo}
                      repos={repos}
                      reposLoading={reposLoading}
                      selectedModel={selectedModel}
                      onModelSelect={setSelectedModel}
                      modelsLoading={modelsLoading}
                      groupedByProvider={groupedByProvider}
                      mode={mode}
                      onModeChange={setMode}
                      onSubmit={handleSubmit}
                      onStop={chat.handleStop}
                      isCreating={isCreating}
                      isStreaming={chat.isStreaming}
                      messageQueueLength={chat.messageQueue.length}
                      stats={stats}
                      canSubmit={canSubmit}
                    />
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
                  />
                </div>

                <DashboardComposer
                  activeSessionId={chat.activeSessionId}
                  prompt={prompt}
                  onPromptChange={setPrompt}
                  onKeyDown={handleKeyDown}
                  selectedRepo={selectedRepo}
                  onRepoSelect={setSelectedRepo}
                  repos={repos}
                  reposLoading={reposLoading}
                  selectedModel={selectedModel}
                  onModelSelect={setSelectedModel}
                  modelsLoading={modelsLoading}
                  groupedByProvider={groupedByProvider}
                  mode={mode}
                  onModeChange={setMode}
                  onSubmit={handleSubmit}
                  onStop={chat.handleStop}
                  isCreating={isCreating}
                  isStreaming={chat.isStreaming}
                  messageQueueLength={chat.messageQueue.length}
                  stats={stats}
                  canSubmit={canSubmit}
                />
              </div>
            </div>
          </div>

          {/* Right sidebar (desktop + mobile) */}
          {chat.activeSessionId && (
            <RightSidebar
              data={{
                sessionId: chat.activeSessionId,
                selectedRepo,
                selectedModel,
                mode,
                lastStepCost: chat.lastStepCost,
                totalCost: chat.totalCost,
                sessionTodos: chat.sessionTodos,
                fileDiffs: chat.fileDiffs,
                openCodeUrl: chat.openCodeUrl,
                sessionInfo: chat.sessionInfo,
                messages: chat.messages,
              }}
              desktopOpen={rightSidebar.desktopOpen}
              mobileOpen={rightSidebar.mobileOpen}
              isMobile={rightSidebar.isMobile}
              onMobileOpenChange={rightSidebar.setMobileOpen}
            />
          )}
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
