'use client'

import { useCallback, useRef } from 'react'
import { sendChatMessage, subscribeToChatStream } from '@/lib/api/server'
import { postSessionSync } from '@/lib/session-sync-channel'
import { parseSSEEvent, getEventStatus, extractTextDelta } from '@/lib/sse-parser'
import { sessionStatusStore } from './use-session-status-store'
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
  handleAgentSession,
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
    activeSessionIdRef,
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
    setAgentSessionId,
    updateSessionTitle,
    updateSessionTitleIfEmpty,
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
      sessionStatusStore.update(targetSessionId, {
        isRunning: true,
        status: 'Preparing...',
        steps: [],
        contentPreview: '',
      })

      const userMessage = createUserMessage(content)
      const isFirstUserMessage = !messagesRef.current.some((m) => m.role === 'user')
      if (isFirstUserMessage) updateSessionTitleIfEmpty(targetSessionId, content)
      setMessages((prev) => [...prev, userMessage])

      const assistantMessage = createAssistantPlaceholder()
      streamingMessageRef.current = assistantMessage.id
      setMessages((prev) => [...prev, assistantMessage])

      // Client-side watchdog: if no done/error event received, force-clear with error
      const CLIENT_TIMEOUT_MS = 300_000 // 5 min overall timeout
      const STALL_TIMEOUT_MS = 90_000 // 90s stall detector — resets on each SSE event
      let lastEventTime = Date.now()
      const onStall = () => {
        if (streamingMessageRef.current && targetSessionId === activeSessionIdRef?.current) {
          const msgId = streamingMessageRef.current
          setMessages((prev) => {
            const withoutPlaceholder = prev.filter((m) => m.id !== msgId)
            return [...withoutPlaceholder, createErrorMessage('Request timed out. The agent took too long to respond.', 'transient', true)]
          })
          setIsStreaming(false)
          setStreamingStatus('')
          streamingMessageRef.current = null
          sessionStatusStore.update(targetSessionId, { isRunning: false, status: 'Error' })
          postSessionSync({ type: 'session-stopped', sessionId: targetSessionId })
        }
      }
      let stallTimerId: ReturnType<typeof setTimeout> | null = setTimeout(onStall, STALL_TIMEOUT_MS)
      const resetStallTimer = () => {
        lastEventTime = Date.now()
        if (stallTimerId) clearTimeout(stallTimerId)
        stallTimerId = setTimeout(onStall, STALL_TIMEOUT_MS)
      }
      let timeoutId: ReturnType<typeof setTimeout> | null = setTimeout(onStall, CLIENT_TIMEOUT_MS)

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
        setAgentSessionId,
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

          sessionStatusStore.update(targetSessionId, { isRunning: false, status: 'Error' })
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
                resetStallTimer()
                const rawData = JSON.parse(line.slice(6))
                if (!rawData.type && currentEventType) {
                  rawData.type = currentEventType
                }
                const event = parseSSEEvent(rawData)
                if (!event) continue

                switch (event.type) {
                  case 'message.part.updated': {
                    handleMessagePartUpdated(event as any, ctx, scheduleFlush)
                    const textDelta = extractTextDelta(event as any)
                    if (textDelta) {
                      sessionStatusStore.update(targetSessionId, {
                        contentPreview: ctx.assistantTextRef.current,
                      })
                    }
                    const eventStatus = getEventStatus(event as any)
                    if (eventStatus) {
                      sessionStatusStore.update(targetSessionId, { status: eventStatus.label })
                      sessionStatusStore.addStep(targetSessionId, eventStatus.label)
                    }
                    break
                  }

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
                        updateSessionTitle(targetSessionId, info.title)
                        postSessionSync({ type: 'sessions-invalidate' })
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

                  case 'agent-session': {
                    const id = (event as { agentSessionId?: string }).agentSessionId
                    if (id) handleAgentSession(id, ctx)
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
                  case 'session.idle': {
                    handleDoneOrIdle(ctx, streamStartTimeRef)
                    sessionStatusStore.update(targetSessionId, {
                      isRunning: false,
                      status: 'Done',
                      contentPreview: ctx.assistantTextRef.current || undefined,
                    })
                    break
                  }

                  case 'session.error':
                    handleSessionError((event as any).properties.error, ctx)
                    sessionStatusStore.update(targetSessionId, { isRunning: false, status: 'Error' })
                    break

                  case 'error':
                    handleGenericError((event as any).error, ctx)
                    sessionStatusStore.update(targetSessionId, { isRunning: false, status: 'Error' })
                    break

                  case 'status':
                  case 'session.status': {
                    const ev = event as { message?: string; status?: string }
                    const msg = ev.message ?? ev.status
                    if (typeof msg === 'string') {
                      ctx.setStreamingStatus(msg, ctx.accumulateSetupStepsRef.current)
                      sessionStatusStore.update(targetSessionId, { status: msg })
                      sessionStatusStore.addStep(targetSessionId, msg)
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
        const current = sessionStatusStore.get(targetSessionId)
        if (current?.isRunning) {
          sessionStatusStore.update(targetSessionId, {
            isRunning: false,
            status: 'Done',
            contentPreview: ctx.assistantTextRef.current || undefined,
          })
        }
      } catch (err) {
        console.error('Chat error:', err)
        sessionStatusStore.update(targetSessionId, { isRunning: false, status: 'Error' })

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
      } finally {
        if (timeoutId) clearTimeout(timeoutId)
        if (stallTimerId) clearTimeout(stallTimerId)
      }
    },
    [activeSessionId, activeSessionIdRef],
  )

  /** Process SSE event for a session when streamSessionInBackground receives it and user is viewing that session */
  const processStreamEventForSession = useCallback(
    (sessionId: string, event: { type: string; [k: string]: unknown }) => {
      if (!streamingMessageRef.current) {
        const isStreamingEvent = [
          'status',
          'session.status',
          'message.part.updated',
          'heartbeat',
          'agent-url',
          'agent-session',
        ].includes(event.type)
        if (isStreamingEvent) {
          const placeholder = createAssistantPlaceholder()
          streamingMessageRef.current = placeholder.id
          setMessages((prev) => [...prev, placeholder])
          setIsStreaming(true)
          const now = Date.now()
          setStreamStartTime(now)
          streamStartTimeRef.current = now
        } else return
      }
      const hasCompletedAssistant = messagesRef.current.some(
        (m) => m.role === 'assistant' && (m.content || m.toolInvocations?.length),
      )
      const accumulateSetupStepsRef = { current: !hasCompletedAssistant }
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
        setAgentSessionId,
        setStreamStartTime,
        setStreamingStatus,
        accumulateSetupStepsRef,
        streamingStatusStepsRef,
        clearStreamingStatusSteps,
        streamingMessageRef,
        assistantTextRef,
        reasoningRef,
        targetSessionId: sessionId,
      }
      switch (event.type) {
        case 'message.part.updated':
          handleMessagePartUpdated(event as any, ctx, scheduleFlush)
          break
        case 'done':
        case 'session.idle':
          handleDoneOrIdle(ctx, streamStartTimeRef)
          break
        case 'session.error':
          handleSessionError((event as any).properties?.error, ctx)
          break
        case 'error':
          handleGenericError((event as any).error, ctx)
          break
        case 'agent-url':
          handleAgentUrl((event as any).url, ctx)
          break
        case 'agent-session':
          handleAgentSession((event as any).agentSessionId, ctx)
          break
        case 'permission.asked':
          handlePermissionAsked((event as any).properties, ctx)
          break
        case 'permission.granted':
          handlePermissionResolved((event as any).properties?.id, 'granted', ctx)
          break
        case 'permission.denied':
          handlePermissionResolved((event as any).properties?.id, 'denied', ctx)
          break
        case 'question.asked':
          handleQuestionAsked((event as any).properties, ctx)
          break
        case 'question.replied':
          handleQuestionResolved((event as any).properties?.id, 'replied', ctx)
          break
        case 'question.rejected':
          handleQuestionResolved((event as any).properties?.id, 'rejected', ctx)
          break
        case 'status':
        case 'session.status': {
          const ev = event as { message?: string; status?: string }
          const msg = ev.message ?? ev.status
          if (typeof msg === 'string') {
            ctx.setStreamingStatus(msg, accumulateSetupStepsRef.current)
          }
          break
        }
        case 'heartbeat':
          break
        default:
          handleRawDataFallbacks(event, ctx)
      }
    },
    [
      setMessages,
      setIsStreaming,
      setTotalCost,
      setLastStepCost,
      setSessionTodos,
      setFileDiffs,
      setAgentUrl,
      setSessionTitle,
      setSessionInfo,
      setAgentSessionId,
      setStreamStartTime,
      setStreamingStatus,
      streamingStatusStepsRef,
      clearStreamingStatusSteps,
      streamingMessageRef,
      assistantTextRef,
      reasoningRef,
      scheduleFlush,
    ],
  )

  /** Resume an active stream (e.g. after page reload). Tries subscribe endpoint; if session not running, returns early. */
  const resumeStream = useCallback(
    async (sessionId: string) => {
      if (isStreamingRef.current) return

      try {
        const response = await subscribeToChatStream(sessionId)
        if (!response.ok || !response.body) return

        setIsStreaming(true)
        clearStreamingStatusSteps()
        assistantTextRef.current = ''
        reasoningRef.current = ''
        const now = Date.now()
        streamStartTimeRef.current = now
        setStreamStartTime(now)

        const hasCompletedAssistant = messagesRef.current.some(
          (m) => m.role === 'assistant' && (m.content || m.toolInvocations?.length),
        )
        const accumulateSetupStepsRef = { current: !hasCompletedAssistant }
        sessionStatusStore.update(sessionId, {
          isRunning: true,
          status: 'Resuming...',
          steps: [],
          contentPreview: '',
        })

        let placeholderAdded = false
        const ensurePlaceholder = () => {
          if (placeholderAdded) return
          placeholderAdded = true
          const placeholder = createAssistantPlaceholder()
          streamingMessageRef.current = placeholder.id
          setMessages((prev) => [...prev, placeholder])
        }

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
          setAgentSessionId,
          setStreamStartTime,
          setStreamingStatus,
          accumulateSetupStepsRef,
          streamingStatusStepsRef,
          clearStreamingStatusSteps,
          streamingMessageRef,
          assistantTextRef,
          reasoningRef,
          targetSessionId: sessionId,
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
                if (!rawData.type && currentEventType) rawData.type = currentEventType
                const event = parseSSEEvent(rawData)
                if (!event) continue

                switch (event.type) {
                  case 'session.idle':
                  case 'done':
                    if (!placeholderAdded) {
                      setIsStreaming(false)
                      sessionStatusStore.update(sessionId, { isRunning: false, status: 'Done' })
                      return
                    }
                    handleDoneOrIdle(ctx, streamStartTimeRef)
                    sessionStatusStore.update(sessionId, {
                      isRunning: false,
                      status: 'Done',
                      contentPreview: ctx.assistantTextRef.current || undefined,
                    })
                    return
                  case 'message.part.updated': {
                    ensurePlaceholder()
                    handleMessagePartUpdated(event as any, ctx, scheduleFlush)
                    const textDelta = extractTextDelta(event as any)
                    if (textDelta) {
                      sessionStatusStore.update(sessionId, {
                        contentPreview: ctx.assistantTextRef.current,
                      })
                    }
                    const eventStatus = getEventStatus(event as any)
                    if (eventStatus) {
                      sessionStatusStore.update(sessionId, { status: eventStatus.label })
                      sessionStatusStore.addStep(sessionId, eventStatus.label)
                    }
                    break
                  }
                  case 'message.updated':
                    break
                  case 'todo.updated':
                    ensurePlaceholder()
                    setSessionTodos((event as any).properties.todos)
                    break
                  case 'session.diff':
                    ensurePlaceholder()
                    setFileDiffs((event as any).properties.diff)
                    break
                  case 'message.removed':
                    setMessages((prev) => prev.filter((m) => m.id !== (event as any).properties.messageID))
                    break
                  case 'session.updated': {
                    ensurePlaceholder()
                    const info = (event as any).properties.info
                    if (info) {
                      if (info.title) {
                        setSessionTitle(info.title)
                        if (activeSessionId === sessionId) updateSessionTitle(sessionId, info.title)
                      }
                      setSessionInfo(info)
                    }
                    break
                  }
                  case 'agent-url':
                  case 'opencode-url': {
                    ensurePlaceholder()
                    const url = (event as { url?: string }).url
                    if (url) handleAgentUrl(url, ctx)
                    break
                  }
                  case 'agent-session': {
                    ensurePlaceholder()
                    const id = (event as { agentSessionId?: string }).agentSessionId
                    if (id) handleAgentSession(id, ctx)
                    break
                  }
                  case 'permission.asked':
                    ensurePlaceholder()
                    handlePermissionAsked((event as any).properties, ctx)
                    break
                  case 'permission.granted':
                    handlePermissionResolved((event as any).properties.id, 'granted', ctx)
                    break
                  case 'permission.denied':
                    handlePermissionResolved((event as any).properties.id, 'denied', ctx)
                    break
                  case 'question.asked':
                    ensurePlaceholder()
                    handleQuestionAsked((event as any).properties, ctx)
                    break
                  case 'question.replied':
                    handleQuestionResolved((event as any).properties.id, 'replied', ctx)
                    break
                  case 'question.rejected':
                    handleQuestionResolved((event as any).properties.id, 'rejected', ctx)
                    break
                  case 'session.error':
                    if (!placeholderAdded) setIsStreaming(false)
                    handleSessionError((event as any).properties.error, ctx)
                    sessionStatusStore.update(sessionId, { isRunning: false, status: 'Error' })
                    return
                  case 'error':
                    if (!placeholderAdded) setIsStreaming(false)
                    handleGenericError((event as any).error, ctx)
                    sessionStatusStore.update(sessionId, { isRunning: false, status: 'Error' })
                    return
                  case 'status':
                  case 'session.status': {
                    ensurePlaceholder()
                    const ev = event as { message?: string; status?: string }
                    const msg = ev.message ?? ev.status
                    if (typeof msg === 'string') {
                      ctx.setStreamingStatus(msg, ctx.accumulateSetupStepsRef.current)
                      sessionStatusStore.update(sessionId, { status: msg })
                      sessionStatusStore.addStep(sessionId, msg)
                    }
                    break
                  }
                  default:
                    ensurePlaceholder()
                    handleRawDataFallbacks(rawData, ctx)
                }
              } catch {
                // Ignore parse errors
              }
            }
          }
        }

        const current = sessionStatusStore.get(sessionId)
        if (current?.isRunning) {
          sessionStatusStore.update(sessionId, {
            isRunning: false,
            status: 'Done',
            contentPreview: ctx.assistantTextRef.current || undefined,
          })
        }
      } catch (err) {
        console.error('Resume stream error:', err)
        sessionStatusStore.update(sessionId, { isRunning: false, status: 'Error' })
        setIsStreaming(false)
        setStreamingStatus('')
        streamingMessageRef.current = null
      }
    },
    [
      activeSessionId,
      setMessages,
      setIsStreaming,
      setTotalCost,
      setLastStepCost,
      setSessionTodos,
      setFileDiffs,
      setAgentUrl,
      setSessionTitle,
      setSessionInfo,
      setAgentSessionId,
      setStreamStartTime,
      setStreamingStatus,
      updateSessionTitle,
      streamingStatusStepsRef,
      clearStreamingStatusSteps,
      streamingMessageRef,
      assistantTextRef,
      reasoningRef,
      scheduleFlush,
    ],
  )

  return { handleSend, processStreamEventForSession, resumeStream }
}
