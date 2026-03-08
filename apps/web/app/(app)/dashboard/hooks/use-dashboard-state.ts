'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import type { ChatSession } from '@/lib/api/server'
import type { GitHubRepo, ModelInfo, AgentInfo, AgentMode, AgentModeId, User } from '@/lib/api/types'
import type { useDashboardChat } from './use-dashboard-chat'
import type { CreateSessionParams } from '@/lib/api/types'

const DEFAULT_MODES: AgentMode[] = [
  { id: 'agent', label: 'agent' },
  { id: 'plan', label: 'plan' },
  { id: 'ask', label: 'ask' },
]

export interface UseDashboardStateParams {
  chat: ReturnType<typeof useDashboardChat>
  handleSend: (content: string, modeOverride?: string, sessionIdOverride?: string) => void
  session: {
    createSession: (arg: CreateSessionParams) => Promise<ChatSession | undefined>
    deleteSession: (arg: { sessionId: string }) => Promise<unknown>
    userId: string
    user: User
    mutateSessions?: () => void
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
  session,
  data,
}: UseDashboardStateParams) {
  const {
    createSession,
    deleteSession,
    userId,
    user,
    mutateSessions,
  } = session
  const {
    repos,
    isCreating,
    agents,
    agentsLoading,
    defaultAgentId,
    defaultAgentLoading,
    defaultRepoFullName,
    defaultRepoLoading,
    models,
  } = data
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [selectedRepo, setSelectedRepo] = useState<GitHubRepo | null>(null)
  const [selectedBranch, setSelectedBranch] = useState<string>('main')
  const [selectedAgent, setSelectedAgent] = useState<AgentInfo | null>(null)
  const [selectedModel, setSelectedModel] = useState<ModelInfo | null>(null)
  const [mode, setMode] = useState<AgentModeId>('agent')
  const [availableModes, setAvailableModes] = useState<AgentMode[]>(DEFAULT_MODES)
  const [prompt, setPrompt] = useState<string>('')

  // Agent initialization (runs once when agents load)
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

  const handleCreate = useCallback(
    async (data: { repoOwner: string; repoName: string; model?: string; baseBranch?: string }) => {
      try {
        const newSession = await createSession({
          userId,
          repoOwner: data.repoOwner,
          repoName: data.repoName,
          model: data.model || selectedModel?.id || 'cursor/default',
          agentType: selectedAgent?.id || 'cursor',
          baseBranch: data.baseBranch || selectedBranch || 'main',
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
          mutateSessions?.()
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
    [createSession, userId, selectedModel, selectedAgent, selectedBranch, prompt, mode, chat, handleSend, mutateSessions],
  )

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
        baseBranch: selectedBranch,
      })
    }
  }, [
    chat.activeSessionId,
    chat.isStreaming,
    prompt,
    selectedRepo,
    selectedBranch,
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

  // Default repo fallback when no saved default
  useEffect(() => {
    if (chat.activeSessionId || defaultRepoLoading || selectedRepo) return
    if (repos.length === 0) return
    if (defaultRepoFullName) return

    const userOwnedRepo = repos.find((r) => r.owner === user.username)
    if (userOwnedRepo) setSelectedRepo(userOwnedRepo)
  }, [chat.activeSessionId, defaultRepoLoading, defaultRepoFullName, repos, selectedRepo, user.username])

  // When repo changes, default branch to repo.defaultBranch or 'main'
  useEffect(() => {
    if (!selectedRepo) return
    const branch = selectedRepo.defaultBranch || 'main'
    setSelectedBranch(branch)
  }, [selectedRepo])

  return {
    searchQuery,
    setSearchQuery,
    selectedRepo,
    setSelectedRepo,
    selectedBranch,
    setSelectedBranch,
    selectedAgent,
    selectedModel,
    setSelectedModel,
    mode,
    setMode,
    availableModes,
    prompt,
    setPrompt,
    handleAgentSelect,
    handleCreate,
    handleSubmit,
    handleKeyDown,
    handleSessionClick,
    handleDeleteSession,
  }
}
