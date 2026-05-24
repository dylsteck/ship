/**
 * Tiny helpers around the Hono SSE stream so call sites stay declarative.
 *
 * @packageDocumentation
 */

import { classifyErrorFromMessage, type ErrorCode } from '@ship/contracts'

/**
 * Minimal SSE writer surface — extracted so we can pass either Hono's stream
 * or a tee'd writer for tests.
 */
export interface SSEWriter {
  writeSSE(data: { event: string; data: string }): Promise<void>
}

/** Categories the existing Ship UI knows how to render. */
export type ErrorCategory = 'transient' | 'persistent' | 'user-action' | 'fatal'

/** Emit a `status` event the Ship frontend treats as a transient label. */
export async function writeStatus(stream: SSEWriter, status: string, message: string): Promise<void> {
  await stream.writeSSE({
    event: 'status',
    data: JSON.stringify({ type: 'status', status, message }),
  })
}

/** Emit an `error` event matching the existing frontend error contract. */
export async function writeError(
  stream: SSEWriter,
  payload: {
    error: string
    details?: string
    category?: ErrorCategory
    retryable?: boolean
    code?: ErrorCode
    action?: { label: string; href: string }
  },
): Promise<void> {
  const classified = classifyErrorFromMessage(payload.error)
  await stream.writeSSE({
    event: 'error',
    data: JSON.stringify({
      error: payload.error,
      ...(payload.details ? { details: payload.details } : {}),
      category: payload.category ?? classified.category,
      retryable: payload.retryable ?? classified.retryable,
      code: payload.code ?? classified.code,
      ...(payload.action ? { action: payload.action } : {}),
    }),
  })
}

/** Emit a `done` terminator event. */
export async function writeDone(stream: SSEWriter): Promise<void> {
  await stream.writeSSE({ event: 'done', data: JSON.stringify({ type: 'done' }) })
}

/** Emit a `session.idle` event so the UI exits its streaming state cleanly. */
export async function writeSessionIdle(stream: SSEWriter): Promise<void> {
  await stream.writeSSE({ event: 'session.idle', data: JSON.stringify({ type: 'session.idle' }) })
}
