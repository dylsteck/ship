import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import {
  startSandboxAgentServer,
  connectToSandboxAgent,
  createAgentSession,
  promptAgent,
  cancelAgent,
  resumeAgentSession,
  subscribeToSessionEvents,
} from '../lib/sandbox-agent'
import { EventTranslatorState } from '../lib/event-translator'
import { getAgent, getDefaultAgentId } from '../lib/agent-registry'
import { executeWithRetry, classifyError, sanitizeError } from '../lib/error-handler'
import type { Env } from '../env.d'

const app = new Hono<{ Bindings: Env }>()

// POST /chat/:sessionId - Send message and receive streaming response
app.post('/:sessionId', async (c) => {
  const sessionId = c.req.param('sessionId')
  console.log(`[chat:${sessionId}] ===== CHAT REQUEST STARTED =====`)

  let content: string
  let mode: 'build' | 'plan' = 'build'

  try {
    const body = await c.req.json<{
      content: string
      mode?: 'build' | 'plan'
    }>()
    content = body.content
    mode = body.mode || 'build'
  } catch (parseError) {
    console.error(`[chat:${sessionId}] Failed to parse request body:`, parseError)
    return c.json({ error: 'Invalid request body' }, 400)
  }

  console.log(`[chat:${sessionId}] Mode: ${mode}, Content length: ${content?.length || 0}`)

  if (!content?.trim()) {
    return c.json({ error: 'Message content required' }, 400)
  }

  // Get DO stub
  const id = c.env.SESSION_DO.idFromName(sessionId)
  const stub = c.env.SESSION_DO.get(id)
  const doUrl = 'https://do'

  // Persist user message
  await stub.fetch(
    new Request(`${doUrl}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'user', content }),
    }),
  )

  // Get session metadata
  const metaRes = await stub.fetch(new Request(`${doUrl}/meta`))
  const meta = (await metaRes.json()) as Record<string, string>

  let agentSessionId = meta.agent_session_id
  let sandboxId = meta.sandbox_id
  const sandboxStatus = meta.sandbox_status
  let sandboxAgentUrl = meta.sandbox_agent_url
  const agentType = meta.agent_type || getDefaultAgentId()

  console.log(
    `[chat:${sessionId}] Meta: sandboxId=${sandboxId}, sandboxAgentUrl=${sandboxAgentUrl}, agentSessionId=${agentSessionId}, agentType=${agentType}`,
  )

  // Check if sandbox is still provisioning
  const needsSandboxWait = !sandboxId && sandboxStatus === 'provisioning'

  try {
    return streamSSE(c, async (stream) => {
      console.log(`[chat:${sessionId}] SSE stream handler started`)

      try {
        // Send initial status
        await stream.writeSSE({
          event: 'status',
          data: JSON.stringify({
            type: 'status',
            status: 'initializing',
            message: 'Preparing agent...',
          }),
        })

        // Track current state
        let currentSandboxId: string | undefined = sandboxId
        let currentSandboxAgentUrl: string | undefined = sandboxAgentUrl
        let currentAgentSessionId: string | undefined = agentSessionId

        // Wait for sandbox if needed
        if (needsSandboxWait) {
          console.log(`[chat:${sessionId}] Waiting for sandbox provisioning...`)
          await stream.writeSSE({
            event: 'status',
            data: JSON.stringify({
              type: 'status',
              status: 'provisioning',
              message: 'Provisioning sandbox...',
            }),
          })

          const maxWaitMs = 30000
          const pollIntervalMs = 1000
          const startTime = Date.now()

          while (Date.now() - startTime < maxWaitMs) {
            await new Promise((r) => setTimeout(r, pollIntervalMs))

            const metaRes = await stub.fetch(new Request(`${doUrl}/meta`))
            const meta = (await metaRes.json()) as Record<string, string>
            currentSandboxId = meta.sandbox_id
            const currentStatus = meta.sandbox_status

            if (currentSandboxId) {
              console.log(`[chat:${sessionId}] Sandbox ready: ${currentSandboxId}`)
              await stream.writeSSE({
                event: 'status',
                data: JSON.stringify({
                  type: 'status',
                  status: 'sandbox-ready',
                  message: 'Sandbox ready',
                }),
              })
              break
            }

            if (currentStatus === 'error') {
              await stream.writeSSE({
                event: 'error',
                data: JSON.stringify({
                  error: 'Sandbox provisioning failed',
                  category: 'persistent',
                  retryable: true,
                }),
              })
              return
            }
          }

          if (!currentSandboxId) {
            await stream.writeSSE({
              event: 'error',
              data: JSON.stringify({
                error: 'Sandbox provisioning timed out',
                category: 'persistent',
                retryable: true,
              }),
            })
            return
          }
        }

        // Ensure we have a sandbox
        if (!currentSandboxId) {
          await stream.writeSSE({
            event: 'error',
            data: JSON.stringify({
              error: 'No sandbox available. Please refresh and try again.',
              category: 'persistent',
              retryable: false,
            }),
          })
          return
        }

        // Start sandbox-agent server if not running
        if (!currentSandboxAgentUrl) {
          console.log(`[chat:${sessionId}] Starting sandbox-agent server...`)
          await stream.writeSSE({
            event: 'status',
            data: JSON.stringify({
              type: 'status',
              status: 'starting-agent-server',
              message: 'Starting agent server...',
            }),
          })

          try {
            // Build env vars for the agent
            const envVars: Record<string, string> = {}
            if (c.env.ANTHROPIC_API_KEY) envVars.ANTHROPIC_API_KEY = c.env.ANTHROPIC_API_KEY
            if (c.env.OPENAI_API_KEY) envVars.OPENAI_API_KEY = c.env.OPENAI_API_KEY

            const { Sandbox } = await import('../lib/e2b')
            const sandbox = await Sandbox.connect(currentSandboxId, { apiKey: c.env.E2B_API_KEY })

            const { url } = await startSandboxAgentServer(sandbox, currentSandboxId, agentType, envVars)
            currentSandboxAgentUrl = url
            console.log(`[chat:${sessionId}] sandbox-agent server started at ${url}`)

            // Save URL
            await stub.fetch(
              new Request(`${doUrl}/meta`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sandbox_agent_url: url }),
              }),
            )

            // Send URL to frontend
            await stream.writeSSE({
              event: 'agent-url',
              data: JSON.stringify({
                type: 'agent-url',
                url,
              }),
            })
          } catch (error) {
            console.error(`[chat:${sessionId}] Failed to start sandbox-agent server:`, error)
            await stream.writeSSE({
              event: 'error',
              data: JSON.stringify({
                error: 'Failed to start agent server',
                details: error instanceof Error ? error.message : 'Unknown error',
                category: 'persistent',
                retryable: true,
              }),
            })
            return
          }
        }

        // Get latest metadata (repo info)
        const latestMetaRes = await stub.fetch(new Request(`${doUrl}/meta`))
        const latestMeta = (await latestMetaRes.json()) as Record<string, string>

        const repoOwner = latestMeta.repoOwner || latestMeta.repo_owner
        const repoName = latestMeta.repoName || latestMeta.repo_name
        const userId = latestMeta.userId || latestMeta.user_id
        const repoPath = '/home/user/repo'

        // Clone repo if needed
        if (repoOwner && repoName && !latestMeta.repo_url) {
          console.log(`[chat:${sessionId}] Cloning repository ${repoOwner}/${repoName}...`)
          await stream.writeSSE({
            event: 'status',
            data: JSON.stringify({
              type: 'status',
              status: 'cloning',
              message: `Cloning ${repoOwner}/${repoName}...`,
            }),
          })

          try {
            if (!userId) throw new Error('User ID not found')

            const accountRes = await c.env.DB.prepare(
              'SELECT access_token FROM accounts WHERE user_id = ? AND provider = ? LIMIT 1',
            )
              .bind(userId, 'github')
              .first<{ access_token: string }>()

            if (!accountRes?.access_token) throw new Error('No GitHub token found')

            const repoUrl = `https://github.com/${repoOwner}/${repoName}.git`
            const branchName = `ship-${Date.now()}-${sessionId.slice(0, 8)}`

            const { Sandbox } = await import('../lib/e2b')
            const sandbox = await Sandbox.connect(currentSandboxId, { apiKey: c.env.E2B_API_KEY })
            const authUrl = repoUrl.replace('https://', `https://${accountRes.access_token}@`)

            const cloneResult = await sandbox.commands.run(`git clone ${authUrl} ${repoPath}`)
            if (cloneResult.exitCode !== 0) throw new Error(`Git clone failed: ${cloneResult.stderr}`)

            await sandbox.commands.run(`cd ${repoPath} && git config user.name "Ship Agent"`)
            await sandbox.commands.run(`cd ${repoPath} && git config user.email "agent@ship.dev"`)
            await sandbox.commands.run(`cd ${repoPath} && git checkout -b ${branchName}`)

            await stub.fetch(
              new Request(`${doUrl}/meta`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  repo_url: repoUrl,
                  current_branch: branchName,
                  repo_path: repoPath,
                }),
              }),
            )

            console.log(`[chat:${sessionId}] Repository cloned successfully`)
            await stream.writeSSE({
              event: 'status',
              data: JSON.stringify({
                type: 'status',
                status: 'repo-ready',
                message: `Repository ready. Branch: ${branchName}`,
              }),
            })
          } catch (cloneError) {
            console.error(`[chat:${sessionId}] Clone failed:`, cloneError)
            await stream.writeSSE({
              event: 'error',
              data: JSON.stringify({
                error: 'Failed to clone repository',
                details: cloneError instanceof Error ? cloneError.message : String(cloneError),
                category: 'persistent',
                retryable: true,
              }),
            })
            return
          }
        }

        // Ensure we have sandbox-agent URL
        if (!currentSandboxAgentUrl) {
          console.error(`[chat:${sessionId}] No sandbox-agent URL available`)
          await stream.writeSSE({
            event: 'error',
            data: JSON.stringify({
              error: 'Agent server not started',
              category: 'persistent',
              retryable: true,
            }),
          })
          return
        }

        // Connect to sandbox-agent
        const client = await connectToSandboxAgent(currentSandboxAgentUrl)

        // Verify/create agent session
        if (currentAgentSessionId) {
          try {
            const existingSession = await resumeAgentSession(client, currentAgentSessionId)
            if (!existingSession) {
              console.log(`[chat:${sessionId}] Stored agent session is invalid, recreating...`)
              currentAgentSessionId = undefined
            }
          } catch {
            console.log(`[chat:${sessionId}] Failed to verify agent session, recreating...`)
            currentAgentSessionId = undefined
          }
        }

        let session
        if (!currentAgentSessionId) {
          console.log(`[chat:${sessionId}] Creating agent session for ${repoPath}...`)
          await stream.writeSSE({
            event: 'status',
            data: JSON.stringify({
              type: 'status',
              status: 'creating-session',
              message: 'Creating agent session...',
            }),
          })

          try {
            const result = await createAgentSession(client, agentType, repoPath)
            currentAgentSessionId = result.sessionId
            session = result.session
            console.log(`[chat:${sessionId}] Agent session created: ${currentAgentSessionId}`)

            // Save session ID and agent type
            await stub.fetch(
              new Request(`${doUrl}/meta`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  agent_session_id: currentAgentSessionId,
                  agent_type: agentType,
                }),
              }),
            )
          } catch (sessionError) {
            console.error(`[chat:${sessionId}] Failed to create agent session:`, sessionError)
            await stream.writeSSE({
              event: 'error',
              data: JSON.stringify({
                error: 'Failed to create agent session',
                details: sessionError instanceof Error ? sessionError.message : 'Unknown error',
                category: 'persistent',
                retryable: true,
              }),
            })
            return
          }
        } else {
          // Resume existing session
          session = await resumeAgentSession(client, currentAgentSessionId)
          if (!session) {
            // Recreate if resume fails
            const result = await createAgentSession(client, agentType, repoPath)
            currentAgentSessionId = result.sessionId
            session = result.session

            await stub.fetch(
              new Request(`${doUrl}/meta`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ agent_session_id: currentAgentSessionId }),
              }),
            )
          }
        }

        if (!session) {
          await stream.writeSSE({
            event: 'error',
            data: JSON.stringify({
              error: 'Failed to establish agent session',
              category: 'persistent',
              retryable: true,
            }),
          })
          return
        }

        // Set up event translator
        const translator = new EventTranslatorState(sessionId)

        // Register event handler BEFORE prompting
        let eventCount = 0
        let lastEventTime = Date.now()
        const EVENT_TIMEOUT_MS = 120000
        const HEARTBEAT_INTERVAL_MS = 10000

        const unsubscribe = subscribeToSessionEvents(session, async (event) => {
          lastEventTime = Date.now()
          eventCount++

          if (eventCount <= 20 || eventCount % 10 === 0) {
            console.log(`[chat:${sessionId}] Event #${eventCount}`)
          }

          // Translate universal event to Ship SSE events
          const sseEvents = translator.translateEvent(event)

          for (const sseEvent of sseEvents) {
            try {
              await stream.writeSSE({
                event: sseEvent.type,
                data: JSON.stringify(sseEvent),
              })
            } catch (sseError) {
              console.error(`[chat:${sessionId}] Failed to send SSE event:`, sseError)
            }

            // Broadcast to WebSocket clients
            try {
              await stub.fetch(
                new Request(`${doUrl}/broadcast`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ type: 'agent-event', event: sseEvent }),
                }),
              )
            } catch {
              // Ignore broadcast errors
            }
          }
        })

        // Heartbeat timer
        const heartbeatInterval = setInterval(async () => {
          const timeSinceLastEvent = Date.now() - lastEventTime
          if (timeSinceLastEvent > HEARTBEAT_INTERVAL_MS) {
            try {
              await stream.writeSSE({
                event: 'heartbeat',
                data: JSON.stringify({
                  type: 'heartbeat',
                  message: 'Waiting for agent response...',
                  eventCount,
                  timeSinceLastEvent: Math.floor(timeSinceLastEvent / 1000),
                }),
              })
            } catch {
              // Stream might be closed
            }
          }
        }, HEARTBEAT_INTERVAL_MS)

        // Event timeout
        const eventTimeout = setTimeout(async () => {
          if (eventCount === 0) {
            console.error(`[chat:${sessionId}] Event timeout after ${EVENT_TIMEOUT_MS / 1000}s`)
            try {
              await stream.writeSSE({
                event: 'error',
                data: JSON.stringify({
                  error: 'Agent did not respond in time',
                  details: `No events after ${EVENT_TIMEOUT_MS / 1000}s`,
                  category: 'persistent',
                  retryable: true,
                }),
              })
            } catch {
              // Stream might be closed
            }
          }
        }, EVENT_TIMEOUT_MS)

        // Send prompt status
        await stream.writeSSE({
          event: 'status',
          data: JSON.stringify({
            type: 'status',
            status: 'sending-prompt',
            message: 'Sending request to agent...',
          }),
        })

        // Send prompt — blocks until turn completes
        try {
          await executeWithRetry(
            async () => {
              await promptAgent(session!, content)
            },
            {
              operationName: 'Send prompt to agent',
              onError: async (error, attempt) => {
                console.error(`[chat:${sessionId}] Prompt error (attempt ${attempt}):`, error)
                const details = classifyError(error)
                await stream.writeSSE({
                  event: 'error',
                  data: JSON.stringify({
                    error: sanitizeError(error),
                    category: details.category,
                    retryable: details.retryable,
                    attempt,
                  }),
                })
              },
            },
          )
          console.log(`[chat:${sessionId}] Prompt completed`)
        } catch (promptError) {
          console.error(`[chat:${sessionId}] Failed to send prompt:`, promptError)
          await stream.writeSSE({
            event: 'error',
            data: JSON.stringify({
              error: 'Failed to send prompt to agent',
              details: promptError instanceof Error ? promptError.message : 'Unknown error',
              category: 'persistent',
              retryable: true,
            }),
          })
        } finally {
          clearTimeout(eventTimeout)
          clearInterval(heartbeatInterval)
          unsubscribe()
        }

        console.log(
          `[chat:${sessionId}] Event loop ended. Events: ${eventCount}, Content: ${translator.accumulatedText.length} chars`,
        )

        // Trigger git commit if there are changes
        if (translator.hasFileChanges) {
          try {
            await stub.fetch(
              new Request(`${doUrl}/agent/response`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  summary: translator.accumulatedText.slice(0, 100) || content.slice(0, 100),
                  hasChanges: true,
                }),
              }),
            )

            const gitStateRes = await stub.fetch(new Request(`${doUrl}/git/state`))
            const gitState = (await gitStateRes.json()) as {
              branchName: string | null
              pr: { number: number; url: string; draft: boolean } | null
            }

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
          } catch (gitError) {
            console.error(`[chat:${sessionId}] Git workflow error:`, gitError)
          }
        }

        // Persist assistant message
        const assistantContent = translator.accumulatedText
        if (assistantContent) {
          await stub.fetch(
            new Request(`${doUrl}/messages`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                role: 'assistant',
                content: assistantContent,
              }),
            }),
          )
        }

        // Send done event
        await stream.writeSSE({
          event: 'done',
          data: JSON.stringify({ type: 'done' }),
        })
        console.log(`[chat:${sessionId}] SSE stream completed successfully`)
      } catch (error) {
        console.error(`[chat:${sessionId}] Error in stream handler:`, error)
        const details = classifyError(error)
        const sanitized = sanitizeError(error)

        try {
          await stub.fetch(
            new Request(`${doUrl}/broadcast`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                type: 'error',
                error: sanitized,
                message: error instanceof Error ? error.message : String(error),
                category: details.category,
                retryable: details.retryable,
              }),
            }),
          )
        } catch {
          // Ignore broadcast errors
        }

        try {
          await stream.writeSSE({
            event: 'error',
            data: JSON.stringify({
              error: sanitized,
              message: error instanceof Error ? error.message : String(error),
              category: details.category,
              retryable: details.retryable,
            }),
          })
        } catch {
          // Stream might be closed
        }
      }
    })
  } catch (handlerError) {
    console.error(`[chat:${sessionId}] CRITICAL: Error before SSE:`, handlerError)
    return c.json(
      {
        error: 'Failed to start chat stream',
        details: handlerError instanceof Error ? handlerError.message : String(handlerError),
      },
      500,
    )
  }
})

// POST /chat/:sessionId/stop - Stop streaming
app.post('/:sessionId/stop', async (c) => {
  const sessionId = c.req.param('sessionId')

  const id = c.env.SESSION_DO.idFromName(sessionId)
  const stub = c.env.SESSION_DO.get(id)

  const metaRes = await stub.fetch(new Request('https://do/meta'))
  const meta = (await metaRes.json()) as Record<string, string>

  if (meta.agent_session_id && meta.sandbox_agent_url) {
    try {
      const client = await connectToSandboxAgent(meta.sandbox_agent_url)
      await cancelAgent(client, meta.agent_session_id)
    } catch (error) {
      console.warn(`[chat:${sessionId}] Cancel error:`, error)
    }
  }

  return c.json({ success: true })
})

// GET /chat/:sessionId/subagent/:subagentSessionId/stream - SSE stream for sub-agent session
app.get('/:sessionId/subagent/:subagentSessionId/stream', async (c) => {
  const sessionId = c.req.param('sessionId')
  const subagentSessionId = c.req.param('subagentSessionId')

  const id = c.env.SESSION_DO.idFromName(sessionId)
  const stub = c.env.SESSION_DO.get(id)

  const metaRes = await stub.fetch(new Request('https://do/meta'))
  const meta = (await metaRes.json()) as Record<string, string>
  const sandboxAgentUrl = meta.sandbox_agent_url

  if (!sandboxAgentUrl) {
    return c.json({ error: 'Agent server not available' }, 400)
  }

  return streamSSE(c, async (stream) => {
    try {
      const client = await connectToSandboxAgent(sandboxAgentUrl)
      const session = await resumeAgentSession(client, subagentSessionId)

      if (!session) {
        await stream.writeSSE({
          event: 'error',
          data: JSON.stringify({ error: 'Sub-agent session not found' }),
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

      // Keep stream open until session ends (timeout after 5 min)
      await new Promise((resolve) => setTimeout(resolve, 300000))
      unsubscribe()
    } catch (error) {
      console.error(`[chat:${sessionId}] Subagent stream error:`, error)
      await stream.writeSSE({
        event: 'error',
        data: JSON.stringify({ error: error instanceof Error ? error.message : 'Stream failed' }),
      })
    } finally {
      await stream.close()
    }
  })
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

// POST /chat/:sessionId/permission/:permissionId - Respond to permission request
app.post('/:sessionId/permission/:permissionId', async (c) => {
  const sessionId = c.req.param('sessionId')
  const permissionId = c.req.param('permissionId')

  const body = await c.req.json<{ reply: 'once' | 'always' | 'reject'; message?: string }>()

  const id = c.env.SESSION_DO.idFromName(sessionId)
  const stub = c.env.SESSION_DO.get(id)

  const metaRes = await stub.fetch(new Request('https://do/meta'))
  const meta = (await metaRes.json()) as Record<string, string>

  if (!meta.sandbox_agent_url) {
    return c.json({ error: 'Agent server not available' }, 400)
  }

  try {
    const client = await connectToSandboxAgent(meta.sandbox_agent_url)
    const agentSessionId = meta.agent_session_id
    if (!agentSessionId) {
      return c.json({ error: 'No active agent session' }, 400)
    }

    // Get the session and send permission reply via ACP
    const session = await resumeAgentSession(client, agentSessionId)
    if (!session) {
      return c.json({ error: 'Agent session not found' }, 400)
    }

    // Map Ship reply format to sandbox-agent/ACP permission reply
    // ACP uses: "accept", "accept_for_session", "reject"
    let acpReply: string
    switch (body.reply) {
      case 'once':
        acpReply = 'accept'
        break
      case 'always':
        acpReply = 'accept_for_session'
        break
      case 'reject':
        acpReply = 'reject'
        break
    }

    await session.send('permission/reply', {
      permission_id: permissionId,
      status: acpReply,
    })

    return c.json({ success: true })
  } catch (error) {
    console.error(`[chat:${sessionId}] Failed to respond to permission:`, error)
    return c.json({ error: error instanceof Error ? error.message : 'Failed to respond' }, 500)
  }
})

export default app
