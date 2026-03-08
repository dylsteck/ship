'use client'

import { useCallback, useRef } from 'react'
import { sendChatMessage } from '@/lib/api/server'
import { parseSSEEvent } from '@/lib/sse-parser'
import {
  type UIMessage,
  createUserMessage,
  createAssistantPlaceholder,
  createErrorMessage,
  classifyError,
} from '@/lib/ai-elements-adapter'
import {
  type SSEHandlerContext,
  handleMessagePartUpdated,
  handleDoneOrIdle,
  handleSessionError,
  handleGenericError,
  handlePermissionAsked,
  handlePermissionResolved,
  handleQuestionAsked,
  handleQuestionResolved,
  handleAgentUrl,
  handleRawDataFallbacks,
} from './sse-event-handlers'
import type { useDashboardChat } from './use-dashboard-chat'

/** Compact params: chat context + mode ref. Avoids 20+ individual props. */
export interface UseDashboardSSEParams {
  chat: ReturnType<typeof useDashboardChat>
  modeRef: React.MutableRefObject<string>
}

export function useDashboardSSE({ chat, modeRef }: UseDashboardSSEParams) {
  const {
    activeSessionId,
    isStreaming,
    setIsStreaming,
    setMessages,
    setTotalCost,
    setLastStepCost,
    setSessionTodos,
    setFileDiffs,
    setMessageQueue,
    setAgentUrl,
    setSessionTitle,
    setSessionInfo,
    updateSessionTitle,
    streamingMessageRef,
    assistantTextRef,
    reasoningRef,
    setStreamStartTime,
    setStreamingStatus,
    streamingStatusStepsRef,
    messagesRef,
    clearStreamingStatusSteps,
  } = chat
  const streamStartTimeRef = useRef<number | null>(null)

  // Fix stale closure: track isStreaming via ref
  const isStreamingRef = useRef(isStreaming)
  isStreamingRef.current = isStreaming

  const scheduleFlush = useCallback(() => {
    const msgId = streamingMessageRef.current
    if (!msgId) return
    const text = assistantTextRef.current
    const reasoning = reasoningRef.current
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id !== msgId) return m
        const updates: Partial<typeof m> = {}
        if (m.content !== text) updates.content = text
        if (reasoning && (m.reasoning?.[0] !== reasoning)) updates.reasoning = [reasoning]
        if (Object.keys(updates).length === 0) return m
        return { ...m, ...updates }
      }),
    )
  }, [setMessages, streamingMessageRef, assistantTextRef, reasoningRef])

  const handleSend = useCallback(
    async (content: string, modeOverride?: string, sessionIdOverride?: string) => {
      const targetSessionId = sessionIdOverride || activeSessionId
      if (!targetSessionId) return

      if (isStreamingRef.current) {
        setMessageQueue((q) => [...q, content])
        return
      }

      setIsStreaming(true)
      clearStreamingStatusSteps()
      assistantTextRef.current = ''
      reasoningRef.current = ''
      setLastStepCost(null)
      const now = Date.now()
      streamStartTimeRef.current = now
      setStreamStartTime(now)

      const hasCompletedAssistant = messagesRef.current.some(
        (m) => m.role === 'assistant' && (m.content || m.toolInvocations?.length),
      )
      const accumulateSetupStepsRef = { current: !hasCompletedAssistant }
      setStreamingStatus('Preparing...', accumulateSetupStepsRef.current)

      const userMessage = createUserMessage(content)
      setMessages((prev) => [...prev, userMessage])

      const assistantMessage = createAssistantPlaceholder()
      streamingMessageRef.current = assistantMessage.id
      setMessages((prev) => [...prev, assistantMessage])

      const ctx: SSEHandlerContext = {
        setMessages,
        setIsStreaming,
        setTotalCost,
        setLastStepCost,
        setSessionTodos,
        setFileDiffs,
        setAgentUrl,
        setSessionTitle,
        setSessionInfo,
        setStreamStartTime,
        setStreamingStatus,
        accumulateSetupStepsRef,
        streamingStatusStepsRef,
        clearStreamingStatusSteps,
        streamingMessageRef,
        assistantTextRef,
        reasoningRef,
        targetSessionId,
      }

      try {
        const response = await sendChatMessage(targetSessionId, content, modeOverride ?? modeRef.current)

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
          const errorContent = errorData.error || errorData.details || 'Failed to start agent'
          const { category, retryable } = classifyError(errorContent)

          setMessages((prev) => {
            const filtered = prev.filter((m) => m.id !== streamingMessageRef.current)
            return [...filtered, createErrorMessage(errorContent, category, retryable)]
          })

          setIsStreaming(false)
          setStreamingStatus('')
          streamingMessageRef.current = null
          return
        }

        if (!response.body) {
          throw new Error('No response body')
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
            if (line.startsWith('data: ')) {
              try {
                const rawData = JSON.parse(line.slice(6))
                if (!rawData.type && currentEventType) {
                  rawData.type = currentEventType
                }
                const event = parseSSEEvent(rawData)
                if (!event) continue

                switch (event.type) {
                  case 'message.part.updated':
                    handleMessagePartUpdated(event as any, ctx, scheduleFlush)
                    break

                  case 'message.updated':
                    break

                  case 'message.removed':
                    setMessages((prev) => prev.filter((m) => m.id !== (event as any).properties.messageID))
                    break

                  case 'todo.updated':
                    setSessionTodos((event as any).properties.todos)
                    break

                  case 'session.diff':
                    setFileDiffs((event as any).properties.diff)
                    break

                  case 'session.updated': {
                    const info = (event as any).properties.info
                    if (info) {
                      if (info.title) {
                        setSessionTitle(info.title)
                        if (activeSessionId) updateSessionTitle(activeSessionId, info.title)
                      }
                      setSessionInfo(info)
                    }
                    break
                  }

                  case 'agent-url':
                  case 'opencode-url': {
                    const url = (event as { url?: string }).url
                    if (url) handleAgentUrl(url, ctx)
                    break
                  }

                  case 'permission.asked':
                    handlePermissionAsked((event as any).properties, ctx)
                    break

                  case 'permission.granted':
                    handlePermissionResolved((event as any).properties.id, 'granted', ctx)
                    break

                  case 'permission.denied':
                    handlePermissionResolved((event as any).properties.id, 'denied', ctx)
                    break

                  case 'question.asked':
                    handleQuestionAsked((event as any).properties, ctx)
                    break

                  case 'question.replied':
                    handleQuestionResolved((event as any).properties.id, 'replied', ctx)
                    break

                  case 'question.rejected':
                    handleQuestionResolved((event as any).properties.id, 'rejected', ctx)
                    break

                  case 'done':
                  case 'session.idle':
                    handleDoneOrIdle(ctx, streamStartTimeRef)
                    break

                  case 'session.error':
                    handleSessionError((event as any).properties.error, ctx)
                    break

                  case 'error':
                    handleGenericError((event as any).error, ctx)
                    break

                  case 'status':
                  case 'session.status': {
                    const ev = event as { message?: string; status?: string }
                    const msg = ev.message ?? ev.status
                    if (typeof msg === 'string') {
                      ctx.setStreamingStatus(msg, ctx.accumulateSetupStepsRef.current)
                    }
                    break
                  }
                  case 'heartbeat':
                  case 'file-watcher.updated':
                  case 'session.created':
                  case 'session.deleted':
                  case 'session.compacted':
                  case 'command.executed':
                  case 'server.connected':
                  case 'server.heartbeat':
                    break

                  default: {
                    if (process.env.NODE_ENV === 'development') {
                      console.warn('[SSE] Unhandled event type:', (event as { type: string }).type)
                    }
                    break
                  }
                }

                handleRawDataFallbacks(rawData, ctx)
              } catch {
                // Ignore parse errors
              }
            }
          }
        }
      } catch (err) {
        console.error('Chat error:', err)

        setMessages((prev) => {
          const filtered = prev.filter((m) => m.id !== streamingMessageRef.current)
          return [
            ...filtered,
            createErrorMessage(
              err instanceof Error ? err.message : 'Connection lost. Please refresh and try again.',
              'transient',
              true,
            ),
          ]
        })

        setIsStreaming(false)
        setStreamingStatus('')
        streamingMessageRef.current = null
      }
    },
    [activeSessionId],
  )

  return { handleSend }
}
