import { sendChatMessage } from '@/lib/api/chat-client'
import { parseSSEEvent, getEventStatus, extractTextDelta } from '@/lib/sse-parser'
import { consumeSSEBody } from '@/lib/session-connection'
import { getStreamingRefs } from '@/lib/chat-store/store'
import { isAgentHarnessEvent } from '@/lib/sse-types'
import { sessionStatusStore } from './use-session-status-store'
import { eventsStore } from './use-events-store'
import { postSessionSync } from '@/lib/session-sync-channel'
import { isStreamingTextDelta } from './sse-stream-utils'
import { DEFAULT_ACP_MODEL_ID } from './dashboard-mode-storage'
import type { useDashboardChat } from './use-dashboard-chat'

function applySessionStatusUpdate(
  sessionId: string,
  event: ReturnType<typeof parseSSEEvent>,
  accumulatedText: string,
): string {
  if (!event) return accumulatedText

  const type = (event as { type: string }).type
  const textDelta = extractTextDelta(event)
  if (textDelta) accumulatedText += textDelta

  const eventStatus = getEventStatus(event)
  const isHeartbeat = type === 'heartbeat'
  const isStatusEvent = type === 'status' || type === 'session.status'
  const statusMsg = isStatusEvent
    ? ((event as { message?: string; status?: string }).message ??
       (event as { message?: string; status?: string }).status)
    : null

  if (textDelta || eventStatus || (isStatusEvent && statusMsg)) {
    sessionStatusStore.update(sessionId, {
      ...(!isHeartbeat ? { isRunning: true } : {}),
      ...(textDelta ? { contentPreview: accumulatedText } : {}),
      ...(eventStatus && !isStatusEvent
        ? { status: eventStatus.label, ...(!isHeartbeat ? { step: eventStatus.label } : {}) }
        : {}),
      ...(isStatusEvent && typeof statusMsg === 'string' ? { status: statusMsg, step: statusMsg } : {}),
    })
  }

  return accumulatedText
}

function handleLifecycleEvent(
  sessionId: string,
  type: string,
  event: ReturnType<typeof parseSSEEvent>,
  chat: ReturnType<typeof useDashboardChat>,
): void {
  if (type === 'session.updated') {
    const info = (event as { properties?: { info?: { title?: string } } }).properties?.info
    if (info?.title) {
      sessionStatusStore.update(sessionId, { title: info.title })
      chat.setLocalSessions((prev) =>
        prev.map((s) => (s.id === sessionId ? { ...s, title: info.title } : s)),
      )
      postSessionSync({ type: 'sessions-invalidate' })
    }
  } else if (type === 'done' || type === 'session.idle') {
    sessionStatusStore.update(sessionId, { isRunning: false, status: 'Done' })
  } else if (type === 'session.error' || type === 'error') {
    sessionStatusStore.update(sessionId, { isRunning: false, status: 'Error' })
  }
}

function processBackgroundSSEEvent(
  sessionId: string,
  rawData: Record<string, unknown>,
  accumulatedText: string,
  chat: ReturnType<typeof useDashboardChat>,
  processStreamEventForSession?: (sessionId: string, event: { type: string; [k: string]: unknown }) => void,
): string {
  const eventType: string = typeof rawData.type === 'string' ? rawData.type : 'unknown'
  if (isAgentHarnessEvent(eventType, rawData) && !isStreamingTextDelta(eventType, rawData)) {
    eventsStore.addEvent(sessionId, {
      id: crypto.randomUUID(),
      type: eventType,
      timestamp: Date.now(),
      payload: rawData,
    })
  }

  const event = parseSSEEvent(rawData)
  if (!event) return accumulatedText

  const type = (event as { type: string }).type

  if (chat.activeSessionIdRef?.current === sessionId && processStreamEventForSession) {
    const stored = sessionStatusStore.get(sessionId)
    const streamingRefs = getStreamingRefs(sessionId)
    if (stored?.contentPreview && !streamingRefs.assistantTextRef.current) {
      streamingRefs.assistantTextRef.current = stored.contentPreview
    }
    processStreamEventForSession(sessionId, event as { type: string; [k: string]: unknown })
  }

  const nextText = applySessionStatusUpdate(sessionId, event, accumulatedText)
  handleLifecycleEvent(sessionId, type, event, chat)
  return nextText
}

export async function runBackgroundSessionStream(
  sessionId: string,
  content: string,
  sessionMode: string,
  modelId: string | undefined,
  chat: ReturnType<typeof useDashboardChat>,
  processStreamEventForSession?: (sessionId: string, event: { type: string; [k: string]: unknown }) => void,
): Promise<void> {
  sessionStatusStore.update(sessionId, { isRunning: true, status: 'Starting...', steps: [], contentPreview: '' })
  postSessionSync({ type: 'session-streaming', sessionId })
  let accumulatedText = ''
  try {
    const response = await sendChatMessage({
      sessionId,
      content,
      mode: sessionMode,
      model: modelId ?? DEFAULT_ACP_MODEL_ID,
    })
    if (!response.ok || !response.body) {
      sessionStatusStore.update(sessionId, { isRunning: false, status: 'Error' })
      return
    }

    await consumeSSEBody(response.body, (rawData) => {
      accumulatedText = processBackgroundSSEEvent(
        sessionId,
        rawData,
        accumulatedText,
        chat,
        processStreamEventForSession,
      )
    })

    if (chat.activeSessionIdRef?.current === sessionId && processStreamEventForSession) {
      processStreamEventForSession(sessionId, { type: '__stream_finalize__' })
    }
    const current = sessionStatusStore.get(sessionId)
    if (current?.isRunning) {
      sessionStatusStore.update(sessionId, { isRunning: false, status: 'Done' })
    }
    postSessionSync({ type: 'sessions-invalidate' })
  } catch (err) {
    console.error('Background SSE error:', err)
    sessionStatusStore.update(sessionId, { isRunning: false, status: 'Error' })
  }
}
