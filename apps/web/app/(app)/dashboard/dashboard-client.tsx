'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import { SidebarProvider, SidebarInset, cn } from '@ship/ui'
import { AppSidebar } from '@/components/app-sidebar'
import { SessionPanel } from '@/components/chat/session-panel'
import { CreateSessionDialog } from '@/components/session/create-session-dialog'
import { useGitHubRepos, useModels, useCreateSession, type ChatSession, type GitHubRepo, type ModelInfo, type User } from '@/lib/api'
import { useDashboardChat } from './hooks/use-dashboard-chat'
import { useDashboardSSE } from './hooks/use-dashboard-sse'
import { DashboardHeader } from './components/dashboard-header'
import { DashboardMessages } from './components/dashboard-messages'
import { DashboardComposer } from './components/dashboard-composer'

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

  const {
    localSessions,
    setLocalSessions,
    activeSessionId,
    setActiveSessionId,
    messages,
    setMessages,
    isStreaming,
    setIsStreaming,
    wsStatus,
    messageQueue,
    setMessageQueue,
    openCodeUrl,
    setOpenCodeUrl,
    sessionTodos,
    setSessionTodos,
    fileDiffs,
    setFileDiffs,
    totalCost,
    setTotalCost,
    lastStepCost,
    setLastStepCost,
    sessionTitle,
    setSessionTitle,
    sessionInfo,
    setSessionInfo,
    streamStartTime,
    setStreamStartTime,
    streamingMessageRef,
    assistantTextRef,
    reasoningRef,
    connectWebSocket,
    handleStop,
  } = useDashboardChat(initialSessions)

  const { handleSend } = useDashboardSSE({
    activeSessionId,
    isStreaming,
    mode,
    setIsStreaming,
    setMessages,
    setTotalCost,
    setLastStepCost,
    setSessionTodos,
    setFileDiffs,
    setMessageQueue,
    setOpenCodeUrl,
    setSessionTitle,
    setSessionInfo,
    streamingMessageRef,
    assistantTextRef,
    reasoningRef,
    setStreamStartTime,
  })

  const { repos, isLoading: reposLoading } = useGitHubRepos(userId)
  const { models, groupedByProvider, isLoading: modelsLoading } = useModels()
  const { createSession, isCreating } = useCreateSession()

  // Activate session from URL param (e.g., /?session=abc123 from /session/[id] redirect)
  useEffect(() => {
    const sessionFromUrl = searchParams.get('session')
    if (sessionFromUrl && !activeSessionId) {
      setActiveSessionId(sessionFromUrl)
      connectWebSocket(sessionFromUrl)
      // Clean up the URL
      window.history.replaceState({}, '', `/session/${sessionFromUrl}`)
    }
  }, [searchParams, activeSessionId, setActiveSessionId, connectWebSocket])

  // Set default model once loaded
  useEffect(() => {
    if (!selectedModel && models.length > 0) {
      const preferredDefault = models.find((m) => m.id === 'opencode/kimi-k2.5-free' || m.id === 'kimi-k2.5-free')
      const markedDefault = models.find((m) => m.isDefault)
      setSelectedModel(preferredDefault || markedDefault || models[0])
    }
  }, [models, selectedModel])

  // Update selectedRepo when activeSessionId changes
  useEffect(() => {
    if (activeSessionId) {
      const session = localSessions.find((s) => s.id === activeSessionId)
      if (session) {
        const repo = repos.find((r) => r.owner === session.repoOwner && r.name === session.repoName)
        if (repo) setSelectedRepo(repo)
      }
    }
  }, [activeSessionId, localSessions, repos])

  // Process queued messages when streaming completes
  useEffect(() => {
    if (!isStreaming && messageQueue.length > 0 && activeSessionId) {
      const [next, ...rest] = messageQueue
      setMessageQueue(rest)
      handleSend(next)
    }
  }, [isStreaming, messageQueue, activeSessionId, handleSend, setMessageQueue])

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
          setLocalSessions((prev) => [newSessionData, ...prev])

          setActiveSessionId(newSession.id)
          window.history.replaceState({}, '', `/session/${newSession.id}`)
          connectWebSocket(newSession.id)

          const trimmedPrompt = prompt.trim()
          if (trimmedPrompt) {
            const savedPrompt = trimmedPrompt
            setPrompt('')
            handleSend(savedPrompt, mode, newSession.id)
          }
        }
      } catch (error) {
        console.error('Failed to create session:', error)
      }
    },
    [createSession, userId, selectedModel, prompt, mode, setLocalSessions, setActiveSessionId, connectWebSocket, handleSend, setPrompt],
  )

  const handleSubmit = useCallback(() => {
    if (activeSessionId) {
      if (!prompt.trim() || isStreaming) return
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
  }, [activeSessionId, prompt, isStreaming, selectedRepo, isCreating, selectedModel, handleSend, handleCreate, mode, setPrompt])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSubmit()
      }
    },
    [handleSubmit],
  )

  // Calculate stats
  const oneWeekAgo = Math.floor(Date.now() / 1000) - 7 * 24 * 60 * 60
  const recentSessions = localSessions.filter((s) => s.lastActivity > oneWeekAgo)
  const stats = {
    sessionsPastWeek: recentSessions.length,
    messagesPastWeek: recentSessions.reduce((acc, s) => acc + (s.messageCount || 0), 0),
    activeRepos: new Set(localSessions.map((s) => `${s.repoOwner}/${s.repoName}`)).size,
  }

  // Right sidebar state — persisted in localStorage
  const [rightSidebarOpen, setRightSidebarOpen] = useState(true)
  useEffect(() => {
    try {
      const saved = localStorage.getItem('ship-right-sidebar')
      if (saved !== null) setRightSidebarOpen(saved !== 'false')
    } catch {}
  }, [])
  const toggleRightSidebar = useCallback(() => {
    setRightSidebarOpen((prev) => {
      const next = !prev
      try { localStorage.setItem('ship-right-sidebar', String(next)) } catch {}
      return next
    })
  }, [])

  // Derive the display title from sessionInfo or sessionTitle state
  const displayTitle = useMemo(() => {
    return sessionInfo?.title || sessionTitle || undefined
  }, [sessionInfo?.title, sessionTitle])

  const sidebarDefaultOpen = !!activeSessionId
  const canSubmit = Boolean(
    activeSessionId ? prompt.trim() && !isStreaming : selectedRepo && prompt.trim() && !isCreating,
  )

  return (
    <SidebarProvider defaultOpen={sidebarDefaultOpen}>
      <AppSidebar
        sessions={localSessions}
        user={user}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        currentSessionId={activeSessionId || undefined}
        currentSessionTitle={displayTitle}
        onSessionDeleted={(sessionId) => {
          setLocalSessions((prev) => prev.filter((s) => s.id !== sessionId))
        }}
        isStreaming={isStreaming}
      />
      <SidebarInset>
        <div className="flex h-screen relative overflow-hidden">
          {/* Main column: header + content + composer */}
          <div className="flex-1 flex flex-col min-w-0">
            <DashboardHeader
              activeSessionId={activeSessionId}
              sessionTitle={displayTitle}
              wsStatus={wsStatus}
              rightSidebarOpen={rightSidebarOpen}
              onToggleRightSidebar={toggleRightSidebar}
            />

            <div className="flex-1 flex flex-col relative z-10 overflow-hidden">
              <div
                className={cn(
                  'flex-1 overflow-hidden',
                  activeSessionId ? 'opacity-100' : 'opacity-0 h-0',
                )}
              >
                <DashboardMessages
                  activeSessionId={activeSessionId}
                  messages={messages}
                  isStreaming={isStreaming}
                  streamingMessageId={streamingMessageRef.current}
                  streamStartTime={streamStartTime}
                  sessionTodos={sessionTodos}
                />
              </div>

              <DashboardComposer
                activeSessionId={activeSessionId}
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
                onStop={handleStop}
                isCreating={isCreating}
                isStreaming={isStreaming}
                messageQueueLength={messageQueue.length}
                stats={stats}
                canSubmit={canSubmit}
              />
            </div>
          </div>

          {/* Right sidebar — spans full page height */}
          {activeSessionId && rightSidebarOpen && (
            <div className="w-64 border-l border-border/40 bg-background/60 backdrop-blur-sm hidden md:block overflow-y-auto no-scrollbar">
              <SessionPanel
                sessionId={activeSessionId}
                repo={selectedRepo ? { owner: selectedRepo.owner, name: selectedRepo.name } : undefined}
                model={
                  selectedModel
                    ? {
                        id: selectedModel.id,
                        name: selectedModel.name,
                        provider: selectedModel.provider,
                        mode: mode,
                      }
                    : undefined
                }
                tokens={
                  lastStepCost?.tokens
                    ? {
                        ...lastStepCost.tokens,
                        contextLimit: 200000,
                      }
                    : undefined
                }
                cost={totalCost > 0 ? totalCost : undefined}
                todos={sessionTodos}
                diffs={fileDiffs}
                openCodeUrl={openCodeUrl || undefined}
                sessionInfo={sessionInfo || undefined}
                messages={messages}
              />
            </div>
          )}
        </div>
      </SidebarInset>

      <CreateSessionDialog
        isOpen={false}
        onClose={() => {}}
        onCreate={handleCreate}
        userId={userId}
      />
    </SidebarProvider>
  )
}
