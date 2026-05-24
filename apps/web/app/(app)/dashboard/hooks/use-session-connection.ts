'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { SessionSummary } from '@ship/contracts'

import type { UIMessage } from '@/lib/ai-elements-adapter'
import { createSessionConnection, consumeSSEBody, type SessionConnection } from '@/lib/session-connection'
import { sessionStatusStore } from './use-session-status-store'
import type { WebSocketStatus } from '@/lib/websocket'

export interface UseSessionConnectionParams {
  activeSessionId: string | null
  setMessages: React.Dispatch<React.SetStateAction<UIMessage[]>>
  streamingMessageRef: React.MutableRefObject<string | null>
  setAgentUrl: (url: string) => void
  setAgentSessionId: (id: string) => void
  setSandboxStatus: (status: string) => void
  onAgentEventRef?: React.MutableRefObject<
    ((sessionId: string, event: { type: string; [k: string]: unknown }) => void) | null
  >
}

function applySessionSummary(sessionId: string, summary: SessionSummary): void {
  sessionStatusStore.update(sessionId, {
    title: summary.title,
    isRunning: Boolean(summary.streaming),
    status: summary.activeTool ? `Running ${summary.activeTool}` : summary.streaming ? 'Streaming' : '',
  })
}

export function useSessionConnection(params: UseSessionConnectionParams) {
  const {
    activeSessionId,
    setMessages,
    streamingMessageRef,
    setAgentUrl,
    setAgentSessionId,
    setSandboxStatus,
    onAgentEventRef,
  } = params

  const connectionRef = useRef<SessionConnection | null>(null)
  const [wsStatus, setWsStatus] = useState<WebSocketStatus>('disconnected')

  const connectWebSocket = useCallback(
    (sessionId: string) => {
      connectionRef.current?.disconnect()
      connectionRef.current = createSessionConnection({
        sessionId,
        setMessages,
        streamingMessageRef,
        setAgentUrl,
        setAgentSessionId,
        setSandboxStatus,
        onStatusChange: setWsStatus,
        onSummary: (summary) => applySessionSummary(sessionId, summary),
        onAgentEvent: (id, event) => onAgentEventRef?.current?.(id, event),
      })
    },
    [setAgentSessionId, setAgentUrl, setMessages, setSandboxStatus, streamingMessageRef, onAgentEventRef],
  )

  useEffect(() => () => connectionRef.current?.disconnect(), [])

  useEffect(() => {
    if (!activeSessionId) {
      connectionRef.current?.disconnect()
      connectionRef.current = null
      return
    }
    connectWebSocket(activeSessionId)
  }, [activeSessionId, connectWebSocket])

  const consumeSSE = useCallback(
    (sessionId: string, body: ReadableStream<Uint8Array>, onEvent: (data: Record<string, unknown>) => void) => {
      if (connectionRef.current && activeSessionId === sessionId) {
        return connectionRef.current.consumeSSE(body, onEvent)
      }
      return consumeSSEBody(body, onEvent)
    },
    [activeSessionId],
  )

  return { wsStatus, connectWebSocket, connectionRef, consumeSSE }
}
