import type { Context } from 'hono'
import type { Env } from '../env.d'

/**
 * Hono context after `authMiddleware` runs (see `apps/api/src/middleware/auth.ts`).
 *
 * - `authKind: 'user'` — verified session JWT; `userId` is the subject.
 * - `authKind: 'service'` — `API_SECRET` bearer (OAuth bootstrap only); no `userId`.
 */
export type AuthedEnv = { Bindings: Env; Variables: { userId?: string; authKind?: 'user' | 'service' } }

/** {@link AuthedEnv} as a Hono `Context`. */
export type AuthedContext = Context<AuthedEnv>

/**
 * Requires a **user** session JWT (not `API_SECRET`). Returns the authenticated `userId`,
 * or a JSON error `Response` to return from the route.
 *
 * @param c - Request context after `authMiddleware`
 * @returns The user's id, or a 401/403 `Response`
 */
export function requireJwtUserId(c: AuthedContext): string | Response {
  if (c.get('authKind') === 'service') {
    return c.json(
      {
        error:
          'This endpoint requires a user session token. Server-side callers should forward the user session JWT from the session cookie instead of API_SECRET.',
      },
      403,
    )
  }
  const userId = c.get('userId') as string | undefined
  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  return userId
}

/**
 * Ensures `chat_sessions.id = sessionId` belongs to the JWT user.
 *
 * @param c - Request context
 * @param sessionId - Chat session id (UUID)
 * @returns `{ ok: true, userId }` or `{ ok: false, response }` with 404/403/401 JSON
 */
export async function requireSessionOwner(
  c: AuthedContext,
  sessionId: string,
): Promise<{ ok: true; userId: string } | { ok: false; response: Response }> {
  const userIdOrRes = requireJwtUserId(c)
  if (typeof userIdOrRes !== 'string') {
    return { ok: false, response: userIdOrRes }
  }

  const row = await c.env.DB.prepare('SELECT user_id FROM chat_sessions WHERE id = ?')
    .bind(sessionId)
    .first<{ user_id: string }>()

  if (!row) {
    return { ok: false, response: c.json({ error: 'Session not found' }, 404) }
  }
  if (row.user_id !== userIdOrRes) {
    return { ok: false, response: c.json({ error: 'Forbidden' }, 403) }
  }

  return { ok: true, userId: userIdOrRes }
}
