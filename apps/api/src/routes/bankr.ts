import { Hono } from 'hono'
import type { Env } from '../env.d'
import { bankrChatCompletion, bankrMessages, isUserBankrEnabled } from '../lib/bankr'
import { requireJwtUserId } from '../lib/session-authorization'
import { bankrChatBodySchema, bankrMessagesBodySchema, parseJsonBody } from '../lib/api-schemas'

const bankr = new Hono<{ Bindings: Env; Variables: { userId?: string; authKind?: 'user' | 'service' } }>()

/**
 * `POST /bankr/chat` — proxy to Bankr OpenAI-compatible chat completions.
 *
 * @remarks
 * Requires a session JWT and the caller's `use_bankr` preference. Uses the deployment `BANKR_API_KEY`.
 */
bankr.post('/chat', async (c) => {
  const apiKey = c.env.BANKR_API_KEY
  if (!apiKey) {
    return c.json({ error: 'BANKR_API_KEY not configured' }, 500)
  }

  const userIdOrRes = requireJwtUserId(c)
  if (typeof userIdOrRes !== 'string') {
    return userIdOrRes
  }
  if (!(await isUserBankrEnabled(c.env.DB, userIdOrRes))) {
    return c.json({ error: 'Bankr is not enabled for this account' }, 403)
  }

  const body = await parseJsonBody(c, bankrChatBodySchema)
  if (body instanceof Response) {
    return body
  }

  const res = await bankrChatCompletion({ apiKey, ...body })

  if (res.status === 402) {
    return c.json({ error: 'Bankr credits depleted. Add credits at bankr.bot/llm or switch providers.' }, 402)
  }

  if (body.stream) {
    return new Response(res.body, {
      status: res.status,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    })
  }

  const data = await res.json()
  return c.json(data, res.ok ? 200 : (res.status as 400))
})

/**
 * `POST /bankr/messages` — proxy to Bankr Anthropic-compatible messages.
 *
 * @remarks
 * Same auth and preference rules as `POST /bankr/chat`.
 */
bankr.post('/messages', async (c) => {
  const apiKey = c.env.BANKR_API_KEY
  if (!apiKey) {
    return c.json({ error: 'BANKR_API_KEY not configured' }, 500)
  }

  const userIdOrRes = requireJwtUserId(c)
  if (typeof userIdOrRes !== 'string') {
    return userIdOrRes
  }
  if (!(await isUserBankrEnabled(c.env.DB, userIdOrRes))) {
    return c.json({ error: 'Bankr is not enabled for this account' }, 403)
  }

  const body = await parseJsonBody(c, bankrMessagesBodySchema)
  if (body instanceof Response) {
    return body
  }

  const res = await bankrMessages({ apiKey, ...body })

  if (res.status === 402) {
    return c.json({ error: 'Bankr credits depleted. Add credits at bankr.bot/llm or switch providers.' }, 402)
  }

  if (body.stream) {
    return new Response(res.body, {
      status: res.status,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    })
  }

  const data = await res.json()
  return c.json(data, res.ok ? 200 : (res.status as 400))
})

export default bankr
