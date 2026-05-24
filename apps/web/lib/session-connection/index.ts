import type { Dispatch, SetStateAction } from 'react'
import type { SessionSummary } from '@ship/contracts'

import { parseSSELines } from '@/components/chat/stream-processor'
import { handleWebSocketEvent } from '@/components/chat/chat-stream-helpers'
import { API_URL } from '@/lib/config'
import type { UIMessage } from '@/lib/ai-elements-adapter'
import {
  createReconnectingWebSocket,
  type ReconnectingWebSocket,
  type WebSocketStatus,
} from '@/lib/websocket'

/** SSE lifecycle hooks mirroring t3code request start/chunk/exit semantics. */
export interface SSELifecycleCallbacks {
  onRequestStart?: () => void
  onRequestChunk?: (data: Record<string, unknown>) => void
  onRequestExit?: (reason: 'done' | 'error' | 'abort') => void
}

export interface SessionConnectionOptions {
  sessionId: string
  onSummary?: (summary: SessionSummary) => void
  onMessage?: (data: unknown) => void
  onStatusChange?: (status: WebSocketStatus) => void
  setMessages?: Dispatch<SetStateAction<UIMessage[]>>
  onAgentStatusChange?: Parameters<typeof handleWebSocketEvent>[2]
  sseLifecycle?: SSELifecycleCallbacks
}

export interface SessionConnection {
  disconnect: () => void
  getStatus: () => WebSocketStatus
  send: ReconnectingWebSocket['send']
  consumeSSE: (body: ReadableStream<Uint8Array>, onEvent: (data: Record<string, unknown>) => void) => Promise<void>
}

function extractSessionSummary(event: Record<string, unknown>): SessionSummary | null {
  if (event.type === 'session.summary.updated') {
    const properties = event.properties as { summary?: SessionSummary } | undefined
    return properties?.summary ?? null
  }

  if (event.type === 'opencode-event') {
    const nested = event.event as Record<string, unknown> | undefined
    if (nested?.type === 'session.summary.updated') {
      const properties = nested.properties as { summary?: SessionSummary } | undefined
      return properties?.summary ?? null
    }
  }

  return null
}

function routeWebSocketEvent(options: SessionConnectionOptions, data: unknown): void {
  const event = data as Record<string, unknown>
  const summary = extractSessionSummary(event)
  if (summary) {
    options.onSummary?.(summary)
    return
  }

  if (options.setMessages) {
    handleWebSocketEvent(
      event as Parameters<typeof handleWebSocketEvent>[0],
      options.setMessages,
      options.onAgentStatusChange,
      options.onSummary,
    )
    return
  }

  options.onMessage?.(data)
}

/**
 * Unified session connection: reconnecting WebSocket plus SSE lifecycle helpers.
 *
 * @param options - Session id and event callbacks
 */
export function createSessionConnection(options: SessionConnectionOptions): SessionConnection {
  const wsUrl = `${API_URL.replace('http', 'ws')}/sessions/${encodeURIComponent(options.sessionId)}/websocket`

  const ws = createReconnectingWebSocket({
    url: wsUrl,
    onStatusChange: options.onStatusChange,
    onMessage: (data) => routeWebSocketEvent(options, data),
  })

  async function consumeSSE(
    body: ReadableStream<Uint8Array>,
    onEvent: (data: Record<string, unknown>) => void,
  ): Promise<void> {
    const lifecycle = options.sseLifecycle
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

  return {
    disconnect: () => ws.disconnect(),
    getStatus: () => ws.getStatus(),
    send: (payload) => ws.send(payload),
    consumeSSE,
  }
}
