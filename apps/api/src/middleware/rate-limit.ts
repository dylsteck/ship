import { createMiddleware } from 'hono/factory'
import type { Env } from '../env.d'

interface RateLimitEntry {
  count: number
  resetAt: number
}

const store = new Map<string, RateLimitEntry>()

interface RateLimitConfig {
  windowMs: number
  max: number
}

export function createRateLimiter(config: RateLimitConfig) {
  return createMiddleware<{ Bindings: Env; Variables: { userId?: string } }>(async (c, next) => {
    const ip = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || 'unknown'
    const userId = c.get('userId') as string | undefined
    const key = userId ? `user:${userId}` : `ip:${ip}`
    const now = Date.now()

    let entry = store.get(key)
    if (!entry || now >= entry.resetAt) {
      entry = { count: 0, resetAt: now + config.windowMs }
      store.set(key, entry)
    }

    entry.count++

    const remaining = Math.max(0, config.max - entry.count)
    c.header('X-RateLimit-Limit', String(config.max))
    c.header('X-RateLimit-Remaining', String(remaining))
    c.header('X-RateLimit-Reset', String(Math.ceil(entry.resetAt / 1000)))

    if (entry.count > config.max) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000)
      c.header('Retry-After', String(retryAfter))
      return c.json({ error: 'Too many requests', retryAfter }, 429)
    }

    // Periodic cleanup of expired entries
    if (store.size > 10000) {
      for (const [k, v] of store) {
        if (now >= v.resetAt) store.delete(k)
      }
    }

    await next()
  })
}

export const chatRateLimit = createRateLimiter({ windowMs: 60_000, max: 20 })
export const sessionRateLimit = createRateLimiter({ windowMs: 60_000, max: 10 })
