'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import type { ChatSession } from '@/lib/api/server'
import { sendChatMessage } from '@/lib/api/server'
import { parseSSEEvent, getEventStatus, extractTextDelta } from '@/lib/sse-parser'
import { isAgentHarnessEvent } from '@/lib/sse-types'
import type { GitHubRepo, ModelInfo, AgentInfo, AgentMode, AgentModeId, User } from '@/lib/api/types'
import type { useDashboardChat } from './use-dashboard-chat'
import type { CreateSessionParams } from '@/lib/api/types'
import { sessionStatusStore } from './use-session-status-store'
import { eventsStore } from './use-events-store'
import { postSessionSync } from '@/lib/session-sync-channel'

const DEFAULT_MODES: AgentMode[] = [
  { id: 'build', label: 'build' },
  { id: 'plan', label: 'plan' },
]

const MODE_STORAGE_KEY = 'ship-chat-mode'

function getStoredMode(): AgentModeId {
  try {
    const s = localStorage.getItem(MODE_STORAGE_KEY)
    if (s === 'build' || s === 'plan') return s
  } catch {
    // ignore
  }
  return 'build'
}

function setStoredMode(mode: AgentModeId): void {
  try {
    localStorage.setItem(MODE_STORAGE_KEY, mode)
  } catch {
    // ignore
  }
}

export interface UseDashboardStateParams {
  chat: ReturnType<typeof useDashboardChat>
  handleSend: (content: string, modeOverride?: string, sessionIdOverride?: string) => void
  processStreamEventForSession?: (sessionId: string, event: { type: string; [k: string]: unknown }) => void
  session: {
    createSession: (arg: CreateSessionParams) => Promise<ChatSession | undefined>
    deleteSession: (arg: { sessionId: string }) => Promise<unknown>
    userId: string
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

export function useDashboardState({ chat, handleSend, processStreamEventForSession, session, data }: UseDashboardStateParams) {
  const { createSession, deleteSession, userId, user, mutateSessions, onSessionCreated, onSessionDeleted } = session
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
  const [selectedAgent, setSelectedAgent] = useState<AgentInfo | null>(null)
  const [selectedModel, setSelectedModel] = useState<ModelInfo | null>(null)
  const [mode, setModeState] = useState<AgentModeId>(getStoredMode)
  const setMode = useCallback((next: AgentModeId) => {
    setModeState(next)
    setStoredMode(next)
  }, [])
  const [availableModes, setAvailableModes] = useState<AgentMode[]>(DEFAULT_MODES)
  const [prompt, setPrompt] = useState<string>('')

  // Agent initialization (runs once when agents load)
  useEffect(() => {
    if (agentsLoading || defaultAgentLoading || agents.length === 0 || selectedAgent) return
    const agentId = defaultAgentId || 'opencode'
    const agent = agents.find((a) => a.id === agentId) || agents[0]
    if (agent) {
      setSelectedAgent(agent)
      setAvailableModes(agent.modes)
      const savedMode = getStoredMode()
      const validMode = agent.modes.some((m) => m.id === savedMode) ? savedMode : agent.modes[0]?.id || 'build'
      setMode(validMode)
      if (agent.models.length > 0) {
        setSelectedModel(agent.models[0])
      }
    }
  }, [agents, agentsLoading, defaultAgentId, defaultAgentLoading, selectedAgent, setMode])

  const handleAgentSelect = useCallback((agent: AgentInfo) => {
    setSelectedAgent(agent)
    setAvailableModes(agent.modes)
    const savedMode = getStoredMode()
    const validMode = agent.modes.some((m) => m.id === savedMode) ? savedMode : agent.modes[0]?.id || 'build'
    setMode(validMode)
    if (agent.models.length > 0) {
      setSelectedModel(agent.models[0])
    }
  }, [setMode])

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
              const eventType = rawData?.type ?? currentEventType ?? 'unknown'
              if (isAgentHarnessEvent(eventType, rawData)) {
                eventsStore.addEvent(sessionId, {
                  id: crypto.randomUUID(),
                  type: eventType,
                  timestamp: Date.now(),
                  payload: rawData,
                })
              }
              const event = parseSSEEvent(rawData)
              if (!event) continue

              const type = (event as { type: string }).type

              // When user navigated to this session, forward events to message handlers so response appears
              if (chat.activeSessionIdRef?.current === sessionId && processStreamEventForSession) {
                // Seed assistant text from store if we joined mid-stream (user navigated after stream started)
                const stored = sessionStatusStore.get(sessionId)
                if (stored?.contentPreview && !chat.assistantTextRef?.current) {
                  chat.assistantTextRef.current = stored.contentPreview
                }
                processStreamEventForSession(sessionId, event as { type: string; [k: string]: unknown })
              }

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
                // Don't add heartbeat "Waiting (Xs)" as steps — they accumulate and replace real progress
                if (type === 'heartbeat') {
                  // status updated above; skip addStep
                } else if (type !== 'status' && type !== 'session.status') {
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
                  sessionStatusStore.update(sessionId, { title: info.title })
                  chat.setLocalSessions((prev) =>
                    prev.map((s) => (s.id === sessionId ? { ...s, title: info.title } : s)),
                  )
                  postSessionSync({ type: 'sessions-invalidate' })
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
    [chat, processStreamEventForSession],
  )

  const handleCreate = useCallback(
    async (data: { repoOwner: string; repoName: string; model?: string; baseBranch?: string }) => {
      try {
        const trimmedPrompt = prompt.trim()
        const initialTitle =
          trimmedPrompt.length > 60 ? `${trimmedPrompt.slice(0, 57)}...` : trimmedPrompt
        const newSession = await createSession({
          userId,
          repoOwner: data.repoOwner,
          repoName: data.repoName,
          model: data.model || selectedModel?.id || 'opencode/big-pickle',
          agentType: selectedAgent?.id || 'opencode',
          baseBranch: data.baseBranch || 'main',
          title: initialTitle || undefined,
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
            title: (initialTitle || newSession.title) ?? undefined,
            model: newSession.model ?? data.model ?? selectedModel?.id,
            agentType: newSession.agentType ?? selectedAgent?.id,
          }
          chat.setLocalSessions((prev) => [newSessionData, ...prev])
          mutateSessions?.()
          onSessionCreated?.(newSession.id)

          // Fire-and-forget: send the prompt to the server without navigating.
          // The agent runs server-side; the session list polls for live status.
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
    [createSession, userId, selectedModel, selectedAgent, prompt, mode, chat, mutateSessions, onSessionCreated],
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
        baseBranch: selectedRepo.defaultBranch || 'main',
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

  const handleSessionClick = useCallback(
    (session: ChatSession) => {
      chat.setActiveSessionId(session.id)
      chat.connectWebSocket(session.id)
      router.push(`/session/${session.id}`)
    },
    [chat, router],
  )

  const handleDeleteSession = useCallback(
    async (sessionId: string) => {
      const session = chat.localSessions.find((s) => s.id === sessionId)
      chat.setLocalSessions((prev) => prev.filter((s) => s.id !== sessionId))
      mutateSessions?.()
      onSessionDeleted?.()
      try {
        await deleteSession({ sessionId })
        if (chat.activeSessionId === sessionId) {
          chat.setActiveSessionId(null)
          chat.setMessages([])
          router.push('/')
          window.location.href = '/'
        }
      } catch (error) {
        console.error('Failed to delete session:', error)
        if (session) {
          chat.setLocalSessions((prev) =>
            [...prev, session].sort((a, b) => (b.lastActivity ?? 0) - (a.lastActivity ?? 0)),
          )
        }
      }
    },
    [chat, deleteSession, mutateSessions, onSessionDeleted, router],
  )

  // Default repo fallback when no saved default
  useEffect(() => {
    if (chat.activeSessionId || defaultRepoLoading || selectedRepo) return
    if (repos.length === 0) return
    if (defaultRepoFullName) return

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
    handleCreate,
    handleSubmit,
    handleKeyDown,
    handleSessionClick,
    handleDeleteSession,
  }
}
