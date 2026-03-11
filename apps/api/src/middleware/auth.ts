import { createMiddleware } from 'hono/factory'
import { jwtVerify } from 'jose'
import type { Env } from '../env.d'

export const authMiddleware = createMiddleware<{ Bindings: Env; Variables: { userId?: string } }>(async (c, next) => {
  // Extract token from Authorization header or query param (WebSocket fallback)
  const authHeader = c.req.header('Authorization')
  const queryToken = c.req.query('token')
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : queryToken

  if (!token) {
    return c.json({ error: 'Missing authorization' }, 401)
  }

  // Server-to-server bypass with API_SECRET
  if (token === c.env.API_SECRET) {
    await next()
    return
  }

  // Verify session JWT (same JWT from the session cookie, signed with SESSION_SECRET)
  try {
    const secret = new TextEncoder().encode(c.env.SESSION_SECRET)
    const { payload } = await jwtVerify(token, secret, { algorithms: ['HS256'] })
    c.set('userId', payload.userId as string)
    await next()
  } catch {
    return c.json({ error: 'Invalid token' }, 401)
  }
})
