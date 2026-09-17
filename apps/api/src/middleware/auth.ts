import { createMiddleware } from 'hono/factory'
import { jwtVerify } from 'jose'
import type { Env } from '../env.d'
import { verifyAndConsumeRealtimeTicket } from '../lib/realtime-ticket'

/**
 * Authenticates API requests:
 *
 * - `Authorization: Bearer <session JWT>` — HS256 with `SESSION_SECRET`; sets `authKind: 'user'` and `userId`.
 * - `Authorization: Bearer <API_SECRET>` — server-only bootstrap (`POST /users/upsert`, `POST /accounts/github`); sets `authKind: 'service'`.
 * - `?token=<jwt>` — same as Bearer (WebSocket clients that cannot set headers).
 */
export const authMiddleware = createMiddleware<{
  Bindings: Env
  Variables: {
    userId?: string
    authKind?: 'user' | 'service'
    realtimeScope?: 'shell' | 'session'
    realtimeSessionId?: string
  }
}>(async (c, next) => {
  const realtimeTicket = c.req.query('ticket')
  if (realtimeTicket) {
    try {
      const claims = await verifyAndConsumeRealtimeTicket(c.env, realtimeTicket)
      const path = new URL(c.req.url).pathname
      const sessionMatch = path.match(/^\/sessions\/([^/]+)\/stream$/)
      if (claims.scope === 'shell' && path !== '/sessions/stream') throw new Error('Ticket scope mismatch')
      if (claims.scope === 'session' && (!sessionMatch || sessionMatch[1] !== claims.sessionId)) {
        throw new Error('Ticket scope mismatch')
      }
      if (claims.scope === 'session') {
        const row = await c.env.DB.prepare('SELECT user_id FROM chat_sessions WHERE id = ? AND status != ?')
          .bind(claims.sessionId, 'deleted')
          .first<{ user_id: string }>()
        if (!row || row.user_id !== claims.userId) throw new Error('Session ownership changed')
      }
      c.set('authKind', 'user')
      c.set('userId', claims.userId)
      c.set('realtimeScope', claims.scope)
      if (claims.sessionId) c.set('realtimeSessionId', claims.sessionId)
      await next()
      return
    } catch {
      return c.json({ error: 'Invalid or expired realtime ticket' }, 401)
    }
  }

  // Extract token from Authorization header or query param (WebSocket fallback)
  const authHeader = c.req.header('Authorization')
  const queryToken = c.req.query('token')
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : queryToken

  if (!token) {
    return c.json({ error: 'Missing authorization' }, 401)
  }

  // Server-to-server bootstrap (OAuth callback only — never exposes user-scoped data by itself)
  if (token === c.env.API_SECRET) {
    c.set('authKind', 'service')
    await next()
    return
  }

  // Verify session JWT (same JWT from the session cookie, signed with SESSION_SECRET)
  try {
    const secret = new TextEncoder().encode(c.env.SESSION_SECRET)
    const { payload } = await jwtVerify(token, secret, { algorithms: ['HS256'] })
    c.set('authKind', 'user')
    c.set('userId', payload.userId as string)
    await next()
  } catch {
    return c.json({ error: 'Invalid token' }, 401)
  }
})
