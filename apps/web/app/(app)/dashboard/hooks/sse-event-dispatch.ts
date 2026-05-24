import { handleRawDataFallbacks, type SSEHandlerContext } from './sse-event-handlers'
import type { SSEEvent } from '@/lib/sse-types'
import {
  dispatchMessageEvent,
  dispatchSessionMetaEvent,
  dispatchAgentConnectionEvent,
  dispatchPromptEvent,
  dispatchLifecycleEvent,
  finalizeStreamFromDispatch,
  type LifecycleDispatchEvent,
} from './sse-dispatch-handlers'

export interface DispatchSSEEventOptions {
  ctx: SSEHandlerContext
  targetSessionId: string
  scheduleFlush: () => void
  streamStartTimeRef: React.MutableRefObject<number | null>
  flushTimerRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>
  terminalStreamSessionsRef: React.MutableRefObject<Set<string>>
  updateSessionTitle: (sessionId: string, title: string) => void
  deferDone?: boolean
  onDoneReceived?: () => void
  backgroundMode?: boolean
}

const NOOP_EVENT_TYPES = new Set([
  'heartbeat',
  'file-watcher.updated',
  'session.created',
  'session.deleted',
  'session.compacted',
  'command.executed',
  'server.connected',
  'server.heartbeat',
  'message.updated',
])

export function dispatchParsedSSEEvent(
  event: { type: string; [k: string]: unknown },
  options: DispatchSSEEventOptions,
): void {
  const { ctx } = options

  if (NOOP_EVENT_TYPES.has(event.type)) return

  if (event.type.startsWith('message.')) {
    dispatchMessageEvent(event as SSEEvent, options)
    return
  }

  if (event.type === 'todo.updated' || event.type === 'session.diff' || event.type === 'session.updated') {
    dispatchSessionMetaEvent(event as SSEEvent, options)
    return
  }

  if (event.type === 'agent-url' || event.type === 'opencode-url' || event.type === 'agent-session') {
    dispatchAgentConnectionEvent(event as SSEEvent, ctx)
    return
  }

  if (event.type.startsWith('permission.') || event.type.startsWith('question.')) {
    dispatchPromptEvent(event as SSEEvent, ctx)
    return
  }

  if (
    event.type === 'done' ||
    event.type === 'session.idle' ||
    event.type === '__stream_finalize__' ||
    event.type === 'session.error' ||
    event.type === 'error' ||
    event.type === 'status' ||
    event.type === 'session.status'
  ) {
    dispatchLifecycleEvent(event as LifecycleDispatchEvent, options)
    return
  }

  if (process.env.NODE_ENV === 'development') {
    console.warn('[SSE] Unhandled event type:', event.type)
  }
}

export function finalizeStream(
  ctx: SSEHandlerContext,
  streamStartTimeRef: React.MutableRefObject<number | null>,
  flushTimerRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>,
  targetSessionId: string,
): void {
  finalizeStreamFromDispatch(ctx, streamStartTimeRef, flushTimerRef, targetSessionId)
}

export function dispatchRawDataFallbacks(rawData: Record<string, unknown>, ctx: SSEHandlerContext): void {
  handleRawDataFallbacks(rawData, ctx)
}
