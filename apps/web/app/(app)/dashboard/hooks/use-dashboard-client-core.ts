'use client'

import { useCallback, useMemo, useRef } from 'react'
import { REALTIME_V2_ENABLED } from '@/lib/config'
import { postSessionSync } from '@/lib/session-sync-channel'
import type { ChatSession } from '@/lib/api/server'
import type { User } from '@/lib/api/types'
import type { UIMessage } from '@/lib/ai-elements-adapter'
import { useDashboardChat } from './use-dashboard-chat'
import { useDashboardSSE } from './use-dashboard-sse'
import { useDashboardState } from './use-dashboard-state'
import {
  useDashboardSessionEffects,
  useDashboardCrossTabSync,
  useStreamingSessionIds,
} from './use-dashboard-client-effects'
import { useDashboardDataHooks } from './dashboard-client-helpers'
import { useProvisionSandboxWhenNeeded } from './use-provision-sandbox-when-needed'
import { useDashboardRealtime } from './use-dashboard-realtime'

export function useDashboardClientCore(
  initialSessions: ChatSession[],
  initialSessionId: string | null,
  initialMessages: UIMessage[] | undefined,
  initialApiMessages: DashboardClientCoreParams['initialApiMessages'],
  user: User,
  refs: {
    modeRef: React.MutableRefObject<string>
    modelIdRef: React.MutableRefObject<string | null>
    onAgentEventRef: React.MutableRefObject<((sessionId: string, event: { type: string; [k: string]: unknown }) => void) | null>
    resumeStreamRef: React.MutableRefObject<((sessionId: string) => void) | null>
    onResumeStream: (id: string) => void
  },
) {
  const chat = useDashboardChat(initialSessions, initialSessionId, {
    onAgentEventRef: refs.onAgentEventRef,
    initialMessages,
    initialApiMessages,
    onResumeStream: refs.onResumeStream,
  })

  useProvisionSandboxWhenNeeded(chat.activeSessionId)

  const legacyRealtime = useDashboardSSE({
    chat,
    modeRef: refs.modeRef,
    modelIdRef: refs.modelIdRef,
  })
  const canonicalRealtime = useDashboardRealtime(chat, refs.modeRef, refs.modelIdRef)
  const realtime = REALTIME_V2_ENABLED ? canonicalRealtime : legacyRealtime
  const canonicalWsStatus = canonicalRealtime.controllerState.phase === 'live'
    ? 'connected'
    : canonicalRealtime.controllerState.phase === 'synchronizing'
      ? 'connecting'
      : 'disconnected'
  const chatView = useMemo(
    () => ({
      ...chat,
      handleStop: REALTIME_V2_ENABLED ? canonicalRealtime.handleStop : chat.handleStop,
      wsStatus: REALTIME_V2_ENABLED ? canonicalWsStatus : chat.wsStatus,
    }),
    [canonicalRealtime.handleStop, canonicalWsStatus, chat],
  )

  // Assign synchronously during render so the refs are always populated before
  // any effect (including useChatHistoryLoader) reads them.
  refs.resumeStreamRef.current = realtime.resumeStream
  refs.onAgentEventRef.current = realtime.processStreamEventForSession

  const dataHooks = useDashboardDataHooks(chatView)
  const { pendingCreateIdsRef } = useDashboardSessionEffects(
    chat,
    dataHooks.swrSessions,
    dataHooks.sessionsLoading,
    dataHooks.mutateSessions,
  )

  const onSessionCreated = useCallback(
    (sessionId: string) => {
      pendingCreateIdsRef.current.add(sessionId)
      if (!REALTIME_V2_ENABLED) postSessionSync({ type: 'session-created' })
    },
    [pendingCreateIdsRef],
  )

  const onSessionDeleted = useCallback(() => {
    if (!REALTIME_V2_ENABLED) postSessionSync({ type: 'session-deleted' })
  }, [])

  const streamingFromOtherTabs = useDashboardCrossTabSync(
    chatView,
    dataHooks.mutateSessions,
    refs.resumeStreamRef,
    !REALTIME_V2_ENABLED,
  )
  const legacyStreamingSessionIds = useStreamingSessionIds(
    streamingFromOtherTabs,
    chatView.activeSessionId,
    chatView.isStreaming,
  )
  const streamingSessionIds = new Set([
    ...legacyStreamingSessionIds,
    ...(REALTIME_V2_ENABLED ? dataHooks.shellStreamingSessionIds : []),
  ])

  const state = useDashboardState({
    chat: chatView,
    handleSend: realtime.handleSend,
    processStreamEventForSession: realtime.processStreamEventForSession,
    session: {
      createSession: dataHooks.createSession,
      deleteSession: dataHooks.deleteSession,
      user,
      mutateSessions: dataHooks.mutateSessions,
      onSessionCreated,
      onSessionDeleted,
    },
    data: dataHooks.stateData,
  })

  refs.modelIdRef.current = state.selectedModel?.id ?? null
  refs.modeRef.current = state.mode

  return { chat: chatView, state, dataHooks, handleSend: realtime.handleSend, streamingSessionIds }
}

export interface DashboardClientCoreParams {
  initialApiMessages?: Array<{ id: string; role: string; content: string; createdAt: number; parts?: string }>
}

export function useDashboardClientRefs() {
  const modeRef = useRef('agent')
  const modelIdRef = useRef<string | null>(null)
  const onAgentEventRef = useRef<((sessionId: string, event: { type: string; [k: string]: unknown }) => void) | null>(null)
  const resumeStreamRef = useRef<((sessionId: string) => void) | null>(null)
  const onResumeStream = useCallback((id: string) => resumeStreamRef.current?.(id), [])

  return { modeRef, modelIdRef, onAgentEventRef, resumeStreamRef, onResumeStream }
}
