/**
 * Sandbox management routes
 *
 * Provides API endpoints for E2B sandbox lifecycle:
 * - POST /sandbox - Create new sandbox
 * - GET /sandbox/:id/status - Get sandbox status
 * - POST /sandbox/:id/pause - Pause sandbox
 *
 * Pattern: These routes interact with SessionDO sandbox methods
 */

import { Hono } from 'hono'
import type { Env } from '../env.d'

const sandbox = new Hono<{ Bindings: Env }>()

/**
 * POST /sandbox
 * Create a new sandbox for a session
 * Body: { sessionId: string }
 *
 * This provisions a new E2B sandbox and stores the ID in SessionDO
 */
sandbox.post('/', async (c) => {
  try {
    const body = await c.req.json<{ sessionId: string }>()
    const { sessionId } = body

    if (!sessionId) {
      return c.json({ error: 'sessionId is required' }, 400)
    }

    // Get SessionDO stub
    const doId = c.env.SESSION_DO.idFromName(sessionId)
    const doStub = c.env.SESSION_DO.get(doId)

    // Provision sandbox via DO RPC
    const response = await doStub.fetch(`http://do/sandbox/provision`, {
      method: 'POST',
    })

    if (!response.ok) {
      const error = await response.json()
      return c.json(error, 500)
    }

    const info = await response.json()
    return c.json(info, 201)
  } catch (error) {
    console.error('Error creating sandbox:', error)
    return c.json({ error: 'Failed to create sandbox' }, 500)
  }
})

/**
 * GET /sandbox/:id/status
 * Get sandbox status by sandbox ID
 *
 * Note: This queries E2B directly using the sandbox ID
 * For getting a session's sandbox, use GET /sessions/:id/sandbox
 */
sandbox.get('/:id/status', async (c) => {
  try {
    const sandboxId = c.req.param('id')

    // Query E2B API for sandbox status
    // This requires E2B_API_KEY from environment
    const apiKey = c.env.E2B_API_KEY
    if (!apiKey) {
      return c.json({ error: 'E2B_API_KEY not configured' }, 500)
    }

    // Import E2B functions to check status
    const { getSandboxStatus } = await import('../lib/e2b')

    const info = await getSandboxStatus(apiKey, sandboxId)
    return c.json(info)
  } catch (error) {
    console.error('Error fetching sandbox status:', error)
    return c.json({ error: 'Failed to fetch sandbox status' }, 500)
  }
})

/**
 * POST /sandbox/:id/pause
 * Pause a sandbox by sandbox ID
 *
 * This calls E2B betaPause() to explicitly pause the sandbox
 */
sandbox.post('/:id/pause', async (c) => {
  try {
    const sandboxId = c.req.param('id')

    const apiKey = c.env.E2B_API_KEY
    if (!apiKey) {
      return c.json({ error: 'E2B_API_KEY not configured' }, 500)
    }

    // Import E2B functions to pause
    const { pauseSandbox } = await import('../lib/e2b')

    await pauseSandbox(apiKey, sandboxId)
    return c.json({ success: true })
  } catch (error) {
    console.error('Error pausing sandbox:', error)
    return c.json({ error: 'Failed to pause sandbox' }, 500)
  }
})

export default sandbox
