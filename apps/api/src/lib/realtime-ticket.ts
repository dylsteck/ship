/**
 * Short-lived, scoped, one-use realtime websocket tickets.
 *
 * @packageDocumentation
 */

import { SignJWT, jwtVerify } from 'jose'
import type { RealtimeTicketRequest } from '@ship/contracts'

import type { Env } from '../env.d'

const AUDIENCE = 'ship-realtime'
const TICKET_LIFETIME_SECONDS = 60

/** Claims retained after a ticket is cryptographically verified. */
export interface RealtimeTicketClaims {
  userId: string
  scope: 'shell' | 'session'
  sessionId?: string
  ticketId: string
  expiresAt: number
}

/** Mint a scoped websocket ticket with a maximum lifetime of sixty seconds. */
export async function mintRealtimeTicket(
  env: Env,
  userId: string,
  request: RealtimeTicketRequest,
): Promise<{ ticket: string; expiresAt: number }> {
  const now = Math.floor(Date.now() / 1000)
  const expiresAtSeconds = now + TICKET_LIFETIME_SECONDS
  const ticketId = crypto.randomUUID()
  const ticket = await new SignJWT({
    scope: request.scope,
    ...(request.scope === 'session' ? { sessionId: request.sessionId } : {}),
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setAudience(AUDIENCE)
    .setJti(ticketId)
    .setIssuedAt(now)
    .setExpirationTime(expiresAtSeconds)
    .sign(new TextEncoder().encode(env.SESSION_SECRET))
  return { ticket, expiresAt: expiresAtSeconds * 1000 }
}

/** Verify ticket claims and consume its JTI atomically in the user's shell DO. */
export async function verifyAndConsumeRealtimeTicket(env: Env, ticket: string): Promise<RealtimeTicketClaims> {
  const { payload } = await jwtVerify(ticket, new TextEncoder().encode(env.SESSION_SECRET), {
    algorithms: ['HS256'],
    audience: AUDIENCE,
  })
  const userId = payload.sub
  const scope = payload.scope
  const ticketId = payload.jti
  const expiresAt = (payload.exp ?? 0) * 1000
  const sessionId = payload.sessionId
  if (!userId || !ticketId || (scope !== 'shell' && scope !== 'session') || !expiresAt) {
    throw new Error('Invalid realtime ticket claims')
  }
  if (scope === 'session' && typeof sessionId !== 'string') throw new Error('Missing session scope')

  const shell = env.USER_SHELL_DO.getByName(userId)
  await shell.initialize(userId)
  if (!(await shell.consumeTicket(ticketId, expiresAt))) throw new Error('Realtime ticket already used')

  return {
    userId,
    scope,
    ticketId,
    expiresAt,
    ...(typeof sessionId === 'string' ? { sessionId } : {}),
  }
}
