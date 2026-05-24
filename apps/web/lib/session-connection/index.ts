import type { Dispatch, SetStateAction } from 'react'
import type { SessionSummary } from '@ship/contracts'

import type { UIMessage } from '@/lib/ai-elements-adapter'
import {
  createReconnectingWebSocket,
  type ReconnectingWebSocket,
  type WebSocketStatus,
} from '@/lib/websocket'

import { consumeSSEBody, type SSELifecycleCallbacks } from './consume-sse-body'
import { routeWebSocketEvent } from './route-ws-event'
import { buildSessionWebSocketUrl } from './build-ws-url'

export type { SSELifecycleCallbacks } from './consume-sse-body'

export interface SessionConnectionOptions {
  sessionId: string
  onSummary?: (summary: SessionSummary) => void
  onMessage?: (data: unknown) => void
  onStatusChange?: (status: WebSocketStatus) => void
  setMessages?: Dispatch<SetStateAction<UIMessage[]>>
  streamingMessageRef?: React.MutableRefObject<string | null>
  setAgentUrl?: (url: string) => void
  setAgentSessionId?: (id: string) => void
  setSandboxStatus?: (status: string) => void
  onAgentEvent?: (sessionId: string, event: { type: string; [k: string]: unknown }) => void
  sseLifecycle?: SSELifecycleCallbacks
}

export interface SessionConnection {
  disconnect: () => void
  getStatus: () => WebSocketStatus
  send: ReconnectingWebSocket['send']
  consumeSSE: (body: ReadableStream<Uint8Array>, onEvent: (data: Record<string, unknown>) => void) => Promise<void>
}

/**
 * Unified session connection: reconnecting WebSocket plus SSE lifecycle helpers.
 *
 * @param options - Session id and event callbacks
 */
export function createSessionConnection(options: SessionConnectionOptions): SessionConnection {
  const ws = createReconnectingWebSocket({
    url: buildSessionWebSocketUrl(options.sessionId),
    onStatusChange: options.onStatusChange,
    onMessage: (data) => {
      if (options.setMessages) {
        routeWebSocketEvent(options.sessionId, data, {
          setMessages: options.setMessages,
          streamingMessageRef: options.streamingMessageRef ?? { current: null },
          setAgentUrl: options.setAgentUrl ?? (() => {}),
          setAgentSessionId: options.setAgentSessionId ?? (() => {}),
          setSandboxStatus: options.setSandboxStatus ?? (() => {}),
          onSummary: options.onSummary,
          onAgentEvent: options.onAgentEvent,
        })
        return
      }

      options.onMessage?.(data)
    },
  })

  return {
    disconnect: () => ws.disconnect(),
    getStatus: () => ws.getStatus(),
    send: (payload) => ws.send(payload),
    consumeSSE: (body, onEvent) => consumeSSEBody(body, onEvent, options.sseLifecycle),
  }
}

export { consumeSSEBody } from './consume-sse-body'
export { routeWebSocketEvent } from './route-ws-event'
export { buildSessionWebSocketUrl } from './build-ws-url'
export type { RouteWebSocketEventHandlers } from './route-ws-event'
