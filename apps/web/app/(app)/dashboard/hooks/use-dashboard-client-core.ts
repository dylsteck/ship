'use client'

import { useEffect, useRef } from 'react'
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

  const { handleSend, processStreamEventForSession, resumeStream } = useDashboardSSE({
    chat,
    modeRef: refs.modeRef,
    modelIdRef: refs.modelIdRef,
  })

  useEffect(() => {
    refs.resumeStreamRef.current = resumeStream
    return () => {
      refs.resumeStreamRef.current = null
    }
  }, [resumeStream, refs.resumeStreamRef])

  useEffect(() => {
    refs.onAgentEventRef.current = processStreamEventForSession
    return () => {
      refs.onAgentEventRef.current = null
    }
  }, [processStreamEventForSession, refs.onAgentEventRef])

  const dataHooks = useDashboardDataHooks(chat)
  const { pendingCreateIdsRef } = useDashboardSessionEffects(
    chat,
    dataHooks.swrSessions,
    dataHooks.sessionsLoading,
    dataHooks.mutateSessions,
  )

  const streamingFromOtherTabs = useDashboardCrossTabSync(chat, dataHooks.mutateSessions, refs.resumeStreamRef)
  const streamingSessionIds = useStreamingSessionIds(streamingFromOtherTabs, chat.activeSessionId, chat.isStreaming)

  const state = useDashboardState({
    chat,
    handleSend,
    processStreamEventForSession,
    session: {
      createSession: dataHooks.createSession,
      deleteSession: dataHooks.deleteSession,
      user,
      mutateSessions: dataHooks.mutateSessions,
      onSessionCreated: (sessionId) => {
        pendingCreateIdsRef.current.add(sessionId)
        postSessionSync({ type: 'session-created' })
      },
      onSessionDeleted: () => postSessionSync({ type: 'session-deleted' }),
    },
    data: dataHooks.stateData,
  })

  refs.modelIdRef.current = state.selectedModel?.id ?? null
  refs.modeRef.current = state.mode

  return { chat, state, dataHooks, handleSend, streamingSessionIds }
}

export interface DashboardClientCoreParams {
  initialApiMessages?: Array<{ id: string; role: string; content: string; createdAt: number; parts?: string }>
}

export function useDashboardClientRefs() {
  const modeRef = useRef('agent')
  const modelIdRef = useRef<string | null>(null)
  const onAgentEventRef = useRef<((sessionId: string, event: { type: string; [k: string]: unknown }) => void) | null>(null)
  const resumeStreamRef = useRef<((sessionId: string) => void) | null>(null)
  const onResumeStream = (id: string) => resumeStreamRef.current?.(id)

  return { modeRef, modelIdRef, onAgentEventRef, resumeStreamRef, onResumeStream }
}
