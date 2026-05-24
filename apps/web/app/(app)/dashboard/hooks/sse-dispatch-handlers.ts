import { getEventStatus, extractTextDelta } from '@/lib/sse-parser'
import { postSessionSync } from '@/lib/session-sync-channel'
import { sessionStatusStore } from './use-session-status-store'
import {
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
  type SSEHandlerContext,
} from './sse-event-handlers'
import { actionForChatErrorPayload } from './sse-stream-utils'
import type { SSEEvent } from '@/lib/sse-types'
import type { DispatchSSEEventOptions } from './sse-event-dispatch'

export function dispatchMessageEvent(
  event: SSEEvent,
  options: Pick<DispatchSSEEventOptions, 'ctx' | 'targetSessionId' | 'scheduleFlush'>,
): void {
  const { ctx, targetSessionId, scheduleFlush } = options

  if (event.type === 'message.part.updated') {
    handleMessagePartUpdated(event, ctx, scheduleFlush)
    const textDelta = extractTextDelta(event)
    const eventStatus = getEventStatus(event)
    if (textDelta || eventStatus) {
      sessionStatusStore.update(targetSessionId, {
        ...(textDelta ? { contentPreview: ctx.assistantTextRef.current } : {}),
        ...(eventStatus ? { status: eventStatus.label, step: eventStatus.label } : {}),
      })
    }
    return
  }

  if (event.type === 'message.removed') {
    ctx.setMessages((prev) =>
      prev.filter((m) => m.id !== event.properties.messageID),
    )
  }
}

export function dispatchSessionMetaEvent(
  event: SSEEvent,
  options: Pick<DispatchSSEEventOptions, 'ctx' | 'targetSessionId' | 'updateSessionTitle'>,
): void {
  const { ctx, targetSessionId, updateSessionTitle } = options

  if (event.type === 'todo.updated') {
    ctx.setSessionTodos(event.properties.todos as never)
    return
  }

  if (event.type === 'session.diff') {
    ctx.setFileDiffs(event.properties.diff as never)
    return
  }

  if (event.type === 'session.updated') {
    const info = event.properties.info
    if (!info) return
    if (info.title) {
      ctx.setSessionTitle(info.title)
      updateSessionTitle(targetSessionId, info.title)
      postSessionSync({ type: 'sessions-invalidate' })
    }
    ctx.setSessionInfo(info as never)
  }
}

export function dispatchAgentConnectionEvent(event: SSEEvent, ctx: SSEHandlerContext): void {
  if (event.type === 'agent-url' || event.type === 'opencode-url') {
    if (event.url) handleAgentUrl(event.url, ctx)
    return
  }

  if (event.type === 'agent-session') {
    if (event.agentSessionId) handleAgentSession(event.agentSessionId, ctx)
  }
}

export function dispatchPromptEvent(event: SSEEvent, ctx: SSEHandlerContext): void {
  switch (event.type) {
    case 'permission.asked':
      handlePermissionAsked(event.properties, ctx)
      break
    case 'permission.granted':
      handlePermissionResolved(event.properties.id, 'granted', ctx)
      break
    case 'permission.denied':
      handlePermissionResolved(event.properties.id, 'denied', ctx)
      break
    case 'question.asked':
      handleQuestionAsked(event.properties, ctx)
      break
    case 'question.replied':
      handleQuestionResolved(event.properties.id, 'replied', ctx)
      break
    case 'question.rejected':
      handleQuestionResolved(event.properties.id, 'rejected', ctx)
      break
  }
}

export type LifecycleDispatchEvent =
  | SSEEvent
  | { type: '__stream_finalize__' }
  | {
      type: 'error'
      error?: string
      details?: string
      retryable?: boolean
      attempt?: number
      category?: string
    }

export function dispatchLifecycleEvent(
  event: LifecycleDispatchEvent,
  options: DispatchSSEEventOptions,
): void {
  const {
    ctx,
    targetSessionId,
    streamStartTimeRef,
    flushTimerRef,
    terminalStreamSessionsRef,
    deferDone,
    onDoneReceived,
    backgroundMode,
  } = options

  if (event.type === 'done' || event.type === 'session.idle') {
    if (backgroundMode) {
      sessionStatusStore.update(targetSessionId, { isRunning: false, status: 'Done' })
      return
    }
    if (deferDone) {
      onDoneReceived?.()
      terminalStreamSessionsRef.current.add(targetSessionId)
      return
    }
    finalizeStreamFromDispatch(ctx, streamStartTimeRef, flushTimerRef, targetSessionId)
    terminalStreamSessionsRef.current.add(targetSessionId)
    return
  }

  if (event.type === '__stream_finalize__') {
    if (ctx.streamingMessageRef.current) {
      if (flushTimerRef.current != null) {
        clearTimeout(flushTimerRef.current)
        flushTimerRef.current = null
      }
      handleDoneOrIdle(ctx, streamStartTimeRef)
    }
    terminalStreamSessionsRef.current.add(targetSessionId)
    return
  }

  if (event.type === 'session.error') {
    handleSessionError(event.properties.error, ctx)
    sessionStatusStore.update(targetSessionId, { isRunning: false, status: 'Error' })
    terminalStreamSessionsRef.current.add(targetSessionId)
    return
  }

  if (event.type === 'error') {
    const attempt = 'attempt' in event ? event.attempt : undefined
    if (event.retryable && typeof attempt === 'number') {
      const retryMsg = event.error || `Retrying (attempt ${attempt + 1})...`
      ctx.setStreamingStatus(retryMsg, ctx.accumulateSetupStepsRef.current)
      sessionStatusStore.update(targetSessionId, { status: retryMsg })
    } else {
      handleGenericError(event.error, ctx, event.details, actionForChatErrorPayload(event))
      sessionStatusStore.update(targetSessionId, { isRunning: false, status: 'Error' })
      terminalStreamSessionsRef.current.add(targetSessionId)
    }
    return
  }

  if (event.type === 'status' || event.type === 'session.status') {
    const msg = event.type === 'status' ? (event.message ?? event.status) : event.properties.status
    if (typeof msg === 'string') {
      ctx.setStreamingStatus(msg, ctx.accumulateSetupStepsRef.current)
      sessionStatusStore.update(targetSessionId, { status: msg })
      sessionStatusStore.addStep(targetSessionId, msg)
    }
  }
}

export function finalizeStreamFromDispatch(
  ctx: SSEHandlerContext,
  streamStartTimeRef: React.MutableRefObject<number | null>,
  flushTimerRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>,
  targetSessionId: string,
): void {
  if (flushTimerRef.current != null) {
    clearTimeout(flushTimerRef.current)
    flushTimerRef.current = null
  }
  const finalPreview = ctx.assistantTextRef.current || undefined
  handleDoneOrIdle(ctx, streamStartTimeRef)
  sessionStatusStore.update(targetSessionId, { isRunning: false, status: 'Done', contentPreview: finalPreview })
}
