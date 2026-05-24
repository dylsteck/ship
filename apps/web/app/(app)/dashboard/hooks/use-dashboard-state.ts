'use client'

import { useState, useCallback, useEffect } from 'react'
import type { GitHubRepo, ModelInfo, AgentInfo, AgentMode, AgentModeId } from '@/lib/api/types'
import type { useDashboardChat } from './use-dashboard-chat'
import type { CreateSessionParams } from '@/lib/api/types'
import type { ChatSession } from '@/lib/api/server'
import type { User } from '@/lib/api/types'
import {
  DEFAULT_MODES,
  getStoredMode,
  setStoredMode,
} from './dashboard-mode-storage'
import { useBackgroundSessionStream } from './use-background-session-stream'
import { useDashboardSessionActions } from './use-dashboard-session-actions'

export interface UseDashboardStateParams {
  chat: ReturnType<typeof useDashboardChat>
  handleSend: (content: string, modeOverride?: string, sessionIdOverride?: string) => void
  processStreamEventForSession?: (sessionId: string, event: { type: string; [k: string]: unknown }) => void
  session: {
    createSession: (arg: CreateSessionParams) => Promise<ChatSession | undefined>
    deleteSession: (arg: { sessionId: string }) => Promise<unknown>
    user: User
    mutateSessions?: () => void
    onSessionCreated?: (sessionId: string) => void
    onSessionDeleted?: () => void
  }
  data: {
    repos: GitHubRepo[]
    isCreating: boolean
    agents: AgentInfo[]
    agentsLoading: boolean
    defaultAgentId: string | null
    defaultAgentLoading: boolean
    defaultRepoFullName: string | null
    defaultRepoLoading: boolean
    models: ModelInfo[]
  }
}

export function useDashboardState({
  chat,
  handleSend,
  processStreamEventForSession,
  session,
  data,
}: UseDashboardStateParams) {
  const { createSession, deleteSession, user, mutateSessions, onSessionCreated, onSessionDeleted } = session
  const {
    repos,
    isCreating,
    agents,
    agentsLoading,
    defaultAgentId,
    defaultAgentLoading,
    defaultRepoFullName,
    defaultRepoLoading,
  } = data

  const [searchQuery, setSearchQuery] = useState<string>('')
  const [selectedRepo, setSelectedRepo] = useState<GitHubRepo | null>(null)
  const [selectedAgent, setSelectedAgent] = useState<AgentInfo | null>(null)
  const [selectedModel, setSelectedModel] = useState<ModelInfo | null>(null)
  const [mode, setModeState] = useState<AgentModeId>(getStoredMode)
  const setMode = useCallback((next: AgentModeId) => {
    setModeState(next)
    setStoredMode(next)
  }, [])
  const [availableModes, setAvailableModes] = useState<AgentMode[]>(DEFAULT_MODES)
  const [prompt, setPrompt] = useState<string>('')

  useEffect(() => {
    if (agentsLoading || defaultAgentLoading || agents.length === 0 || selectedAgent) return
    const agentId = defaultAgentId || 'opencode'
    const agent = agents.find((a) => a.id === agentId) || agents[0]
    if (!agent) return
    setSelectedAgent(agent)
    setAvailableModes(agent.modes)
    const savedMode = getStoredMode()
    const validMode = agent.modes.some((m) => m.id === savedMode) ? savedMode : agent.modes[0]?.id || 'build'
    setMode(validMode)
  }, [agents, agentsLoading, defaultAgentId, defaultAgentLoading, selectedAgent, setMode])

  const handleAgentSelect = useCallback(
    (agent: AgentInfo) => {
      setSelectedAgent(agent)
      setAvailableModes(agent.modes)
      const savedMode = getStoredMode()
      const validMode = agent.modes.some((m) => m.id === savedMode) ? savedMode : agent.modes[0]?.id || 'build'
      setMode(validMode)
      setSelectedModel(null)
    },
    [setMode],
  )

  const streamSessionInBackground = useBackgroundSessionStream(
    chat,
    processStreamEventForSession,
    selectedModel?.id,
  )

  const actions = useDashboardSessionActions({
    chat,
    prompt,
    setPrompt,
    selectedRepo,
    selectedModel,
    selectedAgent,
    mode,
    isCreating,
    handleSend,
    streamSessionInBackground,
    createSession,
    deleteSession,
    userId: user.id,
    mutateSessions,
    onSessionCreated,
    onSessionDeleted,
  })

  useEffect(() => {
    if (chat.activeSessionId || defaultRepoLoading || selectedRepo) return
    if (repos.length === 0 || defaultRepoFullName) return
    const userOwnedRepo = repos.find((r) => r.owner === user.username)
    if (userOwnedRepo) setSelectedRepo(userOwnedRepo)
  }, [chat.activeSessionId, defaultRepoLoading, defaultRepoFullName, repos, selectedRepo, user.username])

  return {
    searchQuery,
    setSearchQuery,
    selectedRepo,
    setSelectedRepo,
    selectedAgent,
    selectedModel,
    setSelectedModel,
    mode,
    setMode,
    availableModes,
    prompt,
    setPrompt,
    handleAgentSelect,
    ...actions,
  }
}
