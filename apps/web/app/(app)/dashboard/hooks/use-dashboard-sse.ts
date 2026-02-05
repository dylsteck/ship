'use client'

import { useCallback } from 'react'
import { sendChatMessage, type Message } from '@/lib/api'
import { parseSSEEvent, extractCostInfo, getEventStatus } from '@/lib/sse-parser'
import type { ToolPart as SSEToolPart, ReasoningPart, StepFinishPart } from '@/lib/sse-types'

type ToolPart = {
  type: 'tool'
  callID: string
  tool: string
  state: {
    title: string
    status?: 'pending' | 'running' | 'complete' | 'error'
  }
}

interface UseDashboardSSEParams {
  activeSessionId: string | null
  isStreaming: boolean
  mode: 'build' | 'plan'
  setIsStreaming: (value: boolean) => void
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>
  setActivityTools: React.Dispatch<React.SetStateAction<SSEToolPart[]>>
  setThinkingParts: React.Dispatch<React.SetStateAction<ToolPart[]>>
  setThinkingReasoning: React.Dispatch<React.SetStateAction<string>>
  setThinkingStatus: React.Dispatch<React.SetStateAction<string>>
  setReasoningParts: React.Dispatch<React.SetStateAction<ReasoningPart[]>>
  setLastStepCost: React.Dispatch<React.SetStateAction<{ cost: number; tokens: StepFinishPart['tokens'] } | null>>
  setTotalCost: React.Dispatch<React.SetStateAction<number>>
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
  setStatusEvents: React.Dispatch<
    React.SetStateAction<Array<{ status: string; message: string; time: number }>>
  >
  setMessageQueue: React.Dispatch<React.SetStateAction<string[]>>
  streamingMessageRef: React.MutableRefObject<string | null>
  assistantTextRef: React.MutableRefObject<string>
  setStreamStartTime: (value: number | null) => void
}

export function useDashboardSSE({
  activeSessionId,
  isStreaming,
  mode,
  setIsStreaming,
  setMessages,
  setActivityTools,
  setThinkingParts,
  setThinkingReasoning,
  setThinkingStatus,
  setReasoningParts,
  setLastStepCost,
  setTotalCost,
  setSessionTodos,
  setFileDiffs,
  setStatusEvents,
  setMessageQueue,
  streamingMessageRef,
  assistantTextRef,
  setStreamStartTime,
}: UseDashboardSSEParams) {
  const handleSend = useCallback(
    async (content: string, modeOverride?: 'build' | 'plan', sessionIdOverride?: string) => {
      const targetSessionId = sessionIdOverride || activeSessionId
      if (!targetSessionId) return

      if (isStreaming) {
        setMessageQueue((q) => [...q, content])
        return
      }

      setIsStreaming(true)
      setThinkingParts([])
      setThinkingReasoning('')
      setThinkingStatus('Starting')
      assistantTextRef.current = ''
      setActivityTools([])
      setReasoningParts([])
      setLastStepCost(null)
      setStreamStartTime(Date.now())

      const userMessage: Message = {
        id: `temp-${Date.now()}`,
        role: 'user',
        content,
        createdAt: Math.floor(Date.now() / 1000),
      }
      setMessages((prev) => [...prev, userMessage])

      const assistantId = `temp-assistant-${Date.now()}`
      streamingMessageRef.current = assistantId
      const assistantMessage: Message = {
        id: assistantId,
        role: 'assistant',
        content: '',
        createdAt: Math.floor(Date.now() / 1000),
      }
      setMessages((prev) => [...prev, assistantMessage])

      try {
        const response = await sendChatMessage(targetSessionId, content, modeOverride ?? mode)

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
          console.error('Chat request failed:', errorData)

          const errorMessage: Message = {
            id: `error-${Date.now()}`,
            role: 'system',
            content: errorData.error || errorData.details || 'Failed to start agent',
            type: 'error',
            errorCategory: 'persistent',
            retryable: false,
            createdAt: Math.floor(Date.now() / 1000),
          }
          setMessages((prev) => {
            const filtered = prev.filter((m) => m.id !== streamingMessageRef.current)
            return [...filtered, errorMessage]
          })

          setIsStreaming(false)
          setThinkingStatus('')
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

                    if (part.type === 'text') {
                      if (typeof delta === 'string') {
                        assistantTextRef.current += delta
                      } else if (part.text) {
                        assistantTextRef.current = part.text
                      }
                      setMessages((prev) =>
                        prev.map((m) =>
                          m.id === streamingMessageRef.current
                            ? { ...m, content: assistantTextRef.current }
                            : m,
                        ),
                      )
                    }

                    if (part.type === 'tool') {
                      const toolPart: SSEToolPart = {
                        id: part.id,
                        sessionID: part.sessionID,
                        messageID: part.messageID,
                        type: 'tool',
                        callID: part.callID,
                        tool: part.tool,
                        state: part.state,
                      }

                      setActivityTools((prev) => {
                        const existing = prev.findIndex((t) => t.callID === toolPart.callID)
                        if (existing >= 0) {
                          return prev.map((t, i) => (i === existing ? toolPart : t))
                        }
                        return [...prev, toolPart]
                      })

                      const oldToolPart: ToolPart = {
                        type: 'tool',
                        callID: part.callID,
                        tool: part.tool,
                        state: {
                          title: part.state.title || '',
                          status: part.state.status === 'completed' ? 'complete' : part.state.status,
                        },
                      }
                      setThinkingParts((prev) => {
                        const existing = prev.findIndex((p) => p.callID === oldToolPart.callID)
                        if (existing >= 0) {
                          return prev.map((p, i) => (i === existing ? oldToolPart : p))
                        }
                        return [...prev, oldToolPart]
                      })

                      const statusInfo = getEventStatus(event)
                      if (statusInfo) {
                        setThinkingStatus(`${statusInfo.icon} ${statusInfo.label}`)
                      }
                    }

                    if (part.type === 'reasoning' && part.text) {
                      setThinkingReasoning((prev) => (prev ? `${prev}\n\n${part.text}` : part.text))
                      setThinkingStatus('💭 Reasoning...')

                      const reasoningPart: ReasoningPart = {
                        id: part.id,
                        sessionID: part.sessionID,
                        messageID: part.messageID,
                        type: 'reasoning',
                        text: part.text,
                      }
                      setReasoningParts((prev) => [...prev, reasoningPart])
                    }

                    if (part.type === 'step-finish') {
                      const costInfo = extractCostInfo(event)
                      if (costInfo) {
                        setLastStepCost({
                          cost: costInfo.cost,
                          tokens: {
                            input: costInfo.tokens.input,
                            output: costInfo.tokens.output,
                            reasoning: costInfo.tokens.reasoning,
                            cache: { read: costInfo.tokens.cacheRead, write: costInfo.tokens.cacheWrite },
                          },
                        })
                        setTotalCost((prev) => prev + costInfo.cost)
                      }
                    }
                    break
                  }

                  case 'status': {
                    const statusInfo = getEventStatus(event)
                    if (statusInfo) {
                      setThinkingStatus(`${statusInfo.icon} ${statusInfo.label}`)
                      setStatusEvents((prev) => [
                        ...prev,
                        {
                          status: event.status,
                          message: event.message,
                          time: Date.now(),
                        },
                      ])
                    }
                    break
                  }

                  case 'session.status': {
                    const statusInfo = getEventStatus(event)
                    if (statusInfo) {
                      setThinkingStatus(`${statusInfo.icon} ${statusInfo.label}`)
                      setStatusEvents((prev) => [
                        ...prev,
                        {
                          status: `session-${event.properties.status.type}`,
                          message: statusInfo.label,
                          time: Date.now(),
                        },
                      ])
                    }
                    break
                  }

                  case 'todo.updated': {
                    const todos = event.properties.todos
                    setSessionTodos(todos)
                    if (todos.length > 0) {
                      setThinkingStatus(`📋 Task: ${todos[0].content.slice(0, 40)}`)
                    }
                    break
                  }

                  case 'session.diff': {
                    setFileDiffs(event.properties.diff)
                    break
                  }

                  case 'file-watcher.updated': {
                    const { event: fileEvent, path } = event.properties
                    setThinkingStatus(`📝 ${fileEvent}: ${path.split('/').pop()}`)
                    break
                  }

                  case 'heartbeat': {
                    const statusInfo = getEventStatus(event)
                    if (statusInfo) {
                      setThinkingStatus(`${statusInfo.icon} ${statusInfo.label}`)
                    }
                    break
                  }

                  case 'done':
                  case 'session.idle': {
                    setIsStreaming(false)
                    setThinkingStatus('')
                    streamingMessageRef.current = null
                    setTimeout(() => {
                      setActivityTools([])
                      setThinkingParts([])
                      setLastStepCost(null)
                      setReasoningParts([])
                      setStatusEvents([])
                    }, 3000)
                    break
                  }

                  case 'error': {
                    const errorMessage: Message = {
                      id: `error-${Date.now()}`,
                      role: 'system',
                      content: event.error,
                      type: 'error',
                      errorCategory: event.category || 'persistent',
                      retryable: event.retryable || false,
                      createdAt: Math.floor(Date.now() / 1000),
                    }
                    setMessages((prev) => [...prev, errorMessage])
                    setIsStreaming(false)
                    setThinkingStatus('')
                    streamingMessageRef.current = null
                    break
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
                  const prMessage: Message = {
                    id: `pr-${Date.now()}`,
                    role: 'system',
                    content: `Draft PR created: ${rawData.prUrl}`,
                    type: 'pr-notification',
                    createdAt: Math.floor(Date.now() / 1000),
                  }
                  setMessages((prev) => [...prev, prMessage])
                }
              } catch {
                // Ignore parse errors
              }
            }
          }
        }
      } catch (err) {
        console.error('Chat error:', err)

        const errorMessage: Message = {
          id: `error-${Date.now()}`,
          role: 'system',
          content: err instanceof Error ? err.message : 'Connection lost. Please refresh and try again.',
          type: 'error',
          errorCategory: 'transient',
          retryable: true,
          createdAt: Math.floor(Date.now() / 1000),
        }

        setMessages((prev) => {
          const filtered = prev.filter((m) => m.id !== streamingMessageRef.current)
          return [...filtered, errorMessage]
        })

        setIsStreaming(false)
        setThinkingStatus('')
        setThinkingParts([])
        setActivityTools([])
        streamingMessageRef.current = null
      }
    },
    [activeSessionId, isStreaming, mode],
  )

  return { handleSend }
}
