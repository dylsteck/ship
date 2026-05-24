'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { postSessionSync, subscribeSessionSync } from '@/lib/session-sync-channel'
import { sessionStatusStore, useSessionStatusVersion } from './use-session-status-store'
import type { ChatSession } from '@/lib/api/server'
import type { AgentInfo, ModelInfo } from '@/lib/api/types'
import type { useDashboardChat } from './use-dashboard-chat'

export function useDashboardSessionEffects(
  chat: ReturnType<typeof useDashboardChat>,
  swrSessions: ChatSession[],
  sessionsLoading: boolean,
  mutateSessions: () => void,
) {
  const router = useRouter()
  const { activeSessionId, setActiveSessionId, setMessages, setLocalSessions } = chat

  useEffect(() => {
    if (sessionsLoading || !activeSessionId) return
    const stillExists = swrSessions.some((s) => s.id === activeSessionId)
    if (!stillExists) {
      setActiveSessionId(null)
      setMessages([])
      router.push('/')
    }
  }, [swrSessions, activeSessionId, sessionsLoading, router, setActiveSessionId, setMessages])

  const pendingCreateIdsRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (sessionsLoading) return
    const swrIds = new Set(swrSessions.map((s) => s.id))
    for (const id of swrIds) pendingCreateIdsRef.current.delete(id)
    setLocalSessions((prev) => {
      const optimisticOnly = prev.filter((s) => !swrIds.has(s.id) && pendingCreateIdsRef.current.has(s.id))
      const merged = swrSessions.map((s) => {
        const p = prev.find((x) => x.id === s.id)
        return p && p.title && !s.title ? { ...s, title: p.title } : s
      })
      return [...optimisticOnly, ...merged]
    })
  }, [swrSessions, sessionsLoading, setLocalSessions])

  return { pendingCreateIdsRef }
}

export function useDashboardCrossTabSync(
  chat: ReturnType<typeof useDashboardChat>,
  mutateSessions: () => void,
  resumeStreamRef: React.MutableRefObject<((sessionId: string) => void) | null>,
) {
  const [streamingFromOtherTabs, setStreamingFromOtherTabs] = useState<Set<string>>(new Set())
  const { activeSessionId, isStreaming } = chat

  useEffect(() => {
    return subscribeSessionSync((msg) => {
      if (msg.type === 'session-created' || msg.type === 'session-deleted' || msg.type === 'sessions-invalidate') {
        mutateSessions()
      } else if (msg.type === 'session-streaming') {
        setStreamingFromOtherTabs((prev) => new Set(prev).add(msg.sessionId))
        if (msg.sessionId === activeSessionId && !isStreaming) {
          resumeStreamRef.current?.(msg.sessionId)
        }
      } else if (msg.type === 'session-stopped') {
        setStreamingFromOtherTabs((prev) => {
          const next = new Set(prev)
          next.delete(msg.sessionId)
          return next
        })
      }
    })
  }, [mutateSessions, activeSessionId, isStreaming, resumeStreamRef])

  return streamingFromOtherTabs
}

export function useStreamingSessionIds(
  streamingFromOtherTabs: Set<string>,
  activeSessionId: string | null,
  isStreaming: boolean,
) {
  const statusVersion = useSessionStatusVersion()

  return useMemo(() => {
    const ids = new Set(streamingFromOtherTabs)
    if (activeSessionId && isStreaming) ids.add(activeSessionId)
    if (statusVersion >= 0) {
      for (const [sessionId, status] of sessionStatusStore.getAll()) {
        if (status.isRunning) ids.add(sessionId)
      }
    }
    return ids
  }, [streamingFromOtherTabs, activeSessionId, isStreaming, statusVersion])
}

export function useActiveSessionSync(
  chat: ReturnType<typeof useDashboardChat>,
  {
    selectedAgent,
    selectedModel,
    handleAgentSelect,
    setSelectedModel,
  }: {
    selectedAgent: AgentInfo | null
    selectedModel: ModelInfo | null
    handleAgentSelect: (agent: AgentInfo) => void
    setSelectedModel: (model: ModelInfo | null) => void
  },
  agents: AgentInfo[],
  models: ModelInfo[],
  sessionModelId?: string | null,
) {
  const activeSession = chat.activeSessionId
    ? (chat.localSessions.find((session) => session.id === chat.activeSessionId) ?? null)
    : null

  const activeModelId = activeSession?.model || sessionModelId
  const activeAgentType = activeSession?.agentType === 'ship' ? undefined : activeSession?.agentType
  const activeSessionInfoAgentType =
    chat.sessionInfo?.agentType === 'ship' ? undefined : chat.sessionInfo?.agentType

  const activeSessionAgent = chat.activeSessionId
    ? (agents.find((agent) => !!activeModelId && agent.models.some((model) => model.id === activeModelId)) ??
      agents.find((agent) => agent.id === activeAgentType || agent.id === activeSessionInfoAgentType) ??
      null)
    : selectedAgent

  const activeSessionModel = chat.activeSessionId
    ? (models.find((model) => model.id === activeModelId) ?? null)
    : selectedModel

  useEffect(() => {
    if (!chat.activeSessionId || !activeSessionAgent) return
    if (selectedAgent?.id !== activeSessionAgent.id) {
      handleAgentSelect(activeSessionAgent)
      return
    }
    if (activeSessionModel && selectedModel?.id !== activeSessionModel.id) {
      setSelectedModel(activeSessionModel)
    }
  }, [
    chat.activeSessionId,
    activeSessionAgent,
    activeSessionModel,
    selectedAgent,
    selectedModel,
    handleAgentSelect,
    setSelectedModel,
  ])

  return { activeSession, activeSessionAgent, activeSessionModel }
}

export function buildTerminalConnectionHint(messages: Array<{ type?: string; content: string; rawErrorMessage?: string }>) {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i]!
    if (m.type !== 'error') continue
    const t = `${m.content} ${m.rawErrorMessage || ''}`.toLowerCase()
    if (
      t.includes('clone') ||
      t.includes('repository') ||
      t.includes('sandbox') ||
      t.includes('git') ||
      t.includes('github')
    ) {
      return 'A setup or git error occurred. Fix it using the message above, then send another chat message — the terminal connects after the sandbox is ready.'
    }
  }
  return undefined
}
