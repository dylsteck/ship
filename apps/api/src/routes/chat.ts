import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import {
  getOpenCodeClient,
  createOpenCodeSession,
  promptOpenCode,
  stopOpenCode,
  subscribeToEvents,
  filterSessionEvents,
  type Event,
  type Part,
} from '../lib/opencode'
import type { Env } from '../env.d'

const app = new Hono<{ Bindings: Env }>()

// POST /chat/:sessionId - Send message and receive streaming response
app.post('/:sessionId', async (c) => {
  const sessionId = c.req.param('sessionId')
  const { content, mode = 'build' } = await c.req.json<{
    content: string
    mode?: 'build' | 'plan'
  }>()

  if (!content?.trim()) {
    return c.json({ error: 'Message content required' }, 400)
  }

  // Get DO stub
  const id = c.env.SESSION_DO.idFromName(sessionId)
  const stub = c.env.SESSION_DO.get(id)

  // Persist user message
  const doUrl = 'https://do'
  await stub.fetch(
    new Request(`${doUrl}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'user', content }),
    }),
  )

  // Get or create OpenCode session for this session
  const metaRes = await stub.fetch(new Request(`${doUrl}/meta`))
  const meta = (await metaRes.json()) as Record<string, string>
  let opencodeSessionId = meta.opencodeSessionId

  if (!opencodeSessionId) {
    // Create new OpenCode session
    // TODO: In Phase 3, this will use the actual repo path from sandbox
    const projectPath = meta.repoPath || '/tmp/ship-session'
    const ocSession = await createOpenCodeSession(projectPath)
    opencodeSessionId = ocSession.id

    // Save to session meta
    await stub.fetch(
      new Request(`${doUrl}/meta`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ opencodeSessionId }),
      }),
    )
  }

  // Stream OpenCode events as SSE
  return streamSSE(c, async (stream) => {
    try {
      // Send prompt to OpenCode
      await promptOpenCode(opencodeSessionId!, content, { mode })

      // Subscribe to events and filter for this session
      const eventStream = await subscribeToEvents()
      const sessionEvents = filterSessionEvents(eventStream, opencodeSessionId!)

      // Accumulate assistant message content
      let assistantContent = ''
      const parts: Part[] = []
      let currentMessageId: string | undefined

      // Process events
      for await (const event of sessionEvents) {
        // Stream event to client
        await stream.writeSSE({
          event: 'event',
          data: JSON.stringify(event),
        })

        // Broadcast to WebSocket clients via DO
        await stub.fetch(
          new Request(`${doUrl}/broadcast`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'opencode-event', event }),
          }),
        )

        // Handle different event types
        switch (event.type) {
          case 'message.part.updated': {
            const part = event.properties.part
            parts.push(part)

            // Track message ID for persistence
            if (!currentMessageId) {
              currentMessageId = part.messageID
            }

            // Accumulate text content
            if (part.type === 'text') {
              assistantContent += part.text
            }

            // If this is a tool part, check if it creates a task
            if (part.type === 'tool') {
              // Tool calls might indicate task creation
              // The agent infers tasks from natural language per CONTEXT.md
              // We track tool usage for the UI but task creation happens
              // when agent explicitly creates todos
            }
            break
          }

          case 'todo.updated': {
            // Agent updated todos - create tasks from them
            const todos = event.properties.todos
            for (const todo of todos) {
              await stub.fetch(
                new Request(`${doUrl}/tasks`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    title: todo.content,
                    description: `Priority: ${todo.priority}`,
                    mode,
                  }),
                }),
              )
            }
            break
          }

          case 'permission.updated': {
            // Forward permission request to client
            // Client will respond via WebSocket
            await stream.writeSSE({
              event: 'permission',
              data: JSON.stringify({
                id: event.properties.id,
                action: event.properties.type,
                description: event.properties.title,
              }),
            })
            break
          }

          case 'session.idle':
            // Agent finished
            break

          case 'session.error': {
            const errorMsg = event.properties.error ? JSON.stringify(event.properties.error) : 'Unknown error'
            await stream.writeSSE({
              event: 'error',
              data: JSON.stringify({ error: errorMsg }),
            })
            break
          }
        }

        // Stop when session becomes idle
        if (event.type === 'session.idle') {
          break
        }
      }

      // Persist assistant message with accumulated content and parts
      if (assistantContent || parts.length > 0) {
        await stub.fetch(
          new Request(`${doUrl}/messages`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              role: 'assistant',
              content: assistantContent,
              parts: JSON.stringify(parts),
            }),
          }),
        )
      }

      await stream.writeSSE({
        event: 'done',
        data: JSON.stringify({ type: 'done' }),
      })
    } catch (error) {
      console.error('OpenCode error:', error)
      await stream.writeSSE({
        event: 'error',
        data: JSON.stringify({ error: 'Agent execution failed' }),
      })
    }
  })
})

// POST /chat/:sessionId/stop - Stop streaming
app.post('/:sessionId/stop', async (c) => {
  const sessionId = c.req.param('sessionId')

  // Get OpenCode session ID from DO
  const id = c.env.SESSION_DO.idFromName(sessionId)
  const stub = c.env.SESSION_DO.get(id)

  const metaRes = await stub.fetch(new Request('https://do/meta'))
  const meta = (await metaRes.json()) as Record<string, string>

  if (meta.opencodeSessionId) {
    await stopOpenCode(meta.opencodeSessionId)
  }

  return c.json({ success: true })
})

// GET /chat/:sessionId/messages - Get message history
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

// GET /chat/:sessionId/tasks - Get tasks
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

export default app
