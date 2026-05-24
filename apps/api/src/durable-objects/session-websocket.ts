import type { ConnectionState } from './session-types'

/** WebSocket host surface for hibernation handlers. */
export interface SessionWebSocketHost {
  getWebSockets(): Iterable<WebSocket>
  broadcast(message: object): void
}

/** Accept a WebSocket upgrade using the Hibernation API. */
export function handleWebSocketUpgrade(host: SessionWebSocketHost & { acceptWebSocket(ws: WebSocket): void }, _request: Request): Response {
  const pair = new WebSocketPair()
  const [client, server] = Object.values(pair)

  host.acceptWebSocket(server)

  const state: ConnectionState = {
    connectedAt: Date.now(),
    lastSeen: Date.now(),
  }
  server.serializeAttachment(state)

  return new Response(null, { status: 101, webSocket: client })
}

/** Broadcast a JSON message to all connected WebSocket clients. */
export function broadcastToWebSockets(host: SessionWebSocketHost, message: object): void {
  const json = JSON.stringify(message)
  for (const ws of host.getWebSockets()) {
    try {
      ws.send(json)
    } catch {
      // Connection may be closing, ignore
    }
  }
}

/** WebSocket message handler (required for Hibernation API). */
export async function handleWebSocketMessage(
  host: SessionWebSocketHost,
  ws: WebSocket,
  message: string | ArrayBuffer,
): Promise<void> {
  const state = ws.deserializeAttachment() as ConnectionState
  state.lastSeen = Date.now()
  ws.serializeAttachment(state)

  try {
    const data = JSON.parse(message as string)
    host.broadcast({ type: 'echo', data })
  } catch {
    ws.send(JSON.stringify({ type: 'error', message: 'Invalid JSON' }))
  }
}

/**
 * WebSocket close handler (required for Hibernation API).
 * Codes 1005, 1006, 1015 are reserved and cannot be sent in close().
 */
export async function handleWebSocketClose(ws: WebSocket, code: number, reason: string): Promise<void> {
  const RESERVED_CODES = [1005, 1006, 1015]
  if (RESERVED_CODES.includes(code) || code < 1000 || code > 4999) {
    return
  }
  ws.close(code, reason)
}

/** WebSocket error handler (required for Hibernation API). */
export async function handleWebSocketError(ws: WebSocket, error: unknown): Promise<void> {
  console.error('WebSocket error:', error)
  ws.close(1011, 'Internal error')
}
