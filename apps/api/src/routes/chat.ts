import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import {
  createOpenCodeSession,
  promptOpenCode,
  stopOpenCode,
  subscribeToEvents,
  filterSessionEvents,
  type Event,
  type Part,
} from '../lib/opencode'
import { startOpenCodeServer } from '../lib/e2b'
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

  // Get session metadata including OpenCode session, model preference, and sandbox info
  let metaRes = await stub.fetch(new Request(`${doUrl}/meta`))
  let meta = (await metaRes.json()) as Record<string, string>
  let opencodeSessionId = meta.opencodeSessionId
  const selectedModel = meta.selected_model // Per-session model preference
  let sandboxId = meta.sandbox_id
  let sandboxStatus = meta.sandbox_status

  // Check if we're in development mode
  const isDev = c.env.ENVIRONMENT === 'development'

  // If sandbox is still provisioning, wait for it to complete (with timeout)
  if (!sandboxId && sandboxStatus === 'provisioning' && !isDev) {
    const maxWaitMs = 60000 // 60 seconds max wait
    const pollIntervalMs = 2000 // Poll every 2 seconds
    const startTime = Date.now()

    while (Date.now() - startTime < maxWaitMs) {
      await new Promise((r) => setTimeout(r, pollIntervalMs))

      // Re-fetch metadata to check sandbox status
      metaRes = await stub.fetch(new Request(`${doUrl}/meta`))
      meta = (await metaRes.json()) as Record<string, string>
      sandboxId = meta.sandbox_id
      sandboxStatus = meta.sandbox_status

      if (sandboxId) {
        break // Sandbox is ready
      }

      if (sandboxStatus === 'error') {
        return c.json({ error: 'Sandbox provisioning failed. Please try again.' }, 500)
      }
    }

    if (!sandboxId) {
      return c.json({ error: 'Sandbox provisioning timed out. Please try again.' }, 504)
    }
  }

  // If no sandbox and not provisioning, we can't proceed in production
  if (!sandboxId && !isDev) {
    return c.json({ error: 'Sandbox not provisioned. Please refresh and try again.' }, 400)
  }

  // In production, we need the sandbox URL for OpenCode
  // OpenCode runs INSIDE the E2B sandbox, not as a separate server
  let opencodeUrl = meta.opencode_url

  // If we have a sandbox but no OpenCode URL, start the OpenCode server
  if (sandboxId && !opencodeUrl) {
    try {
      console.log(`[chat:${sessionId}] Starting OpenCode server in sandbox ${sandboxId}...`)
      const { url } = await startOpenCodeServer(c.env.E2B_API_KEY, sandboxId, c.env.ANTHROPIC_API_KEY)
      opencodeUrl = url
      console.log(`[chat:${sessionId}] OpenCode server started at ${url}`)

      // Store the URL for future requests
      await stub.fetch(
        new Request(`${doUrl}/meta`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ opencode_url: url }),
        }),
      )
    } catch (error) {
      console.error(`[chat:${sessionId}] Failed to start OpenCode server in sandbox:`, error)

      // Return error immediately - don't try to stream
      return c.json(
        {
          error: 'Failed to start agent server',
          details: error instanceof Error ? error.message : 'Unknown error',
          sandboxId,
          suggestion: 'The sandbox may need more time to initialize. Please refresh and try again.',
        },
        500,
      )
    }
  }

  if (!opencodeSessionId) {
    // Create new OpenCode session
    const projectPath = meta.repoPath || '/home/user/repo'
    const ocSession = await createOpenCodeSession(projectPath, opencodeUrl)
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

  // Capture opencodeUrl in closure for SSE handler
  const sandboxOpenCodeUrl = opencodeUrl

  // Stream OpenCode events as SSE
  return streamSSE(c, async (stream) => {
    try {
      // Send prompt to OpenCode with retry wrapper
      await executeWithRetry(
        async () => {
          await promptOpenCode(opencodeSessionId!, content, { mode, model: selectedModel }, sandboxOpenCodeUrl)
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
      const eventStream = await subscribeToEvents(sandboxOpenCodeUrl)
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
              // part.tool is a string (tool name) in OpenCode SDK
              const toolName = typeof part.tool === 'string' ? part.tool : (part.tool as { name?: string })?.name
              if (toolName?.includes('write') || toolName?.includes('edit') || toolName?.includes('create')) {
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

  // Get OpenCode session ID and sandbox URL from DO
  const id = c.env.SESSION_DO.idFromName(sessionId)
  const stub = c.env.SESSION_DO.get(id)

  const metaRes = await stub.fetch(new Request('https://do/meta'))
  const meta = (await metaRes.json()) as Record<string, string>

  if (meta.opencodeSessionId) {
    // Use sandbox URL if available (production), otherwise will use dev fallback
    await stopOpenCode(meta.opencodeSessionId, meta.opencode_url)
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

// GET /chat/:sessionId/git/state - Get git state (branch, PR info)
app.get('/:sessionId/git/state', async (c) => {
  const sessionId = c.req.param('sessionId')

  const id = c.env.SESSION_DO.idFromName(sessionId)
  const stub = c.env.SESSION_DO.get(id)

  const response = await stub.fetch(new Request('https://do/git/state'))
  return new Response(response.body, response)
})

// POST /chat/:sessionId/git/pr/ready - Mark PR ready for review
app.post('/:sessionId/git/pr/ready', async (c) => {
  const sessionId = c.req.param('sessionId')

  const id = c.env.SESSION_DO.idFromName(sessionId)
  const stub = c.env.SESSION_DO.get(id)

  const response = await stub.fetch(new Request('https://do/git/pr/ready', { method: 'POST' }))

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
