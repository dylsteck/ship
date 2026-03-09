'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import type { ChatSession } from '@/lib/api/server'
import { sendChatMessage } from '@/lib/api/server'
import { parseSSEEvent, getEventStatus, extractTextDelta } from '@/lib/sse-parser'
import type { GitHubRepo, ModelInfo, AgentInfo, AgentMode, AgentModeId, User } from '@/lib/api/types'
import type { useDashboardChat } from './use-dashboard-chat'
import type { CreateSessionParams } from '@/lib/api/types'
import { sessionStatusStore } from './use-session-status-store'

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

export function useDashboardState({ chat, handleSend, session, data }: UseDashboardStateParams) {
  const { createSession, deleteSession, userId, user, mutateSessions } = session
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

  /** Read SSE stream in background to populate live status for a homepage session card */
  const streamSessionInBackground = useCallback(
    async (sessionId: string, content: string, sessionMode: string) => {
      sessionStatusStore.update(sessionId, { isRunning: true, status: 'Starting...', steps: [], contentPreview: '' })
      let accumulatedText = ''
      try {
        const response = await sendChatMessage(sessionId, content, sessionMode)
        if (!response.ok || !response.body) {
          sessionStatusStore.update(sessionId, { isRunning: false, status: 'Error' })
          return
        }
        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''

          let currentEventType = ''
          for (const line of lines) {
            if (line.startsWith('event: ')) {
              currentEventType = line.slice(7).trim()
              continue
            }
            if (!line.startsWith('data: ')) continue
            try {
              const rawData = JSON.parse(line.slice(6))
              if (!rawData.type && currentEventType) rawData.type = currentEventType
              const event = parseSSEEvent(rawData)
              if (!event) continue

              const type = (event as { type: string }).type

              // Capture assistant text content for preview
              const textDelta = extractTextDelta(event)
              if (textDelta) {
                accumulatedText += textDelta
                sessionStatusStore.update(sessionId, { contentPreview: accumulatedText })
              }

              // Use getEventStatus to extract human-readable labels from all event types
              const eventStatus = getEventStatus(event as any)
              if (eventStatus) {
                sessionStatusStore.update(sessionId, { status: eventStatus.label })
                // Only add step if it's not a status event (those are handled separately below)
                if (type !== 'status' && type !== 'session.status') {
                  sessionStatusStore.addStep(sessionId, eventStatus.label)
                }
              }

              if (type === 'status' || type === 'session.status') {
                const msg =
                  (event as { message?: string; status?: string }).message ??
                  (event as { message?: string; status?: string }).status
                if (typeof msg === 'string') {
                  sessionStatusStore.update(sessionId, { status: msg })
                  sessionStatusStore.addStep(sessionId, msg)
                }
              } else if (type === 'session.updated') {
                const info = (event as any).properties?.info
                if (info?.title) {
                  chat.setLocalSessions((prev) =>
                    prev.map((s) => (s.id === sessionId ? { ...s, title: info.title } : s)),
                  )
                }
              } else if (type === 'done' || type === 'session.idle') {
                sessionStatusStore.update(sessionId, { isRunning: false, status: 'Done' })
              } else if (type === 'session.error' || type === 'error') {
                sessionStatusStore.update(sessionId, { isRunning: false, status: 'Error' })
              }
            } catch {
              // Ignore parse errors
            }
          }
        }
        // Stream ended
        const current = sessionStatusStore.get(sessionId)
        if (current?.isRunning) {
          sessionStatusStore.update(sessionId, { isRunning: false, status: 'Done' })
        }
      } catch (err) {
        console.error('Background SSE error:', err)
        sessionStatusStore.update(sessionId, { isRunning: false, status: 'Error' })
      }
    },
    [chat],
  )

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
            model: newSession.model ?? data.model ?? selectedModel?.id,
            agentType: newSession.agentType ?? selectedAgent?.id,
          }
          chat.setLocalSessions((prev) => [newSessionData, ...prev])
          mutateSessions?.()

          // Fire-and-forget: send the prompt to the server without navigating.
          // The agent runs server-side; the session list polls for live status.
          const trimmedPrompt = prompt.trim()
          if (trimmedPrompt) {
            setPrompt('')
            // Stream SSE in background to track live status without navigating
            streamSessionInBackground(newSession.id, trimmedPrompt, mode)
          }
        }
      } catch (error) {
        console.error('Failed to create session:', error)
      }
    },
    [createSession, userId, selectedModel, selectedAgent, selectedBranch, prompt, mode, chat, mutateSessions],
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
