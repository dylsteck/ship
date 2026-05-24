import { parseSSEEvent } from '@/lib/sse-parser'
import { consumeSSEBody } from '@/lib/session-connection'
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
  await consumeSSEBody(body, (rawData) => {
    onEvent?.()

    const eventType = (rawData.type as string) ?? 'unknown'
    if (isAgentHarnessEvent(eventType, rawData) && !isStreamingTextDelta(eventType, rawData)) {
      eventsStore.addEvent(targetSessionId, {
        id: crypto.randomUUID(),
        type: eventType,
        timestamp: Date.now(),
        payload: rawData,
      })
    }

    const event = parseSSEEvent(rawData)
    if (!event) return
    if (!claimStreamEvent(targetSessionId, event as { type: string; [k: string]: unknown })) return

    dispatchParsedSSEEvent(event as { type: string; [k: string]: unknown }, {
      ctx,
      targetSessionId,
      ...dispatchOptions,
    })
    dispatchRawDataFallbacks(rawData, ctx)
  })
}
