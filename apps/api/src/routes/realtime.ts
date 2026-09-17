/** Realtime ticket minting routes. */

import { Hono } from 'hono'
import { RealtimeTicketRequestSchema } from '@ship/contracts'

import { parseJsonBody } from '../lib/api-schemas'
import { mintRealtimeTicket } from '../lib/realtime-ticket'
import { requireJwtUserId, type AuthedEnv } from '../lib/session-authorization'

const realtime = new Hono<AuthedEnv>()

/** Mint a short-lived ticket after rechecking any requested session ownership. */
realtime.post('/tickets', async (c) => {
  const userId = requireJwtUserId(c)
  if (typeof userId !== 'string') return userId
  const request = await parseJsonBody(c, RealtimeTicketRequestSchema)
  if (request instanceof Response) return request
  if (request.scope === 'session') {
    const row = await c.env.DB.prepare('SELECT user_id FROM chat_sessions WHERE id = ? AND status != ?')
      .bind(request.sessionId, 'deleted')
      .first<{ user_id: string }>()
    if (!row) return c.json({ error: 'Session not found' }, 404)
    if (row.user_id !== userId) return c.json({ error: 'Forbidden' }, 403)
  }
  return c.json(await mintRealtimeTicket(c.env, userId, request as Parameters<typeof mintRealtimeTicket>[2]))
})

export default realtime
