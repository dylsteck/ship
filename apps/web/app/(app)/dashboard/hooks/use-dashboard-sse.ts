'use client'

import { useCallback, useRef } from 'react'
import { sendChatMessage } from '@/lib/api'
import { parseSSEEvent } from '@/lib/sse-parser'
import type { ToolPart as SSEToolPart, StepFinishPart, SessionInfo } from '@/lib/sse-types'
import {
  type UIMessage,
  processPartUpdated,
  createUserMessage,
  createAssistantPlaceholder,
  createErrorMessage,
  createPermissionMessage,
  createQuestionMessage,
  createSystemMessage,
  updatePromptStatus,
  classifyError,
  parseErrorMessage,
  extractStepCost,
} from '@/lib/ai-elements-adapter'

interface UseDashboardSSEParams {
  activeSessionId: string | null
  isStreaming: boolean
  mode: 'build' | 'plan'
  setIsStreaming: (value: boolean) => void
  setMessages: React.Dispatch<React.SetStateAction<UIMessage[]>>
  setTotalCost: React.Dispatch<React.SetStateAction<number>>
  setLastStepCost: React.Dispatch<React.SetStateAction<{ cost: number; tokens: StepFinishPart['tokens'] } | null>>
  setSessionTodos: React.Dispatch<
    React.SetStateAction<
      Array<{
        id: string
        content: string
        status: 'pending' | 'in_progress' | 'completed' | 'cancelled'
        priority: 'high' | 'medium' | 'low'
      }>
    >
  >
  setFileDiffs: React.Dispatch<
    React.SetStateAction<Array<{ filename: string; additions: number; deletions: number }>>
  >
  setMessageQueue: React.Dispatch<React.SetStateAction<string[]>>
  setOpenCodeUrl: React.Dispatch<React.SetStateAction<string>>
  setSessionTitle: React.Dispatch<React.SetStateAction<string>>
  setSessionInfo: React.Dispatch<React.SetStateAction<SessionInfo | null>>
  streamingMessageRef: React.MutableRefObject<string | null>
  assistantTextRef: React.MutableRefObject<string>
  reasoningRef: React.MutableRefObject<string>
  setStreamStartTime: (value: number | null) => void
}

export function useDashboardSSE({
  activeSessionId,
  isStreaming,
  mode,
  setIsStreaming,
  setMessages,
  setTotalCost,
  setLastStepCost,
  setSessionTodos,
  setFileDiffs,
  setMessageQueue,
  setOpenCodeUrl,
  setSessionTitle,
  setSessionInfo,
  streamingMessageRef,
  assistantTextRef,
  reasoningRef,
  setStreamStartTime,
}: UseDashboardSSEParams) {
  const flushRef = useRef<number | null>(null)
  const streamStartTimeRef = useRef<number | null>(null)

  const scheduleFlush = useCallback(() => {
    if (flushRef.current !== null) return
    flushRef.current = requestAnimationFrame(() => {
      flushRef.current = null
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
    })
  }, [setMessages, streamingMessageRef, assistantTextRef, reasoningRef])

  const handleSend = useCallback(
    async (content: string, modeOverride?: 'build' | 'plan', sessionIdOverride?: string) => {
      const targetSessionId = sessionIdOverride || activeSessionId
      if (!targetSessionId) return

      if (isStreaming) {
        setMessageQueue((q) => [...q, content])
        return
      }

      setIsStreaming(true)
      assistantTextRef.current = ''
      reasoningRef.current = ''
      setLastStepCost(null)
      const now = Date.now()
      streamStartTimeRef.current = now
      setStreamStartTime(now)

      // Add user message
      const userMessage = createUserMessage(content)
      setMessages((prev) => [...prev, userMessage])

      // Add assistant placeholder
      const assistantMessage = createAssistantPlaceholder()
      streamingMessageRef.current = assistantMessage.id
      setMessages((prev) => [...prev, assistantMessage])

      try {
        const response = await sendChatMessage(targetSessionId, content, modeOverride ?? mode)

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
          const errorContent = errorData.error || errorData.details || 'Failed to start agent'
          const { category, retryable } = classifyError(errorContent)

          setMessages((prev) => {
            const filtered = prev.filter((m) => m.id !== streamingMessageRef.current)
            return [...filtered, createErrorMessage(errorContent, category, retryable)]
          })

          setIsStreaming(false)
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
                  case 'message.part.updated': {
                    const part = event.properties.part
                    const delta = event.properties.delta

                    if (part.type === 'text' || part.type === 'reasoning') {
                      // Accumulate in refs and batch via rAF for smooth rendering
                      if (part.type === 'text') {
                        if (typeof delta === 'string') {
                          assistantTextRef.current += delta
                        } else if ((part as { text?: string }).text) {
                          assistantTextRef.current = (part as { text: string }).text
                        }
                      } else {
                        if (typeof delta === 'string') {
                          reasoningRef.current += delta
                        } else if ((part as { text?: string }).text) {
                          reasoningRef.current = (part as { text: string }).text
                        }
                      }
                      scheduleFlush()
                    } else {
                      // Tools, step-finish etc. — update immediately via adapter
                      setMessages((prev) =>
                        processPartUpdated(part, delta, streamingMessageRef.current!, prev, assistantTextRef, reasoningRef),
                      )
                    }

                    // Extract cost from step-finish
                    if (part.type === 'step-finish') {
                      const costInfo = extractStepCost(part)
                      if (costInfo) {
                        setLastStepCost(costInfo)
                        setTotalCost((prev) => prev + costInfo.cost)
                      }
                    }
                    break
                  }

                  case 'message.updated': {
                    // Message completed - update metadata if needed
                    break
                  }

                  case 'message.removed': {
                    const messageID = event.properties.messageID
                    setMessages((prev) => prev.filter((m) => m.id !== messageID))
                    break
                  }

                  case 'todo.updated': {
                    setSessionTodos(event.properties.todos)
                    break
                  }

                  case 'session.diff': {
                    setFileDiffs(event.properties.diff)
                    break
                  }

                  case 'session.updated': {
                    const info = event.properties.info
                    if (info) {
                      if (info.title) setSessionTitle(info.title)
                      setSessionInfo(info)
                    }
                    break
                  }

                  case 'opencode-url': {
                    const url = (event as { url?: string }).url
                    if (url) {
                      setOpenCodeUrl(url)
                      try { localStorage.setItem(`opencode-url-${targetSessionId}`, url) } catch {}
                    }
                    break
                  }

                  case 'permission.asked': {
                    const props = event.properties
                    setMessages((prev) => [
                      ...prev,
                      createPermissionMessage(props.id, props.permission, props.description, props.patterns),
                    ])
                    break
                  }

                  case 'permission.granted': {
                    setMessages((prev) => updatePromptStatus(event.properties.id, 'granted', prev))
                    break
                  }

                  case 'permission.denied': {
                    setMessages((prev) => updatePromptStatus(event.properties.id, 'denied', prev))
                    break
                  }

                  case 'question.asked': {
                    const props = event.properties
                    setMessages((prev) => [...prev, createQuestionMessage(props.id, props.text)])
                    break
                  }

                  case 'question.replied': {
                    setMessages((prev) => updatePromptStatus(event.properties.id, 'replied', prev))
                    break
                  }

                  case 'question.rejected': {
                    setMessages((prev) => updatePromptStatus(event.properties.id, 'rejected', prev))
                    break
                  }

                  case 'done':
                  case 'session.idle': {
                    // Flush any remaining batched text before ending
                    if (flushRef.current !== null) {
                      cancelAnimationFrame(flushRef.current)
                      flushRef.current = null
                    }
                    // Final flush of accumulated text + stamp wall-clock elapsed
                    const finalMsgId = streamingMessageRef.current
                    if (finalMsgId) {
                      const finalText = assistantTextRef.current
                      const finalReasoning = reasoningRef.current
                      const elapsed = streamStartTimeRef.current
                        ? Date.now() - streamStartTimeRef.current
                        : 0
                      setMessages((prev) =>
                        prev.map((m) => {
                          if (m.id !== finalMsgId) return m
                          return {
                            ...m,
                            content: finalText,
                            ...(finalReasoning ? { reasoning: [finalReasoning] } : {}),
                            elapsed,
                          }
                        }),
                      )
                    }
                    setIsStreaming(false)
                    setStreamStartTime(null)
                    streamingMessageRef.current = null
                    break
                  }

                  case 'session.error': {
                    const errorData = event.properties.error
                    let errorMessage = 'An error occurred'
                    if (errorData?.data?.message) {
                      errorMessage = errorData.data.message
                    } else if (errorData?.message) {
                      errorMessage = errorData.message
                    }

                    const { category, retryable } = classifyError(errorMessage)
                    setMessages((prev) => [...prev, createErrorMessage(errorMessage, category, retryable)])
                    setIsStreaming(false)
                    streamingMessageRef.current = null
                    break
                  }

                  case 'error': {
                    const errorMessage = parseErrorMessage(event.error)
                    const { category, retryable } = classifyError(errorMessage)
                    setMessages((prev) => [...prev, createErrorMessage(errorMessage, category, retryable)])
                    setIsStreaming(false)
                    streamingMessageRef.current = null
                    break
                  }

                  case 'status':
                  case 'session.status':
                  case 'heartbeat':
                  case 'file-watcher.updated':
                  case 'session.created':
                  case 'session.deleted':
                  case 'session.compacted':
                  case 'command.executed':
                  case 'server.connected':
                  case 'server.heartbeat':
                    // These events are informational - no message state changes needed
                    break

                  default: {
                    if (process.env.NODE_ENV === 'development') {
                      console.warn('[SSE] Unhandled event type:', (event as { type: string }).type)
                    }
                    break
                  }
                }

                // Handle wrapped event fallbacks
                if (rawData.type === 'event' && rawData.properties) {
                  const innerEvent = rawData.properties as { type?: string; error?: unknown }
                  if (innerEvent.type === 'session.error') {
                    const errorData = innerEvent.error as { name?: string; data?: { message?: string }; message?: string }
                    let errorMessage = 'An error occurred'
                    if (errorData?.data?.message) {
                      errorMessage = errorData.data.message
                    } else if (errorData?.message) {
                      errorMessage = errorData.message
                    }

                    const { category, retryable } = classifyError(errorMessage)
                    setMessages((prev) => [...prev, createErrorMessage(errorMessage, category, retryable)])
                    setIsStreaming(false)
                    streamingMessageRef.current = null
                  }
                }

                if (rawData.type === 'assistant') {
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === streamingMessageRef.current
                        ? { ...m, content: rawData.content, id: rawData.id || m.id }
                        : m,
                    ),
                  )
                }

                if (rawData.prUrl) {
                  setMessages((prev) => [
                    ...prev,
                    createSystemMessage(`Draft PR created: ${rawData.prUrl}`, 'pr-notification'),
                  ])
                }
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
        streamingMessageRef.current = null
      }
    },
    [activeSessionId, isStreaming, mode],
  )

  return { handleSend }
}
