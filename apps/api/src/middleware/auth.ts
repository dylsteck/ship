import { createMiddleware } from 'hono/factory'
import { jwtVerify } from 'jose'
import type { Env } from '../env.d'

/**
 * Authenticates API requests:
 *
 * - `Authorization: Bearer <session JWT>` — HS256 with `SESSION_SECRET`; sets `authKind: 'user'` and `userId`.
 * - `Authorization: Bearer <API_SECRET>` — server-only bootstrap (`POST /users/upsert`, `POST /accounts/github`); sets `authKind: 'service'`.
 * - `?token=<jwt>` — same as Bearer (WebSocket clients that cannot set headers).
 */
export const authMiddleware = createMiddleware<{
  Bindings: Env
  Variables: { userId?: string; authKind?: 'user' | 'service' }
}>(async (c, next) => {
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
