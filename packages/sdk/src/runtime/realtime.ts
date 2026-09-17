/** Browser helpers for canonical turn commands and realtime subscriptions. */

import {
  SessionStreamFrameSchema,
  ShellStreamFrameSchema,
  type CreateTurnRequest,
  type RealtimeTicketRequest,
  type SessionId,
  type SessionStreamFrame,
  type ShellStreamFrame,
  type TurnAcceptedResponse,
} from '@ship/contracts'

import { client } from '../generated/client.gen'
import {
  postRealtimeTickets,
  postSessionsBySessionIdTurns,
  postSessionsBySessionIdTurnsByTurnIdStop,
} from '../generated/sdk.gen'
import { unwrapSdkData } from './configure'

/** Shared options for shell and session WebSocket subscriptions. */
export interface RealtimeSubscriptionOptions<TFrame> {
  afterSequence?: number
  onFrame: (frame: TFrame) => void
  onProtocolError?: (error: Error) => void
}

/** Options for a session-detail subscription. */
export interface SessionSubscriptionOptions extends RealtimeSubscriptionOptions<SessionStreamFrame> {
  sessionId: string
  turnLimit?: number
}

/** Mint a scoped, one-use WebSocket ticket. */
export async function requestRealtimeTicket(request: RealtimeTicketRequest): Promise<{
  ticket: string
  expiresAt: number
}> {
  return unwrapSdkData(await postRealtimeTickets({ body: request }))
}

/** Build a WebSocket URL containing only a short-lived realtime ticket. */
export function buildRealtimeWsUrl(path: string, ticket: string): string {
  const baseUrl = client.getConfig().baseUrl ?? 'http://localhost:8787'
  const url = new URL(path, baseUrl.replace(/^http/, 'ws'))
  url.searchParams.set('ticket', ticket)
  return url.toString()
}

/** Open the authenticated user-shell subscription. */
export async function subscribeToShell(
  options: RealtimeSubscriptionOptions<ShellStreamFrame>,
): Promise<WebSocket> {
  const { ticket } = await requestRealtimeTicket({ scope: 'shell' })
  const socket = new WebSocket(buildRealtimeWsUrl('/sessions/stream', ticket))
  attachValidatedFrames(socket, ShellStreamFrameSchema, options)
  socket.addEventListener('open', () => {
    socket.send(JSON.stringify({
      type: 'shell.subscribe',
      requestCompletionMarker: true,
      ...(options.afterSequence === undefined ? {} : { afterSequence: options.afterSequence }),
    }))
  })
  return socket
}

/** Open a sequence-aware subscription for one session. */
export async function subscribeToSession(options: SessionSubscriptionOptions): Promise<WebSocket> {
  const { ticket } = await requestRealtimeTicket({
    scope: 'session',
    sessionId: options.sessionId as SessionId,
  })
  const socket = new WebSocket(
    buildRealtimeWsUrl(`/sessions/${encodeURIComponent(options.sessionId)}/stream`, ticket),
  )
  attachValidatedFrames(socket, SessionStreamFrameSchema, options)
  socket.addEventListener('open', () => {
    socket.send(JSON.stringify({
      type: 'session.subscribe',
      requestCompletionMarker: true,
      ...(options.afterSequence === undefined ? {} : { afterSequence: options.afterSequence }),
      ...(options.turnLimit === undefined ? {} : { turnLimit: options.turnLimit }),
    }))
  })
  return socket
}

/** Durably accept an idempotent turn command. */
export async function createSessionTurn(
  sessionId: string,
  command: CreateTurnRequest,
): Promise<TurnAcceptedResponse> {
  return unwrapSdkData(await postSessionsBySessionIdTurns({ path: { sessionId }, body: command }))
}

/** Request cooperative cancellation of a running turn. */
export async function stopSessionTurn(sessionId: string, turnId: string): Promise<void> {
  unwrapSdkData(await postSessionsBySessionIdTurnsByTurnIdStop({ path: { sessionId, turnId } }))
}

function attachValidatedFrames<TFrame>(
  socket: WebSocket,
  schema: { safeParse: (value: unknown) => { success: true; data: TFrame } | { success: false } },
  options: RealtimeSubscriptionOptions<TFrame>,
): void {
  socket.addEventListener('message', (message) => {
    try {
      const parsed = schema.safeParse(JSON.parse(String(message.data)))
      if (!parsed.success) throw new Error('Realtime frame failed validation')
      options.onFrame(parsed.data)
    } catch (error) {
      options.onProtocolError?.(error instanceof Error ? error : new Error(String(error)))
    }
  })
}
