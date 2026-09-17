/** Hibernating producer and consumer websocket handlers for SessionDO. */

import {
  SessionProducerBatchSchema,
  SessionSubscribeCommandSchema,
  type SessionProducerAck,
  type SessionStreamFrame,
} from '@ship/contracts'

import type { ConnectionState } from './session-types'

/** WebSocket host surface implemented by SessionDO. */
export interface SessionWebSocketHost {
  acceptWebSocket(ws: WebSocket, tags?: string[]): void
  getWebSockets(tag?: string): WebSocket[]
  getProducerSecret(): string
  getSessionEventHead(): number
  isProducerAttempt(turnId: string, attemptId: string): boolean
  synchronizeConsumer(ws: WebSocket, command: ReturnType<typeof SessionSubscribeCommandSchema.parse>): void
  ingestProducerBatch(batch: ReturnType<typeof SessionProducerBatchSchema.parse>): SessionProducerAck['records']
  broadcast(message: object): void
}

interface LegacyBroadcastHost {
  getWebSockets(tag?: string): Iterable<WebSocket>
}

/** Accept a consumer or authenticated internal producer websocket. */
export async function handleWebSocketUpgrade(host: SessionWebSocketHost, request: Request): Promise<Response> {
  const url = new URL(request.url)
  const isProducer = url.pathname === '/internal/producer'
  const isV2Consumer = url.pathname.endsWith('/stream')
  if (isProducer && !(await validProducerSecret(request.headers.get('X-Ship-Producer-Secret'), host.getProducerSecret()))) {
    return new Response('Not found', { status: 404 })
  }
  const pair = new WebSocketPair()
  const [client, server] = Object.values(pair)
  if (isProducer) {
    const turnId = url.searchParams.get('turnId') || ''
    const attemptId = url.searchParams.get('attemptId') || ''
    if (!turnId || !attemptId || !host.isProducerAttempt(turnId, attemptId)) return new Response('Not found', { status: 404 })
    host.acceptWebSocket(server, ['producer'])
    server.serializeAttachment({
      role: 'producer',
      protocolVersion: 2,
      phase: 'live',
      lastSentSequence: 0,
      turnId,
      attemptId,
    } satisfies ConnectionState)
  } else {
    host.acceptWebSocket(server, [isV2Consumer ? 'consumer' : 'legacy'])
    server.serializeAttachment({
      role: 'consumer',
      protocolVersion: isV2Consumer ? 2 : 1,
      phase: isV2Consumer ? 'awaiting-subscribe' : 'live',
      lastSentSequence: isV2Consumer ? 0 : host.getSessionEventHead(),
    } satisfies ConnectionState)
  }
  return new Response(null, { status: 101, webSocket: client })
}

/** Broadcast a legacy JSON message without mixing it into the canonical event log. */
export function broadcastToWebSockets(host: LegacyBroadcastHost, message: object): void {
  const json = JSON.stringify(message)
  for (const ws of host.getWebSockets('legacy')) {
    try {
      ws.send(json)
    } catch {
      // The close event will clean up a failed connection.
    }
  }
}

/** Route producer batches and consumer subscribe/ping commands by attachment role. */
export async function handleWebSocketMessage(
  host: SessionWebSocketHost,
  ws: WebSocket,
  message: string | ArrayBuffer,
): Promise<void> {
  const state = ws.deserializeAttachment() as ConnectionState | null
  if (!state || typeof message !== 'string') return sendProtocolError(ws, state?.role ?? 'consumer', 'invalid_frame')
  let value: unknown
  try {
    value = JSON.parse(message)
  } catch {
    return sendProtocolError(ws, state.role, 'invalid_json')
  }
  if (typeof value === 'object' && value && (value as { type?: string }).type === 'ping') {
    ws.send(JSON.stringify({ type: 'pong', occurredAt: Date.now() } satisfies SessionStreamFrame))
    return
  }
  if (state.role === 'producer') {
    const parsed = SessionProducerBatchSchema.safeParse(value)
    if (!parsed.success) return sendProtocolError(ws, 'producer', 'invalid_producer_batch')
    if (parsed.data.records.some((record) => record.turnId !== state.turnId)) {
      return sendProtocolError(ws, 'producer', 'producer_turn_mismatch')
    }
    const records = host.ingestProducerBatch(parsed.data)
    ws.send(JSON.stringify({ type: 'producer.ack', batchId: parsed.data.batchId, records } satisfies SessionProducerAck))
    return
  }
  if (state.protocolVersion === 1) {
    host.broadcast({ type: 'echo', data: value })
    return
  }
  const parsed = SessionSubscribeCommandSchema.safeParse(value)
  if (!parsed.success) return sendProtocolError(ws, 'consumer', 'invalid_subscribe')
  host.synchronizeConsumer(ws, parsed.data)
}

/** Close a websocket only when the peer supplied a sendable close code. */
export async function handleWebSocketClose(ws: WebSocket, code: number, reason: string): Promise<void> {
  if (code >= 1000 && code <= 4999 && ![1005, 1006, 1015].includes(code)) ws.close(code, reason)
}

/** Close failed sockets without serializing sensitive error data. */
export async function handleWebSocketError(ws: WebSocket): Promise<void> {
  ws.close(1011, 'Realtime connection failed')
}

function sendProtocolError(ws: WebSocket, role: ConnectionState['role'], code: string): void {
  if (role === 'producer') {
    ws.send(JSON.stringify({ type: 'producer.error', code, retryable: false }))
    return
  }
  ws.send(JSON.stringify({ type: 'session.error', code, retryable: false } satisfies SessionStreamFrame))
}

async function validProducerSecret(provided: string | null, expected: string): Promise<boolean> {
  if (!provided) return false
  const encoder = new TextEncoder()
  const [providedHash, expectedHash] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(provided)),
    crypto.subtle.digest('SHA-256', encoder.encode(expected)),
  ])
  return crypto.subtle.timingSafeEqual(providedHash, expectedHash)
}
