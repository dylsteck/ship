'use client'

import { useEffect } from 'react'
import type { ChatSession } from '@/lib/api/server'
import type { GitHubRepo, ModelInfo } from '@/lib/api/types'

export interface UseSessionSyncParams {
  initialSessionId: string | null
  sessionParam: string | null
  handleSend: (content: string) => void
  chat: {
    activeSessionId: string | null
    setActiveSessionId: (id: string) => void
    connectWebSocket: (id: string) => void
    localSessions: ChatSession[]
    isStreaming: boolean
    messageQueue: string[]
    setMessageQueue: React.Dispatch<React.SetStateAction<string[]>>
  }
  model: {
    models: ModelInfo[]
    selectedModel: ModelInfo | null
    setSelectedModel: (model: ModelInfo) => void
    defaultModelId: string | null
    defaultModelLoading: boolean
  }
  repo: {
    repos: GitHubRepo[]
    selectedRepo: GitHubRepo | null
    setSelectedRepo: (repo: GitHubRepo) => void
    defaultRepoLoading: boolean
    defaultRepoFullName: string | null
  }
}

/**
 * Handles side-effects that sync external state into the dashboard:
 * - Activating a session from the URL param (?session=xxx)
 * - Setting the default model when models load (uses saved default from settings)
 * - Syncing selectedRepo when active session changes
 * - Processing queued messages when streaming completes
 */
export function useSessionSync({
  initialSessionId,
  sessionParam,
  handleSend,
  chat,
  model,
  repo,
}: UseSessionSyncParams) {
  const {
    activeSessionId,
    setActiveSessionId,
    localSessions,
    isStreaming,
    messageQueue,
    setMessageQueue,
  } = chat
  const {
    models,
    selectedModel,
    setSelectedModel,
    defaultModelId,
    defaultModelLoading,
  } = model
  const {
    repos,
    selectedRepo,
    setSelectedRepo,
    defaultRepoLoading,
    defaultRepoFullName,
  } = repo
  // Support the legacy /?session=<id> bootstrap as a fallback.
  useEffect(() => {
    if (!initialSessionId && sessionParam && !activeSessionId) {
      setActiveSessionId(sessionParam)
      window.history.replaceState({}, '', `/session/${sessionParam}`)
    }
  }, [initialSessionId, sessionParam, activeSessionId, setActiveSessionId])

  // Set default model once defaults have loaded — prefer user's saved default from settings
  // Wait for defaultModelLoading to finish so we don't pick Kimi before "big pickle" loads
  useEffect(() => {
    if (defaultModelLoading || models.length === 0 || selectedModel) return

    // Match by id, or legacy format (e.g. "big-pickle" -> "opencode/big-pickle")
    const findModel = (id: string) =>
      models.find((m) => m.id === id || m.id === `opencode/${id}`)
    const savedDefault = defaultModelId ? findModel(defaultModelId) : null
    const markedDefault = models.find((m) => m.isDefault)
    setSelectedModel(savedDefault || markedDefault || models[0])
  }, [models, selectedModel, setSelectedModel, defaultModelId, defaultModelLoading])

  // Update selectedRepo when activeSessionId changes
  useEffect(() => {
    if (activeSessionId) {
      const session = localSessions.find((s) => s.id === activeSessionId)
      if (session) {
        const repo = repos.find(
          (r) => r.owner === session.repoOwner && r.name === session.repoName,
        )
        if (repo) setSelectedRepo(repo)
      }
    }
  }, [activeSessionId, localSessions, repos, setSelectedRepo])

  // Set default repo when no active session — wait for defaultRepoFullName to load first
  useEffect(() => {
    if (activeSessionId || defaultRepoLoading || selectedRepo) return
    if (repos.length === 0) return

    if (defaultRepoFullName) {
      const match = repos.find((r) => r.fullName === defaultRepoFullName)
      if (match) {
        setSelectedRepo(match)
        return
      }
    }
  }, [activeSessionId, defaultRepoLoading, defaultRepoFullName, repos, selectedRepo, setSelectedRepo])

  // Process queued messages when streaming completes
  useEffect(() => {
    if (!isStreaming && messageQueue.length > 0 && activeSessionId) {
      const [next, ...rest] = messageQueue
      setMessageQueue(rest)
      handleSend(next)
    }
  }, [isStreaming, messageQueue, activeSessionId, handleSend, setMessageQueue])
}
