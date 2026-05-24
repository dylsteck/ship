'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { createReconnectingWebSocket, type WebSocketStatus } from '@/lib/websocket'
import { getChatMessages } from '@/lib/api'
import type { AgentStatus } from '@/components/session/status-indicator'
import { type UIMessage } from '@/lib/ai-elements-adapter'
import { API_URL } from '@/lib/config'
import { mapApiMessageToUI, handleWebSocketEvent } from './chat-stream-helpers'
import { sendChatStreamMessage, useChatStreamActions } from './chat-stream-actions'

interface UseChatStreamOptions {
  sessionId: string
  initialMode?: string
  onStatusChange?: (status: AgentStatus, currentTool?: string) => void
}

export function useChatStream({ sessionId, initialMode = 'build', onStatusChange }: UseChatStreamOptions) {
  const [messages, setMessages] = useState<UIMessage[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [messageQueue, setMessageQueue] = useState<string[]>([])
  const [wsStatus, setWsStatus] = useState<WebSocketStatus>('disconnected')
  const [hasMore, setHasMore] = useState(false)

  const wsRef = useRef<ReturnType<typeof createReconnectingWebSocket> | null>(null)
  const streamingMessageRef = useRef<string | null>(null)
  const assistantTextRef = useRef('')
  const reasoningRef = useRef('')
  const isStreamingRef = useRef(false)

  useEffect(() => {
    isStreamingRef.current = isStreaming
  }, [isStreaming])

  useEffect(() => {
    async function loadMessages() {
      try {
        const msgs = await getChatMessages(sessionId, { limit: 25 })
        setMessages(msgs.map(mapApiMessageToUI))
        setHasMore(msgs.length === 25)
      } catch (err) {
        console.error('Failed to load messages:', err)
      }
    }
    loadMessages()
  }, [sessionId])

  useEffect(() => {
    const wsUrl = `${API_URL.replace('http', 'ws')}/sessions/${sessionId}/websocket`
    wsRef.current = createReconnectingWebSocket({
      url: wsUrl,
      onMessage: (data: unknown) => {
        handleWebSocketEvent(data as Parameters<typeof handleWebSocketEvent>[0], setMessages, onStatusChange)
      },
      onStatusChange: setWsStatus,
    })
    return () => wsRef.current?.disconnect()
  }, [sessionId, onStatusChange])

  const handleSend = useCallback(
    async (content: string, modeOverride?: string) => {
      await sendChatStreamMessage(
        sessionId,
        content,
        initialMode,
        { streamingMessageRef, assistantTextRef, reasoningRef, isStreamingRef },
        { setMessages, setIsStreaming, setMessageQueue, onStatusChange },
        modeOverride,
      )
    },
    [sessionId, initialMode, onStatusChange],
  )

  useEffect(() => {
    if (!isStreaming && messageQueue.length > 0) {
      const [next, ...rest] = messageQueue
      setMessageQueue(rest)
      void handleSend(next)
    }
  }, [isStreaming, messageQueue, handleSend])

  const { handleStop: stopStream, handleRetryError: retryError } = useChatStreamActions(sessionId, onStatusChange)

  const handleStop = useCallback(async () => {
    await stopStream()
    setIsStreaming(false)
    streamingMessageRef.current = null
  }, [stopStream])

  const handleRetryError = useCallback(
    (messageId: string) => retryError(messageId, setMessages),
    [retryError],
  )

  return {
    messages,
    isStreaming,
    messageQueue,
    wsStatus,
    hasMore,
    streamingMessageId: streamingMessageRef.current,
    handleSend,
    handleStop,
    handleRetryError,
  }
}
