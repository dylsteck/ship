import { sendChatMessage } from '@/lib/api/chat-client'
import { parseSSEEvent, getEventStatus, extractTextDelta } from '@/lib/sse-parser'
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

function processBackgroundSSELine(
  sessionId: string,
  line: string,
  currentEventType: string,
  accumulatedText: string,
  chat: ReturnType<typeof useDashboardChat>,
  processStreamEventForSession?: (sessionId: string, event: { type: string; [k: string]: unknown }) => void,
): { accumulatedText: string; currentEventType: string } {
  if (line.startsWith('event: ')) {
    return { accumulatedText, currentEventType: line.slice(7).trim() }
  }
  if (!line.startsWith('data: ')) {
    return { accumulatedText, currentEventType }
  }

  try {
    const rawData = JSON.parse(line.slice(6)) as Record<string, unknown>
    if (!rawData.type && currentEventType) rawData.type = currentEventType
    if (!rawData.type && typeof rawData.error === 'string') rawData.type = 'error'

    const eventType: string = typeof rawData.type === 'string' ? rawData.type : currentEventType || 'unknown'
    if (isAgentHarnessEvent(eventType, rawData) && !isStreamingTextDelta(eventType, rawData)) {
      eventsStore.addEvent(sessionId, {
        id: crypto.randomUUID(),
        type: eventType,
        timestamp: Date.now(),
        payload: rawData,
      })
    }

    const event = parseSSEEvent(rawData)
    if (!event) return { accumulatedText, currentEventType }

    const type = (event as { type: string }).type

    if (chat.activeSessionIdRef?.current === sessionId && processStreamEventForSession) {
      const stored = sessionStatusStore.get(sessionId)
      if (stored?.contentPreview && !chat.assistantTextRef?.current) {
        chat.assistantTextRef.current = stored.contentPreview
      }
      processStreamEventForSession(sessionId, event as { type: string; [k: string]: unknown })
    }

    const nextText = applySessionStatusUpdate(sessionId, event, accumulatedText)
    handleLifecycleEvent(sessionId, type, event, chat)
    return { accumulatedText: nextText, currentEventType }
  } catch {
    return { accumulatedText, currentEventType }
  }
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
    const response = await sendChatMessage(sessionId, content, sessionMode, modelId ?? DEFAULT_ACP_MODEL_ID)
    if (!response.ok || !response.body) {
      sessionStatusStore.update(sessionId, { isRunning: false, status: 'Error' })
      return
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
        const result = processBackgroundSSELine(
          sessionId,
          line,
          currentEventType,
          accumulatedText,
          chat,
          processStreamEventForSession,
        )
        accumulatedText = result.accumulatedText
        currentEventType = result.currentEventType
      }
    }

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
