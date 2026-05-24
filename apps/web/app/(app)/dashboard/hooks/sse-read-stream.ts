import { parseSSEEvent } from '@/lib/sse-parser'
import { isAgentHarnessEvent } from '@/lib/sse-types'
import { eventsStore } from './use-events-store'
import { dispatchParsedSSEEvent, dispatchRawDataFallbacks } from './sse-event-dispatch'
import { isStreamingTextDelta } from './sse-stream-utils'
import type { SSEHandlerContext } from './sse-event-handlers'
import type { DispatchSSEEventOptions } from './sse-event-dispatch'

export interface ReadChatStreamParams {
  body: ReadableStream<Uint8Array>
  targetSessionId: string
  ctx: SSEHandlerContext
  claimStreamEvent: (sessionId: string, event: { type: string; [k: string]: unknown }) => boolean
  dispatchOptions: Omit<DispatchSSEEventOptions, 'ctx' | 'targetSessionId'>
  onEvent?: () => void
}

/** Read an SSE response body and dispatch parsed events. */
export async function readChatSSEStream({
  body,
  targetSessionId,
  ctx,
  claimStreamEvent,
  dispatchOptions,
  onEvent,
}: ReadChatStreamParams): Promise<void> {
  const reader = body.getReader()
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
      if (!line.startsWith('data: ')) continue
      try {
        onEvent?.()
        const rawData = JSON.parse(line.slice(6)) as Record<string, unknown>
        if (!rawData.type && currentEventType) rawData.type = currentEventType
        if (!rawData.type && typeof rawData.error === 'string') rawData.type = 'error'

        const eventType = (rawData.type as string) ?? (currentEventType || 'unknown')
        if (isAgentHarnessEvent(eventType, rawData) && !isStreamingTextDelta(eventType, rawData)) {
          eventsStore.addEvent(targetSessionId, {
            id: crypto.randomUUID(),
            type: eventType,
            timestamp: Date.now(),
            payload: rawData,
          })
        }

        const event = parseSSEEvent(rawData)
        if (!event) continue
        if (!claimStreamEvent(targetSessionId, event as { type: string; [k: string]: unknown })) continue

        dispatchParsedSSEEvent(event as { type: string; [k: string]: unknown }, {
          ctx,
          targetSessionId,
          ...dispatchOptions,
        })
        dispatchRawDataFallbacks(rawData, ctx)
      } catch {
        // Ignore parse errors
      }
    }
  }
}
