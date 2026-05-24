/**
 * Auxiliary chat routes — read-only DO passthroughs and lightweight controls.
 *
 * The streaming agent now runs entirely in the Worker request handler, so
 * the legacy `subscribe` / `subagent` SSE proxies are no-ops; clients should
 * just `POST /chat/:sessionId` to start a turn and consume the SSE response.
 *
 * Question + permission endpoints are kept for future tool-approval support
 * but currently mark the agent paused/unpaused on the session.
 *
 * @packageDocumentation
 */

import type { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import type { AuthedEnv } from '../lib/session-authorization'
import { requireSessionOwner } from '../lib/session-authorization'
import { collectSessionGitState } from '../lib/session-git-state'

const DO_URL = 'https://do'

/**
 * Register every auxiliary chat route on the provided Hono router.
 *
 * @param app - The chat sub-router. Routes are mounted relative to it.
 */
export function registerChatAuxiliaryRoutes(app: Hono<AuthedEnv>): void {
  registerStopRoute(app)
  registerSubscribeRoute(app)
  registerHistoryRoutes(app)
  registerLifecycleRoutes(app)
  registerInteractionRoutes(app)
}

/** `POST /chat/:sessionId/stop` — flag the DO to stop the active turn. */
function registerStopRoute(app: Hono<AuthedEnv>): void {
  app.post('/:sessionId/stop', async (c) => {
    const gate = await requireSessionOwner(c, c.req.param('sessionId'))
    if (!gate.ok) return gate.response

    const stub = sessionStub(c)
    await setMeta(stub, { agent_should_stop: 'true' })
    return c.json({ success: true })
  })
}

/**
 * `GET /chat/:sessionId/subscribe` — backward-compatible no-op SSE.
 *
 * The new architecture has no out-of-request agent process to subscribe to.
 * We immediately emit `session.idle` so old clients exit their streaming
 * state cleanly on reconnect.
 */
function registerSubscribeRoute(app: Hono<AuthedEnv>): void {
  app.get('/:sessionId/subscribe', async (c) => {
    const gate = await requireSessionOwner(c, c.req.param('sessionId'))
    if (!gate.ok) return gate.response

    return streamSSE(c, async (stream) => {
      await stream.writeSSE({ event: 'session.idle', data: JSON.stringify({ type: 'session.idle' }) })
      await stream.close()
    })
  })
}

/** Read-only history passthroughs (events / messages / tasks). */
function registerHistoryRoutes(app: Hono<AuthedEnv>): void {
  for (const path of ['/events', '/messages', '/tasks', '/turns'] as const) {
    app.get(`/:sessionId${path}`, async (c) => {
      const gate = await requireSessionOwner(c, c.req.param('sessionId'))
      if (!gate.ok) return gate.response
      const params = new URLSearchParams()
      const limit = c.req.query('limit')
      const before = c.req.query('before')
      const status = c.req.query('status')
      if (limit) params.set('limit', limit)
      if (before) params.set('before', before)
      if (status) params.set('status', status)
      const stub = sessionStub(c)
      const response = await stub.fetch(new Request(`${DO_URL}${path}?${params}`))
      return new Response(response.body, response)
    })
  }

  app.get('/:sessionId/git/state', async (c) => {
    const gate = await requireSessionOwner(c, c.req.param('sessionId'))
    if (!gate.ok) return gate.response
    const stub = sessionStub(c)
    return c.json(await collectSessionGitState({ env: c.env, stub, userId: gate.userId }))
  })

  app.post('/:sessionId/git/pr/ready', async (c) => {
    const gate = await requireSessionOwner(c, c.req.param('sessionId'))
    if (!gate.ok) return gate.response
    const stub = sessionStub(c)
    const response = await stub.fetch(new Request(`${DO_URL}/git/pr/ready`, { method: 'POST' }))
    return new Response(response.body, response)
  })
}

/** Pause / resume / retry — toggles a meta flag the runner observes. */
function registerLifecycleRoutes(app: Hono<AuthedEnv>): void {
  app.post('/:sessionId/retry', async (c) => {
    const gate = await requireSessionOwner(c, c.req.param('sessionId'))
    if (!gate.ok) return gate.response
    const stub = sessionStub(c)
    await setMeta(stub, { agent_paused: 'false', agent_should_stop: 'false' })
    return c.json({ success: true })
  })

  app.post('/:sessionId/pause', async (c) => {
    const gate = await requireSessionOwner(c, c.req.param('sessionId'))
    if (!gate.ok) return gate.response
    const stub = sessionStub(c)
    await setMeta(stub, { agent_paused: 'true' })
    return c.json({ success: true })
  })

  app.post('/:sessionId/resume', async (c) => {
    const gate = await requireSessionOwner(c, c.req.param('sessionId'))
    if (!gate.ok) return gate.response
    const stub = sessionStub(c)
    await setMeta(stub, { agent_paused: 'false' })
    return c.json({ success: true })
  })
}

/**
 * Permission + question endpoints.
 *
 * The new agent architecture handles user questions through the
 * `ask_user_question` tool — its result is the next user message. For now
 * these endpoints just record the user's reply on the session so the UI
 * can clear the prompt; full approval round-trips are TODO.
 */
function registerInteractionRoutes(app: Hono<AuthedEnv>): void {
  app.post('/:sessionId/permission/:permissionId', async (c) => {
    const gate = await requireSessionOwner(c, c.req.param('sessionId'))
    if (!gate.ok) return gate.response
    const stub = sessionStub(c)
    await setMeta(stub, { [`permission:${c.req.param('permissionId')}`]: 'resolved' })
    return c.json({ success: true })
  })

  app.post('/:sessionId/question/:questionId', async (c) => {
    const gate = await requireSessionOwner(c, c.req.param('sessionId'))
    if (!gate.ok) return gate.response
    const body = await c.req.json<{ response?: string }>().catch(() => ({}) as { response?: string })
    const response = body.response?.trim()
    if (!response) return c.json({ error: 'response is required' }, 400)
    const stub = sessionStub(c)
    await setMeta(stub, { [`question:${c.req.param('questionId')}`]: response })
    return c.json({ success: true })
  })

  app.post('/:sessionId/question/:questionId/reject', async (c) => {
    const gate = await requireSessionOwner(c, c.req.param('sessionId'))
    if (!gate.ok) return gate.response
    const stub = sessionStub(c)
    await setMeta(stub, { [`question:${c.req.param('questionId')}`]: 'rejected' })
    return c.json({ success: true })
  })
}

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

interface AuthedContext {
  env: AuthedEnv['Bindings']
  req: { param(key: string): string }
}

function sessionStub(c: AuthedContext): { fetch: typeof fetch } {
  const sessionId = c.req.param('sessionId')
  const id = c.env.SESSION_DO.idFromName(sessionId)
  return c.env.SESSION_DO.get(id) as unknown as { fetch: typeof fetch }
}

async function setMeta(stub: { fetch: typeof fetch }, patch: Record<string, string>): Promise<void> {
  await stub.fetch(
    new Request(`${DO_URL}/meta`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    }),
  )
}
