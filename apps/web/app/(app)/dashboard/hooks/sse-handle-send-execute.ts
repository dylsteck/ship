'use client'

import { sendChatMessage } from '@/lib/api/chat-client'
import { setActiveSseSession } from '@/lib/active-sse-session'
import { postSessionSync } from '@/lib/session-sync-channel'
import { getStreamingRefs, useChatStore } from '@/lib/chat-store/store'
import { sessionStatusStore } from './use-session-status-store'
import { createErrorMessage, classifyError } from '@/lib/ai-elements-adapter'
import { isGenericError } from './sse-event-handlers'
import { finalizeStream } from './sse-event-dispatch'
import { actionForChatErrorPayload } from './sse-stream-utils'
import { readChatSSEStream } from './sse-read-stream'
import { prepareChatSend, queueChatSend } from './sse-handle-send-prepare'
import type { useDashboardChat } from './use-dashboard-chat'
import type { UseSseHandleSendParams } from './use-sse-handle-send'

function clearSessionStreamingState(chat: ReturnType<typeof useDashboardChat>, targetSessionId: string): void {
  useChatStore.getState().setIsStreaming(targetSessionId, false)
  if (chat.activeSessionIdRef.current === targetSessionId) {
    chat.setIsStreaming(false)
  }
}

async function handleSendError(
  response: Response,
  chat: ReturnType<typeof useDashboardChat>,
  targetSessionId: string,
  terminalStreamSessionsRef: React.MutableRefObject<Set<string>>,
): Promise<void> {
  const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
  const mainError = errorData.error || errorData.details || 'Failed to start agent'
  const errorContent = errorData.details && isGenericError(errorData.error || '') ? errorData.details : mainError
  const { category, retryable } = classifyError(errorContent)
  const action = actionForChatErrorPayload(errorData as { category?: string })

  const streamingRefs = getStreamingRefs(targetSessionId)

  chat.setMessages((prev) => {
    const filtered = prev.filter((m) => m.id !== streamingRefs.streamingMessageRef.current)
    return [...filtered, createErrorMessage(errorContent, category, retryable, errorContent, action)]
  })

  sessionStatusStore.update(targetSessionId, { isRunning: false, status: 'Error' })
  postSessionSync({ type: 'session-stopped', sessionId: targetSessionId })
  clearSessionStreamingState(chat, targetSessionId)
  chat.setStreamingStatus('')
  streamingRefs.streamingMessageRef.current = null
  streamingRefs.assistantTextRef.current = ''
  streamingRefs.reasoningRef.current = ''
  streamingRefs.orderedPartsRef.current = []
  terminalStreamSessionsRef.current.add(targetSessionId)
}

function handleSendCatch(
  err: unknown,
  chat: ReturnType<typeof useDashboardChat>,
  targetSessionId: string,
  terminalStreamSessionsRef: React.MutableRefObject<Set<string>>,
): void {
  console.error('Chat error:', err)
  sessionStatusStore.update(targetSessionId, { isRunning: false, status: 'Error' })
  postSessionSync({ type: 'session-stopped', sessionId: targetSessionId })
  const streamingRefs = getStreamingRefs(targetSessionId)
  chat.setMessages((prev) => {
    const filtered = prev.filter((m) => m.id !== streamingRefs.streamingMessageRef.current)
    return [
      ...filtered,
      createErrorMessage(
        err instanceof Error ? err.message : 'Connection lost. Please refresh and try again.',
        'transient',
        true,
      ),
    ]
  })
  clearSessionStreamingState(chat, targetSessionId)
  chat.setStreamingStatus('')
  streamingRefs.streamingMessageRef.current = null
  streamingRefs.assistantTextRef.current = ''
  streamingRefs.reasoningRef.current = ''
  streamingRefs.orderedPartsRef.current = []
  terminalStreamSessionsRef.current.add(targetSessionId)
}

export async function executeChatSend(
  content: string,
  modeOverride: string | undefined,
  sessionIdOverride: string | undefined,
  params: UseSseHandleSendParams,
  createWatchdog: ReturnType<typeof import('./use-sse-stall-watchdog').useSseStallWatchdog>,
): Promise<void> {
  const { chat, modeRef, modelIdRef, claimStreamEvent, streamStartTimeRef, terminalStreamSessionsRef } = params
  const targetSessionId = sessionIdOverride || chat.activeSessionId
  if (!targetSessionId) return
  if (queueChatSend(content, params)) return

  const { ctx } = prepareChatSend(content, targetSessionId, chat, streamStartTimeRef, terminalStreamSessionsRef)
  const watchdog = createWatchdog(targetSessionId, ctx)
  let doneOrIdleReceived = false
  setActiveSseSession(targetSessionId)

  try {
    const response = await sendChatMessage({
      sessionId: targetSessionId,
      content,
      mode: modeOverride ?? modeRef.current,
      model: modelIdRef.current ?? undefined,
    })

    if (!response.ok) {
      watchdog.clear()
      await handleSendError(response, chat, targetSessionId, terminalStreamSessionsRef)
      return
    }

    if (!response.body) throw new Error('No response body')

    await readChatSSEStream({
      body: response.body,
      targetSessionId,
      ctx,
      claimStreamEvent,
      dispatchOptions: {
        scheduleFlush: params.scheduleFlush,
        streamStartTimeRef,
        flushTimerRef: params.flushTimerRef,
        terminalStreamSessionsRef,
        updateSessionTitle: chat.updateSessionTitle,
        deferDone: true,
        onDoneReceived: () => {
          doneOrIdleReceived = true
        },
      },
      onEvent: watchdog.reset,
    })

    watchdog.clear()
    params.clearPendingFlush()

    if (chat.streamingMessageRef.current) {
      finalizeStream(ctx, streamStartTimeRef, params.flushTimerRef, targetSessionId)
    } else {
      const current = sessionStatusStore.get(targetSessionId)
      if (current?.isRunning) {
        sessionStatusStore.update(targetSessionId, { isRunning: false, status: 'Done' })
      }
    }
    clearSessionStreamingState(chat, targetSessionId)
    if (doneOrIdleReceived) postSessionSync({ type: 'sessions-invalidate' })
    postSessionSync({ type: 'session-stopped', sessionId: targetSessionId })
  } catch (err) {
    watchdog.clear()
    handleSendCatch(err, chat, targetSessionId, terminalStreamSessionsRef)
  } finally {
    setActiveSseSession(null)
  }
}
