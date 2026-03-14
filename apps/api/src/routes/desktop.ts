/**
 * Desktop streaming routes
 *
 * Manages E2B desktop stream lifecycle per session:
 * - POST /desktop/:sessionId/start - Start desktop stream
 * - POST /desktop/:sessionId/stop  - Stop desktop stream
 * - GET  /desktop/:sessionId/stream - Get current stream URL
 */

import { Hono } from 'hono'
import type { Env } from '../env.d'
import { startDesktopStream, stopDesktopStream } from '../lib/desktop'

const desktop = new Hono<{ Bindings: Env }>()

/**
 * POST /desktop/:sessionId/start
 * Start desktop stream, store URL in DO meta, return stream URL
 */
desktop.post('/:sessionId/start', async (c) => {
  try {
    const sessionId = c.req.param('sessionId')
    const apiKey = c.env.E2B_API_KEY
    if (!apiKey) {
      return c.json({ error: 'E2B_API_KEY not configured' }, 500)
    }

    // Get sandbox ID from session DO
    const doId = c.env.SESSION_DO.idFromName(sessionId)
    const doStub = c.env.SESSION_DO.get(doId)

    const metaRes = await doStub.fetch('http://do/meta')
    const meta = (await metaRes.json()) as Record<string, string>
    const sandboxId = meta.sandbox_id

    if (!sandboxId) {
      return c.json({ error: 'No sandbox provisioned for this session' }, 400)
    }

    // Start desktop stream
    const { streamUrl, authKey } = await startDesktopStream(apiKey, sandboxId)

    // Store in DO meta
    await doStub.fetch('http://do/meta', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        desktop_stream_url: streamUrl,
        desktop_stream_auth_key: authKey,
      }),
    })

    return c.json({ streamUrl })
  } catch (error) {
    console.error('Error starting desktop stream:', error)
    return c.json(
      { error: error instanceof Error ? error.message : 'Failed to start desktop stream' },
      500,
    )
  }
})

/**
 * POST /desktop/:sessionId/stop
 * Stop desktop stream, clear DO meta
 */
desktop.post('/:sessionId/stop', async (c) => {
  try {
    const sessionId = c.req.param('sessionId')
    const apiKey = c.env.E2B_API_KEY
    if (!apiKey) {
      return c.json({ error: 'E2B_API_KEY not configured' }, 500)
    }

    // Get sandbox ID from session DO
    const doId = c.env.SESSION_DO.idFromName(sessionId)
    const doStub = c.env.SESSION_DO.get(doId)

    const metaRes = await doStub.fetch('http://do/meta')
    const meta = (await metaRes.json()) as Record<string, string>
    const sandboxId = meta.sandbox_id

    if (!sandboxId) {
      return c.json({ error: 'No sandbox provisioned for this session' }, 400)
    }

    // Stop desktop stream
    await stopDesktopStream(apiKey, sandboxId)

    // Clear DO meta
    await doStub.fetch('http://do/meta', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        desktop_stream_url: '',
        desktop_stream_auth_key: '',
      }),
    })

    return c.json({ success: true })
  } catch (error) {
    console.error('Error stopping desktop stream:', error)
    return c.json(
      { error: error instanceof Error ? error.message : 'Failed to stop desktop stream' },
      500,
    )
  }
})

/**
 * GET /desktop/:sessionId/stream
 * Get current stream URL from DO meta
 */
desktop.get('/:sessionId/stream', async (c) => {
  try {
    const sessionId = c.req.param('sessionId')

    const doId = c.env.SESSION_DO.idFromName(sessionId)
    const doStub = c.env.SESSION_DO.get(doId)

    const metaRes = await doStub.fetch('http://do/meta')
    const meta = (await metaRes.json()) as Record<string, string>

    const streamUrl = meta.desktop_stream_url || null
    return c.json({ streamUrl, active: Boolean(streamUrl) })
  } catch (error) {
    console.error('Error getting desktop stream:', error)
    return c.json(
      { error: error instanceof Error ? error.message : 'Failed to get desktop stream' },
      500,
    )
  }
})

export default desktop
