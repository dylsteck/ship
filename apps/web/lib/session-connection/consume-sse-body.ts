import { parseSSELines } from '@/components/chat/stream-processor'

/** SSE lifecycle hooks mirroring t3code request start/chunk/exit semantics. */
export interface SSELifecycleCallbacks {
  onRequestStart?: () => void
  onRequestChunk?: (data: Record<string, unknown>) => void
  onRequestExit?: (reason: 'done' | 'error' | 'abort') => void
}

/**
 * Read an SSE response body and invoke {@link onEvent} for each parsed data object.
 *
 * @param body - Fetch `response.body` stream
 * @param onEvent - Called with parsed JSON payload (type may be inferred from `event:` lines)
 * @param lifecycle - Optional start/chunk/exit hooks
 */
export async function consumeSSEBody(
  body: ReadableStream<Uint8Array>,
  onEvent: (data: Record<string, unknown>) => void,
  lifecycle?: SSELifecycleCallbacks,
): Promise<void> {
  lifecycle?.onRequestStart?.()

  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      buffer = parseSSELines(buffer, (data) => {
        lifecycle?.onRequestChunk?.(data)
        onEvent(data)
      })
    }
    lifecycle?.onRequestExit?.('done')
  } catch (error) {
    lifecycle?.onRequestExit?.('error')
    throw error
  }
}
