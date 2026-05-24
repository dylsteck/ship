'use client'

import { useCallback } from 'react'
import { sendChatMessage, retryChatSession, stopChatStream } from '@/lib/api'
import type { AgentStatus } from '@/components/session/status-indicator'
import {
  type UIMessage,
  createUserMessage,
  createAssistantPlaceholder,
  createErrorMessage,
  classifyError,
} from '@/lib/ai-elements-adapter'
import { readSSEStream } from './chat-stream-helpers'

export async function sendChatStreamMessage(
  sessionId: string,
  content: string,
  mode: string,
  refs: {
    streamingMessageRef: React.MutableRefObject<string | null>
    assistantTextRef: React.MutableRefObject<string>
    reasoningRef: React.MutableRefObject<string>
    isStreamingRef: React.MutableRefObject<boolean>
  },
  setters: {
    setMessages: React.Dispatch<React.SetStateAction<UIMessage[]>>
    setIsStreaming: React.Dispatch<React.SetStateAction<boolean>>
    setMessageQueue: React.Dispatch<React.SetStateAction<string[]>>
    onStatusChange?: (status: AgentStatus, currentTool?: string) => void
  },
  modeOverride?: string,
): Promise<void> {
  if (refs.isStreamingRef.current) {
    setters.setMessageQueue((q) => [...q, content])
    return
  }

  setters.setIsStreaming(true)
  setters.onStatusChange?.('planning')
  refs.assistantTextRef.current = ''
  refs.reasoningRef.current = ''

  const userMessage = createUserMessage(content)
  const assistantMessage = createAssistantPlaceholder()
  refs.streamingMessageRef.current = assistantMessage.id
  setters.setMessages((prev) => [...prev, userMessage, assistantMessage])

  try {
    const response = await sendChatMessage({
      sessionId,
      content,
      mode: modeOverride ?? mode,
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
      const errorContent = errorData.error || 'Failed to start agent'
      const { category, retryable } = classifyError(errorContent)
      setters.setMessages((prev) => {
        const filtered = prev.filter((m) => m.id !== refs.streamingMessageRef.current)
        return [...filtered, createErrorMessage(errorContent, category, retryable)]
      })
      setters.setIsStreaming(false)
      refs.streamingMessageRef.current = null
      setters.onStatusChange?.('error')
      return
    }

    if (!response.body) throw new Error('No response body')

    await readSSEStream(
      response.body,
      refs,
      { setMessages: setters.setMessages, setIsStreaming: setters.setIsStreaming, onStatusChange: setters.onStatusChange },
    )
  } catch (err) {
    console.error('Chat error:', err)
    setters.setIsStreaming(false)
    refs.streamingMessageRef.current = null
    setters.onStatusChange?.('error')
  }
}

export function useChatStreamActions(sessionId: string, onStatusChange?: (status: AgentStatus, currentTool?: string) => void) {
  const handleStop = useCallback(async () => {
    try {
      await stopChatStream(sessionId)
    } catch {
      // Ignore stop errors
    }
    onStatusChange?.('idle')
  }, [sessionId, onStatusChange])

  const handleRetryError = useCallback(
    async (messageId: string, setMessages: React.Dispatch<React.SetStateAction<UIMessage[]>>) => {
      setMessages((prev) => prev.filter((m) => m.id !== messageId))
      try {
        await retryChatSession(sessionId)
      } catch (err) {
        console.error('Retry failed:', err)
      }
    },
    [sessionId],
  )

  return { handleStop, handleRetryError }
}
