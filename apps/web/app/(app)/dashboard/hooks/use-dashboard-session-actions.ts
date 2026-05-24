'use client'

import { useCallback } from 'react'
import type { CreateSessionParams, GitHubRepo, ModelInfo, AgentInfo, AgentModeId } from '@/lib/api/types'
import type { ChatSession } from '@/lib/api/server'
import type { useDashboardChat } from './use-dashboard-chat'
import { useDashboardCreateSession, useDashboardSubmit } from './use-dashboard-create-session'
import { useDashboardDeleteSession, useDashboardSessionNavigation } from './use-dashboard-delete-session'

export interface UseDashboardSessionActionsParams {
  chat: ReturnType<typeof useDashboardChat>
  prompt: string
  setPrompt: (value: string) => void
  selectedRepo: GitHubRepo | null
  selectedModel: ModelInfo | null
  selectedAgent: AgentInfo | null
  mode: AgentModeId
  isCreating: boolean
  handleSend: (content: string, modeOverride?: string, sessionIdOverride?: string) => void
  streamSessionInBackground: (sessionId: string, content: string, sessionMode: string, modelId?: string) => Promise<void>
  createSession: (arg: CreateSessionParams) => Promise<ChatSession | undefined>
  deleteSession: (arg: { sessionId: string }) => Promise<unknown>
  userId: string
  mutateSessions?: () => void
  onSessionCreated?: (sessionId: string) => void
  onSessionDeleted?: () => void
}

export function useDashboardSessionActions(params: UseDashboardSessionActionsParams) {
  const handleCreate = useDashboardCreateSession(params)
  const handleSubmit = useDashboardSubmit({ ...params, handleCreate })
  const handleDeleteSession = useDashboardDeleteSession(
    params.chat,
    params.deleteSession,
    params.mutateSessions,
    params.onSessionDeleted,
  )
  const handleSessionClick = useDashboardSessionNavigation(params.chat)

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSubmit()
      }
    },
    [handleSubmit],
  )

  return { handleCreate, handleSubmit, handleKeyDown, handleSessionClick, handleDeleteSession }
}
