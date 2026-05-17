import type { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import { connectToSandboxAgent, cancelAgent, subscribeToSessionEvents } from '../lib/sandbox-agent'
import { EventTranslatorState } from '../lib/event-translator'
import { safeErrorForLog } from '../lib/error-handler'
import { resumeAgentSessionWithTimeout } from './chat-session-helpers'
import type { Env } from '../env.d'

/** SSE proxies, DO passthrough, and agent question/permission helpers (everything except POST message stream). */
export function registerChatAuxiliaryRoutes(app: Hono<{ Bindings: Env }>) {
  // POST /chat/:sessionId/stop - Stop streaming
  app.post('/:sessionId/stop', async (c) => {
    const sessionId = c.req.param('sessionId')

    const id = c.env.SESSION_DO.idFromName(sessionId)
    const stub = c.env.SESSION_DO.get(id)

    const metaRes = await stub.fetch(new Request('https://do/meta'))
    const meta = (await metaRes.json()) as Record<string, string>

    if (meta.agent_session_id && meta.sandbox_agent_url) {
      try {
        const client = await connectToSandboxAgent(meta.sandbox_agent_url, meta.sandbox_agent_token || undefined)
        await cancelAgent(client, meta.agent_session_id)
      } catch (error) {
        console.warn(`[chat:${sessionId}] Cancel error:`, error)
      }
    }

    return c.json({ success: true })
  })

  // GET /chat/:sessionId/subscribe - SSE stream to resume an active agent session (e.g. after page reload)
  app.get('/:sessionId/subscribe', async (c) => {
    const sessionId = c.req.param('sessionId')

    const id = c.env.SESSION_DO.idFromName(sessionId)
    const stub = c.env.SESSION_DO.get(id)

    const metaRes = await stub.fetch(new Request('https://do/meta'))
    const meta = (await metaRes.json()) as Record<string, string>
    const agentSessionId = meta.agent_session_id
    const sandboxAgentUrl = meta.sandbox_agent_url
    const agentToken = meta.sandbox_agent_token || undefined

    if (!agentSessionId || !sandboxAgentUrl) {
      return streamSSE(c, async (stream) => {
        await stream.writeSSE({
          event: 'session.idle',
          data: JSON.stringify({ type: 'session.idle' }),
        })
        await stream.close()
      })
    }

    return streamSSE(c, async (stream) => {
      try {
        const client = await connectToSandboxAgent(sandboxAgentUrl, agentToken)
        const session = await resumeAgentSessionWithTimeout(client, agentSessionId)

        if (!session) {
          await stream.writeSSE({
            event: 'session.idle',
            data: JSON.stringify({ type: 'session.idle' }),
          })
          await stream.close()
          return
        }

        const translator = new EventTranslatorState(sessionId)

        const unsubscribe = subscribeToSessionEvents(session, async (event) => {
          const sseEvents = translator.translateEvent(event)
          for (const sseEvent of sseEvents) {
            await stream.writeSSE({
              event: sseEvent.type,
              data: JSON.stringify(sseEvent),
            })

            if (sseEvent.type === 'session.idle' || sseEvent.type === 'session.error') {
              unsubscribe()
            }
          }
        })

        await new Promise((resolve) => setTimeout(resolve, 300000))
        unsubscribe()
      } catch (error) {
        const subscribePayload = {
          error: error instanceof Error ? error.message : 'Stream failed',
          details: error instanceof Error ? error.message : String(error),
        }
        console.error(`[chat:${sessionId}] ERROR (subscribe):`, subscribePayload)
        await stream.writeSSE({
          event: 'session.error',
          data: JSON.stringify({
            type: 'session.error',
            properties: { error: subscribePayload.error },
          }),
        })
      } finally {
        await stream.close()
      }
    })
  })

  // GET /chat/:sessionId/subagent/:subagentSessionId/stream
  app.get('/:sessionId/subagent/:subagentSessionId/stream', async (c) => {
    const sessionId = c.req.param('sessionId')
    const subagentSessionId = c.req.param('subagentSessionId')

    const id = c.env.SESSION_DO.idFromName(sessionId)
    const stub = c.env.SESSION_DO.get(id)

    const metaRes = await stub.fetch(new Request('https://do/meta'))
    const meta = (await metaRes.json()) as Record<string, string>
    const sandboxAgentUrl = meta.sandbox_agent_url
    const subagentToken = meta.sandbox_agent_token || undefined

    if (!sandboxAgentUrl) {
      return c.json({ error: 'Agent server not available' }, 400)
    }

    return streamSSE(c, async (stream) => {
      try {
        const client = await connectToSandboxAgent(sandboxAgentUrl, subagentToken)
        const session = await resumeAgentSessionWithTimeout(client, subagentSessionId)

        if (!session) {
          const subagentPayload = {
            error: 'Sub-agent session not found',
            details: 'The sub-agent session may have expired or been terminated',
          }
          console.error(`[chat:${sessionId}] ERROR:`, subagentPayload)
          await stream.writeSSE({
            event: 'error',
            data: JSON.stringify(subagentPayload),
          })
          return
        }

        const translator = new EventTranslatorState(subagentSessionId)

        const unsubscribe = subscribeToSessionEvents(session, async (event) => {
          const sseEvents = translator.translateEvent(event)
          for (const sseEvent of sseEvents) {
            await stream.writeSSE({
              event: sseEvent.type,
              data: JSON.stringify(sseEvent),
            })

            if (sseEvent.type === 'session.idle' || sseEvent.type === 'session.error') {
              unsubscribe()
            }
          }
        })

        await new Promise((resolve) => setTimeout(resolve, 300000))
        unsubscribe()
      } catch (error) {
        console.error(`[chat:${sessionId}] Subagent stream error:`, safeErrorForLog(error))
        const streamFailPayload = {
          error: error instanceof Error ? error.message : 'Stream failed',
          details: error instanceof Error ? error.message : String(error),
        }
        console.error(`[chat:${sessionId}] ERROR:`, streamFailPayload)
        await stream.writeSSE({
          event: 'error',
          data: JSON.stringify(streamFailPayload),
        })
      } finally {
        await stream.close()
      }
    })
  })

  app.get('/:sessionId/events', async (c) => {
    const sessionId = c.req.param('sessionId')
    const id = c.env.SESSION_DO.idFromName(sessionId)
    const stub = c.env.SESSION_DO.get(id)
    const response = await stub.fetch(new Request('https://do/events'))
    return new Response(response.body, response)
  })

  app.get('/:sessionId/messages', async (c) => {
    const sessionId = c.req.param('sessionId')
    const limit = c.req.query('limit')
    const before = c.req.query('before')
    const id = c.env.SESSION_DO.idFromName(sessionId)
    const stub = c.env.SESSION_DO.get(id)
    const params = new URLSearchParams()
    if (limit) params.set('limit', limit)
    if (before) params.set('before', before)
    const response = await stub.fetch(new Request(`https://do/messages?${params}`))
    return new Response(response.body, response)
  })

  app.get('/:sessionId/tasks', async (c) => {
    const sessionId = c.req.param('sessionId')
    const status = c.req.query('status')
    const id = c.env.SESSION_DO.idFromName(sessionId)
    const stub = c.env.SESSION_DO.get(id)
    const params = new URLSearchParams()
    if (status) params.set('status', status)
    const response = await stub.fetch(new Request(`https://do/tasks?${params}`))
    return new Response(response.body, response)
  })

  app.get('/:sessionId/git/state', async (c) => {
    const sessionId = c.req.param('sessionId')
    const id = c.env.SESSION_DO.idFromName(sessionId)
    const stub = c.env.SESSION_DO.get(id)
    const response = await stub.fetch(new Request('https://do/git/state'))
    return new Response(response.body, response)
  })

  app.post('/:sessionId/git/pr/ready', async (c) => {
    const sessionId = c.req.param('sessionId')
    const id = c.env.SESSION_DO.idFromName(sessionId)
    const stub = c.env.SESSION_DO.get(id)
    const response = await stub.fetch(new Request('https://do/git/pr/ready', { method: 'POST' }))
    return new Response(response.body, response)
  })

  app.post('/:sessionId/retry', async (c) => {
    const sessionId = c.req.param('sessionId')
    const id = c.env.SESSION_DO.idFromName(sessionId)
    const stub = c.env.SESSION_DO.get(id)
    try {
      const metaRes = await stub.fetch(new Request('https://do/meta'))
      const meta = (await metaRes.json()) as Record<string, string>
      if (meta.agent_paused === 'true') {
        await stub.fetch(
          new Request('https://do/meta', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ agent_paused: 'false' }),
          }),
        )
      }
      return c.json({ success: true })
    } catch (error) {
      return c.json({ error: error instanceof Error ? error.message : 'Failed to retry' }, 500)
    }
  })

  app.post('/:sessionId/pause', async (c) => {
    const sessionId = c.req.param('sessionId')
    const id = c.env.SESSION_DO.idFromName(sessionId)
    const stub = c.env.SESSION_DO.get(id)
    try {
      await stub.fetch(
        new Request('https://do/meta', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ agent_paused: 'true' }),
        }),
      )
      return c.json({ success: true })
    } catch (error) {
      return c.json({ error: error instanceof Error ? error.message : 'Failed to pause' }, 500)
    }
  })

  app.post('/:sessionId/resume', async (c) => {
    const sessionId = c.req.param('sessionId')
    const id = c.env.SESSION_DO.idFromName(sessionId)
    const stub = c.env.SESSION_DO.get(id)
    try {
      await stub.fetch(
        new Request('https://do/meta', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ agent_paused: 'false' }),
        }),
      )
      return c.json({ success: true })
    } catch (error) {
      return c.json({ error: error instanceof Error ? error.message : 'Failed to resume' }, 500)
    }
  })

  app.post('/:sessionId/permission/:permissionId', async (c) => {
    const sessionId = c.req.param('sessionId')
    const permissionId = c.req.param('permissionId')
    const body = await c.req.json<{ reply: 'once' | 'always' | 'reject'; message?: string }>()
    if (!body.reply || !['once', 'always', 'reject'].includes(body.reply)) {
      return c.json({ error: 'reply must be once, always, or reject' }, 400)
    }
    const id = c.env.SESSION_DO.idFromName(sessionId)
    const stub = c.env.SESSION_DO.get(id)
    const metaRes = await stub.fetch(new Request('https://do/meta'))
    const meta = (await metaRes.json()) as Record<string, string>
    if (!meta.sandbox_agent_url) {
      return c.json({ error: 'Agent server not available' }, 400)
    }
    try {
      const client = await connectToSandboxAgent(meta.sandbox_agent_url, meta.sandbox_agent_token || undefined)
      const agentSessionId = meta.agent_session_id
      if (!agentSessionId) {
        return c.json({ error: 'No active agent session' }, 400)
      }
      const session = await resumeAgentSessionWithTimeout(client, agentSessionId)
      if (!session) {
        return c.json({ error: 'Agent session not found' }, 400)
      }
      await session.respondPermission(permissionId, body.reply)
      return c.json({ success: true })
    } catch (error) {
      console.error(`[chat:${sessionId}] Failed to respond to permission:`, safeErrorForLog(error))
      return c.json({ error: error instanceof Error ? error.message : 'Failed to respond' }, 500)
    }
  })

  app.post('/:sessionId/question/:questionId', async (c) => {
    const sessionId = c.req.param('sessionId')
    const questionId = c.req.param('questionId')
    const body = await c.req.json<{ response: string }>()
    const response = body.response?.trim()
    if (!response) {
      return c.json({ error: 'response is required' }, 400)
    }
    const id = c.env.SESSION_DO.idFromName(sessionId)
    const stub = c.env.SESSION_DO.get(id)
    const metaRes = await stub.fetch(new Request('https://do/meta'))
    const meta = (await metaRes.json()) as Record<string, string>
    if (!meta.sandbox_agent_url) {
      return c.json({ error: 'Agent server not available' }, 400)
    }
    try {
      const url = `${meta.sandbox_agent_url}/opencode/question/${questionId}/reply`
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (meta.sandbox_agent_token) headers['Authorization'] = `Bearer ${meta.sandbox_agent_token}`
      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({ answers: [[response]] }),
      })
      if (!res.ok) {
        const text = await res.text()
        console.error(`[chat:${sessionId}] Question reply failed: ${res.status} ${text}`)
        return c.json({ error: 'Failed to reply to question' }, res.status >= 500 ? 502 : 400)
      }
      return c.json({ success: true })
    } catch (error) {
      console.error(`[chat:${sessionId}] Failed to reply to question:`, safeErrorForLog(error))
      return c.json({ error: error instanceof Error ? error.message : 'Failed to reply' }, 500)
    }
  })

  app.post('/:sessionId/question/:questionId/reject', async (c) => {
    const sessionId = c.req.param('sessionId')
    const questionId = c.req.param('questionId')
    const id = c.env.SESSION_DO.idFromName(sessionId)
    const stub = c.env.SESSION_DO.get(id)
    const metaRes = await stub.fetch(new Request('https://do/meta'))
    const meta = (await metaRes.json()) as Record<string, string>
    if (!meta.sandbox_agent_url) {
      return c.json({ error: 'Agent server not available' }, 400)
    }
    try {
      const url = `${meta.sandbox_agent_url}/opencode/question/${questionId}/reject`
      const rejectHeaders: Record<string, string> = {}
      if (meta.sandbox_agent_token) rejectHeaders['Authorization'] = `Bearer ${meta.sandbox_agent_token}`
      const res = await fetch(url, { method: 'POST', headers: rejectHeaders })
      if (!res.ok) {
        const text = await res.text()
        console.error(`[chat:${sessionId}] Question reject failed: ${res.status} ${text}`)
        return c.json({ error: 'Failed to reject question' }, res.status >= 500 ? 502 : 400)
      }
      return c.json({ success: true })
    } catch (error) {
      console.error(`[chat:${sessionId}] Failed to reject question:`, safeErrorForLog(error))
      return c.json({ error: error instanceof Error ? error.message : 'Failed to reject' }, 500)
    }
  })
}
