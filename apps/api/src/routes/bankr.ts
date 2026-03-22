import { Hono } from 'hono'
import type { Env } from '../env.d'
import { bankrChatCompletion, bankrMessages } from '../lib/bankr'

const bankr = new Hono<{ Bindings: Env }>()

/**
 * POST /bankr/chat
 * Proxy to Bankr OpenAI-compatible chat completions.
 * Body: { model, messages, stream?, max_tokens? }
 */
bankr.post('/chat', async (c) => {
  const apiKey = c.env.BANKR_API_KEY
  if (!apiKey) {
    return c.json({ error: 'BANKR_API_KEY not configured' }, 500)
  }

  const body = await c.req.json<{
    model: string
    messages: Array<{ role: string; content: string }>
    stream?: boolean
    max_tokens?: number
  }>()

  if (!body.model || !body.messages) {
    return c.json({ error: 'model and messages are required' }, 400)
  }

  const res = await bankrChatCompletion({ apiKey, ...body })

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
 * POST /bankr/messages
 * Proxy to Bankr Anthropic-compatible messages.
 * Body: { model, messages, system?, stream?, max_tokens? }
 */
bankr.post('/messages', async (c) => {
  const apiKey = c.env.BANKR_API_KEY
  if (!apiKey) {
    return c.json({ error: 'BANKR_API_KEY not configured' }, 500)
  }

  const body = await c.req.json<{
    model: string
    messages: Array<{ role: string; content: string }>
    system?: string
    stream?: boolean
    max_tokens?: number
  }>()

  if (!body.model || !body.messages) {
    return c.json({ error: 'model and messages are required' }, 400)
  }

  const res = await bankrMessages({ apiKey, ...body })

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
