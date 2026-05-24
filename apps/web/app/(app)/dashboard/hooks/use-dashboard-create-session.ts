'use client'

import { useCallback } from 'react'
import type { ChatSession } from '@/lib/api/server'
import type { CreateSessionParams, GitHubRepo, ModelInfo, AgentInfo, AgentModeId } from '@/lib/api/types'
import { DEFAULT_ACP_MODEL_ID } from './dashboard-mode-storage'
import type { useDashboardChat } from './use-dashboard-chat'

export function useDashboardCreateSession(params: {
  chat: ReturnType<typeof useDashboardChat>
  prompt: string
  setPrompt: (value: string) => void
  selectedModel: ModelInfo | null
  selectedAgent: AgentInfo | null
  mode: AgentModeId
  streamSessionInBackground: (sessionId: string, content: string, sessionMode: string, modelId?: string) => Promise<void>
  createSession: (arg: CreateSessionParams) => Promise<ChatSession | undefined>
  userId: string
  mutateSessions?: () => void
  onSessionCreated?: (sessionId: string) => void
}) {
  const {
    chat,
    prompt,
    setPrompt,
    selectedModel,
    selectedAgent,
    mode,
    streamSessionInBackground,
    createSession,
    userId,
    mutateSessions,
    onSessionCreated,
  } = params

  return useCallback(
    async (data: { repoOwner: string; repoName: string; model?: string; baseBranch?: string }) => {
      try {
        const trimmedPrompt = prompt.trim()
        const initialTitle = trimmedPrompt.length > 60 ? `${trimmedPrompt.slice(0, 57)}...` : trimmedPrompt
        const newSession = await createSession({
          repoOwner: data.repoOwner,
          repoName: data.repoName,
          model: data.model || selectedModel?.id || DEFAULT_ACP_MODEL_ID,
          agentType: selectedAgent?.id || 'opencode',
          baseBranch: data.baseBranch || 'main',
          title: initialTitle || undefined,
        })

        if (!newSession) return

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
          title: (initialTitle || newSession.title) ?? undefined,
          model: newSession.model ?? data.model ?? selectedModel?.id,
          agentType: newSession.agentType ?? selectedAgent?.id,
        }
        chat.setLocalSessions((prev) => [newSessionData, ...prev])
        mutateSessions?.()
        onSessionCreated?.(newSession.id)

        if (trimmedPrompt) {
          setPrompt('')
          streamSessionInBackground(newSession.id, trimmedPrompt, mode, newSessionData.model)
        }
      } catch (error) {
        console.error('Failed to create session:', error)
      }
    },
    [
      chat,
      createSession,
      mode,
      mutateSessions,
      onSessionCreated,
      prompt,
      selectedAgent,
      selectedModel,
      setPrompt,
      streamSessionInBackground,
      userId,
    ],
  )
}

export function useDashboardSubmit(params: {
  chat: ReturnType<typeof useDashboardChat>
  prompt: string
  setPrompt: (value: string) => void
  selectedRepo: GitHubRepo | null
  selectedModel: ModelInfo | null
  mode: AgentModeId
  isCreating: boolean
  handleSend: (content: string, modeOverride?: string, sessionIdOverride?: string) => void
  handleCreate: (data: { repoOwner: string; repoName: string; model?: string; baseBranch?: string }) => Promise<void>
}) {
  const { chat, prompt, setPrompt, selectedRepo, selectedModel, mode, isCreating, handleSend, handleCreate } = params

  return useCallback(() => {
    if (chat.activeSessionId) {
      if (!prompt.trim() || chat.isStreaming) return
      const content = prompt.trim()
      setPrompt('')
      handleSend(content, mode)
      return
    }
    if (!selectedRepo || !prompt.trim() || isCreating) return
    handleCreate({
      repoOwner: selectedRepo.owner,
      repoName: selectedRepo.name,
      model: selectedModel?.id,
      baseBranch: selectedRepo.defaultBranch || 'main',
    })
  }, [
    chat.activeSessionId,
    chat.isStreaming,
    handleCreate,
    handleSend,
    isCreating,
    mode,
    prompt,
    selectedRepo,
    selectedModel,
    setPrompt,
  ])
}
