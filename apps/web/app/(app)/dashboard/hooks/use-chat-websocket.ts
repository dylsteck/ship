'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createReconnectingWebSocket, type WebSocketStatus } from '@/lib/websocket'
import { getApiToken } from '@/lib/api/client'
import { API_URL } from '@/lib/config'
import { handleChatWebSocketMessage } from './chat-websocket-handler'
import type { UIMessage } from '@/lib/ai-elements-adapter'

export interface UseChatWebSocketParams {
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

export function useChatWebSocket(params: UseChatWebSocketParams) {
  const {
    activeSessionId,
    setMessages,
    streamingMessageRef,
    setAgentUrl,
    setAgentSessionId,
    setSandboxStatus,
    onAgentEventRef,
  } = params

  const wsRef = useRef<ReturnType<typeof createReconnectingWebSocket> | null>(null)
  const [wsStatus, setWsStatus] = useState<WebSocketStatus>('disconnected')

  const connectWebSocket = useCallback(
    (sessionId: string) => {
      wsRef.current?.disconnect()
      const token = getApiToken()
      const wsUrl = `${API_URL.replace('http', 'ws')}/sessions/${sessionId}/websocket${token ? `?token=${encodeURIComponent(token)}` : ''}`

      wsRef.current = createReconnectingWebSocket({
        url: wsUrl,
        onMessage: (data) =>
          handleChatWebSocketMessage(sessionId, data, {
            setMessages,
            streamingMessageRef,
            setAgentUrl,
            setAgentSessionId,
            setSandboxStatus,
            onAgentEventRef,
          }),
        onStatusChange: setWsStatus,
      })
    },
    [setAgentSessionId, setAgentUrl, setMessages, setSandboxStatus, streamingMessageRef, onAgentEventRef],
  )

  useEffect(() => () => wsRef.current?.disconnect(), [])
  useEffect(() => {
    if (!activeSessionId) {
      wsRef.current?.disconnect()
      return
    }
    connectWebSocket(activeSessionId)
  }, [activeSessionId, connectWebSocket])

  return { wsStatus, connectWebSocket }
}
