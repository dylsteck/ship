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
import { executeWithRetry, classifyError, sanitizeError } from '../lib/error-handler'
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

  // Get session metadata including OpenCode session and model preference
  const metaRes = await stub.fetch(new Request(`${doUrl}/meta`))
  const meta = (await metaRes.json()) as Record<string, string>
  let opencodeSessionId = meta.opencodeSessionId
  const selectedModel = meta.selected_model // Per-session model preference

  if (!opencodeSessionId) {
    // Create new OpenCode session
    const projectPath = meta.repoPath || '/home/user/repo'
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

  // Detect if this is a task intent (starts with action verbs or contains task keywords)
  const isTask = /^(build|create|add|fix|implement|refactor|update|write)/i.test(content.trim())

  // If this is a task and agent executor is ready, start task workflow
  if (isTask && meta.sandbox_id && meta.repo_url) {
    try {
      await stub.fetch(
        new Request(`${doUrl}/task/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ taskDescription: content }),
        }),
      )
    } catch (error) {
      // Log but don't fail - continue with normal chat
      console.error('Failed to start task workflow:', error)
    }
  }

  // Stream OpenCode events as SSE
  return streamSSE(c, async (stream) => {
    try {
      // Send prompt to OpenCode with retry wrapper
      await executeWithRetry(
        async () => {
          await promptOpenCode(opencodeSessionId!, content, { mode, model: selectedModel })
        },
        {
          operationName: 'Send prompt to OpenCode',
          onError: async (error, attempt) => {
            const details = classifyError(error)
            const sanitized = sanitizeError(error)

            // Emit error to SSE stream
            await stream.writeSSE({
              event: 'error',
              data: JSON.stringify({
                error: sanitized,
                category: details.category,
                retryable: details.retryable,
                attempt,
              }),
            })
          },
        },
      )

      // Subscribe to events and filter for this session
      const eventStream = await subscribeToEvents()
      const sessionEvents = filterSessionEvents(eventStream, opencodeSessionId!)

      // Accumulate assistant message content
      let assistantContent = ''
      const parts: Part[] = []
      let currentMessageId: string | undefined
      let hasChanges = false

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

            // If this is a tool part, track file changes for git commit
            if (part.type === 'tool') {
              // File write/edit operations indicate changes to commit
              if (
                part.tool?.name?.includes('write') ||
                part.tool?.name?.includes('edit') ||
                part.tool?.name?.includes('create')
              ) {
                hasChanges = true
              }
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
            // Agent finished - trigger git commit if there are changes
            if (hasChanges) {
              try {
                // Trigger git commit and push via SessionDO
                await stub.fetch(
                  new Request(`${doUrl}/agent/response`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      summary: assistantContent.slice(0, 100) || content.slice(0, 100),
                      hasChanges: true,
                    }),
                  }),
                )

                // Get PR info if it was created
                const gitStateRes = await stub.fetch(new Request(`${doUrl}/git/state`))
                const gitState = (await gitStateRes.json()) as {
                  branchName: string | null
                  pr: { number: number; url: string; draft: boolean } | null
                }

                // Include PR URL in stream if available
                if (gitState.pr) {
                  await stream.writeSSE({
                    event: 'pr-created',
                    data: JSON.stringify({
                      prNumber: gitState.pr.number,
                      prUrl: gitState.pr.url,
                      draft: gitState.pr.draft,
                    }),
                  })
                }
              } catch (error) {
                console.error('Git workflow error:', error)
                // Don't fail the response - just log
              }
            }
            break

          case 'session.error': {
            const errorMsg = event.properties.error ? JSON.stringify(event.properties.error) : 'Unknown error'
            const details = classifyError(new Error(errorMsg))

            await stream.writeSSE({
              event: 'error',
              data: JSON.stringify({
                error: sanitizeError(new Error(errorMsg)),
                category: details.category,
                retryable: details.retryable,
              }),
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
      const details = classifyError(error)
      const sanitized = sanitizeError(error)

      await stream.writeSSE({
        event: 'error',
        data: JSON.stringify({
          error: sanitized,
          category: details.category,
          retryable: details.retryable,
        }),
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

// POST /chat/:sessionId/retry - Retry failed operation
app.post('/:sessionId/retry', async (c) => {
  const sessionId = c.req.param('sessionId')

  const id = c.env.SESSION_DO.idFromName(sessionId)
  const stub = c.env.SESSION_DO.get(id)

  try {
    // Resume agent executor if paused
    const metaRes = await stub.fetch(new Request('https://do/meta'))
    const meta = (await metaRes.json()) as Record<string, string>

    if (meta.agent_paused === 'true') {
      // Clear pause flag
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

// POST /chat/:sessionId/pause - Pause agent execution
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

// POST /chat/:sessionId/resume - Resume agent execution
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

export default app
