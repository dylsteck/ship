'use client'

import { useEffect } from 'react'
import type { ChatSession } from '@/lib/api/server'
import type { GitHubRepo, ModelInfo } from '@/lib/api/types'

interface UseSessionSyncParams {
  /** URL search params (from useSearchParams) */
  sessionParam: string | null
  /** Current active session ID */
  activeSessionId: string | null
  setActiveSessionId: (id: string) => void
  connectWebSocket: (id: string) => void
  /** Model data */
  models: ModelInfo[]
  selectedModel: ModelInfo | null
  setSelectedModel: (model: ModelInfo) => void
  /** User's saved default model ID from settings */
  defaultModelId: string | null
  /** Whether default model is still loading (wait before initial selection) */
  defaultModelLoading: boolean
  /** Repo data */
  repos: GitHubRepo[]
  selectedRepo: GitHubRepo | null
  setSelectedRepo: (repo: GitHubRepo) => void
  localSessions: ChatSession[]
  /** Whether default repo is still loading (wait before initial selection) */
  defaultRepoLoading: boolean
  /** User's saved default repo full name from settings */
  defaultRepoFullName: string | null
  /** Message queue */
  isStreaming: boolean
  messageQueue: string[]
  setMessageQueue: React.Dispatch<React.SetStateAction<string[]>>
  handleSend: (content: string) => void
}

/**
 * Handles side-effects that sync external state into the dashboard:
 * - Activating a session from the URL param (?session=xxx)
 * - Setting the default model when models load (uses saved default from settings)
 * - Syncing selectedRepo when active session changes
 * - Processing queued messages when streaming completes
 */
export function useSessionSync({
  sessionParam,
  activeSessionId,
  setActiveSessionId,
  connectWebSocket,
  models,
  selectedModel,
  setSelectedModel,
  defaultModelId,
  defaultModelLoading,
  repos,
  selectedRepo,
  setSelectedRepo,
  localSessions,
  defaultRepoLoading,
  defaultRepoFullName,
  isStreaming,
  messageQueue,
  setMessageQueue,
  handleSend,
}: UseSessionSyncParams) {
  // Activate session from URL param (e.g., /?session=abc123 from /session/[id] redirect)
  useEffect(() => {
    if (sessionParam && !activeSessionId) {
      setActiveSessionId(sessionParam)
      connectWebSocket(sessionParam)
      window.history.replaceState({}, '', `/session/${sessionParam}`)
    }
  }, [sessionParam, activeSessionId, setActiveSessionId, connectWebSocket])

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
