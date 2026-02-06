import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import {
  createOpenCodeSession,
  promptOpenCode,
  stopOpenCode,
  subscribeToEvents,
  filterSessionEvents,
  getOpenCodeClient,
  getSessionInfo,
  type Event,
  type Part,
} from '../lib/opencode'
import { startOpenCodeServer } from '../lib/e2b'
import { executeWithRetry, classifyError, sanitizeError } from '../lib/error-handler'
import type { Env } from '../env.d'

const app = new Hono<{ Bindings: Env }>()

// Debug endpoint to verify deployment and test logging
app.get('/debug', (c) => {
  console.log('[chat:debug] Debug endpoint called')
  return c.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: 'v2-refactor',
    env: c.env.ENVIRONMENT,
  })
})

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

  let opencodeSessionId = meta.opencodeSessionId
  const selectedModel = meta.model || meta.selected_model
  let sandboxId = meta.sandbox_id
  let sandboxStatus = meta.sandbox_status
  let opencodeUrl = meta.opencode_url

  console.log(
    `[chat:${sessionId}] Meta: sandboxId=${sandboxId}, opencodeUrl=${opencodeUrl}, opencodeSessionId=${opencodeSessionId}`,
  )
  console.log(`[chat:${sessionId}] Model: ${selectedModel || 'default'}`)

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

        // Track current state - explicitly type to allow undefined
        let currentSandboxId: string | undefined = sandboxId
        let currentOpencodeUrl: string | undefined = opencodeUrl
        let currentOpencodeSessionId: string | undefined = opencodeSessionId

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

        // Start OpenCode server if not running
        if (!currentOpencodeUrl) {
          console.log(`[chat:${sessionId}] Starting OpenCode server...`)
          await stream.writeSSE({
            event: 'status',
            data: JSON.stringify({
              type: 'status',
              status: 'starting-opencode',
              message: 'Starting agent server...',
            }),
          })

          try {
            const { url } = await startOpenCodeServer(c.env.E2B_API_KEY, currentSandboxId, c.env.ANTHROPIC_API_KEY)
            currentOpencodeUrl = url
            console.log(`[chat:${sessionId}] OpenCode server started at ${url}`)

            // Save URL
            await stub.fetch(
              new Request(`${doUrl}/meta`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ opencode_url: url }),
              }),
            )

            // Send URL to frontend
            await stream.writeSSE({
              event: 'opencode-url',
              data: JSON.stringify({
                type: 'opencode-url',
                url: url,
              }),
            })
          } catch (error) {
            console.error(`[chat:${sessionId}] Failed to start OpenCode server:`, error)
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
            // Get GitHub token
            if (!userId) throw new Error('User ID not found')

            const accountRes = await c.env.DB.prepare(
              'SELECT access_token FROM accounts WHERE user_id = ? AND provider = ? LIMIT 1',
            )
              .bind(userId, 'github')
              .first<{ access_token: string }>()

            if (!accountRes?.access_token) throw new Error('No GitHub token found')

            const repoUrl = `https://github.com/${repoOwner}/${repoName}.git`
            const branchName = `ship-${Date.now()}-${sessionId.slice(0, 8)}`

            // Clone in sandbox
            const { Sandbox } = await import('../lib/e2b')
            const sandbox = await Sandbox.connect(currentSandboxId, { apiKey: c.env.E2B_API_KEY })
            const authUrl = repoUrl.replace('https://', `https://${accountRes.access_token}@`)

            const cloneResult = await sandbox.commands.run(`git clone ${authUrl} ${repoPath}`)
            if (cloneResult.exitCode !== 0) throw new Error(`Git clone failed: ${cloneResult.stderr}`)

            // Configure git
            await sandbox.commands.run(`cd ${repoPath} && git config user.name "Ship Agent"`)
            await sandbox.commands.run(`cd ${repoPath} && git config user.email "agent@ship.dylansteck.com"`)
            await sandbox.commands.run(`cd ${repoPath} && git checkout -b ${branchName}`)

            // Save repo info
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

        // Ensure we have OpenCode URL before proceeding
        if (!currentOpencodeUrl) {
          console.error(`[chat:${sessionId}] No OpenCode URL available`)
          await stream.writeSSE({
            event: 'error',
            data: JSON.stringify({
              error: 'OpenCode server not started',
              category: 'persistent',
              retryable: true,
            }),
          })
          return
        }

        // Verify/create OpenCode session
        if (currentOpencodeSessionId) {
          // Verify existing session is still valid
          try {
            const sessionInfo = await getSessionInfo(currentOpencodeSessionId, currentOpencodeUrl, repoPath)
            if (!sessionInfo) {
              console.log(`[chat:${sessionId}] Stored OpenCode session is invalid, recreating...`)
              currentOpencodeSessionId = undefined
            }
          } catch {
            console.log(`[chat:${sessionId}] Failed to verify OpenCode session, recreating...`)
            currentOpencodeSessionId = undefined
          }
        }

        if (!currentOpencodeSessionId) {
          console.log(`[chat:${sessionId}] Creating OpenCode session for ${repoPath}...`)
          await stream.writeSSE({
            event: 'status',
            data: JSON.stringify({
              type: 'status',
              status: 'creating-session',
              message: 'Creating agent session...',
            }),
          })

          try {
            const ocSession = await createOpenCodeSession(repoPath, currentOpencodeUrl)
            currentOpencodeSessionId = ocSession.id
            console.log(`[chat:${sessionId}] OpenCode session created: ${currentOpencodeSessionId}`)

            // Save session ID
            await stub.fetch(
              new Request(`${doUrl}/meta`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ opencodeSessionId: currentOpencodeSessionId }),
              }),
            )

            // Give OpenCode a moment to initialize
            await new Promise((resolve) => setTimeout(resolve, 500))
          } catch (sessionError) {
            console.error(`[chat:${sessionId}] Failed to create OpenCode session:`, sessionError)
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
        }

        // Subscribe to events BEFORE sending prompt
        console.log(`[chat:${sessionId}] Subscribing to events...`)
        let eventStream: AsyncIterable<Event>
        try {
          eventStream = await subscribeToEvents(currentOpencodeUrl, repoPath)
          console.log(`[chat:${sessionId}] Event subscription successful`)
        } catch (streamError) {
          console.error(`[chat:${sessionId}] Failed to subscribe to events:`, streamError)
          await stream.writeSSE({
            event: 'error',
            data: JSON.stringify({
              error: 'Failed to subscribe to agent events',
              details: streamError instanceof Error ? streamError.message : 'Unknown error',
              category: 'persistent',
              retryable: true,
            }),
          })
          return
        }

        // Filter events for this session
        const sessionEvents = filterSessionEvents(eventStream, currentOpencodeSessionId)

        // Wait a moment to ensure subscription is ready
        await new Promise((resolve) => setTimeout(resolve, 300))

        // Send prompt
        console.log(`[chat:${sessionId}] Sending prompt (${content.length} chars)...`)
        await stream.writeSSE({
          event: 'status',
          data: JSON.stringify({
            type: 'status',
            status: 'sending-prompt',
            message: 'Sending request to agent...',
          }),
        })

        try {
          await executeWithRetry(
            async () => {
              await promptOpenCode(
                currentOpencodeSessionId!,
                content,
                { mode, model: selectedModel },
                currentOpencodeUrl,
                repoPath,
              )
            },
            {
              operationName: 'Send prompt to OpenCode',
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
          console.log(`[chat:${sessionId}] Prompt sent successfully`)
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
          return
        }

        // Notify that we're waiting for events
        await stream.writeSSE({
          event: 'status',
          data: JSON.stringify({
            type: 'status',
            status: 'agent-active',
            message: 'Agent is processing your request...',
          }),
        })

        // Process events
        console.log(`[chat:${sessionId}] Starting event processing loop...`)
        let assistantContent = ''
        const parts: Part[] = []
        let eventCount = 0
        let lastEventTime = Date.now()
        let hasChanges = false
        const EVENT_TIMEOUT_MS = 120000
        const HEARTBEAT_INTERVAL_MS = 10000

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

        try {
          const eventTimeout = setTimeout(async () => {
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
          }, EVENT_TIMEOUT_MS)

          try {
            for await (const event of sessionEvents) {
              clearTimeout(eventTimeout)
              lastEventTime = Date.now()
              eventCount++

              // Log events for debugging
              if (eventCount <= 20 || eventCount % 10 === 0) {
                console.log(`[chat:${sessionId}] Event #${eventCount}: ${event.type}`)
              }

              // Send event to client
              try {
                await stream.writeSSE({
                  event: 'event',
                  data: JSON.stringify(event),
                })
              } catch (sseError) {
                console.error(`[chat:${sessionId}] Failed to send event via SSE:`, sseError)
                break
              }

              // Broadcast to WebSocket clients
              await stub.fetch(
                new Request(`${doUrl}/broadcast`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ type: 'opencode-event', event }),
                }),
              )

              // Process event based on type
              switch (event.type) {
                case 'message.part.updated': {
                  const part = event.properties.part
                  parts.push(part)

                  // Accumulate text content
                  if (part.type === 'text') {
                    // Use delta for incremental text, or full text if no delta
                    const delta = event.properties.delta
                    if (delta) {
                      assistantContent += delta
                    } else if (part.text) {
                      assistantContent = part.text
                    }
                  }

                  // Track file changes for git
                  if (part.type === 'tool') {
                    const toolName = part.tool
                    if (toolName?.includes('write') || toolName?.includes('edit') || toolName?.includes('create')) {
                      hasChanges = true
                    }

                    // Send tool status
                    const state = part.state
                    if (state) {
                      await stream.writeSSE({
                        event: 'status',
                        data: JSON.stringify({
                          type: 'status',
                          status: 'tool-call',
                          message: `Using tool: ${toolName}`,
                          toolName,
                          toolStatus: state.status,
                        }),
                      })
                    }
                  }
                  break
                }

                case 'todo.updated': {
                  const todos = event.properties.todos || []
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

                case 'permission.asked': {
                  await stream.writeSSE({
                    event: 'permission',
                    data: JSON.stringify({
                      id: event.properties.id,
                      permission: event.properties.permission,
                      patterns: event.properties.patterns,
                      metadata: event.properties.metadata,
                    }),
                  })
                  break
                }

                case 'session.idle': {
                  console.log(`[chat:${sessionId}] Session idle - agent finished`)

                  // Trigger git commit if there are changes
                  if (hasChanges) {
                    try {
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

                      // Get PR info
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
                  break
                }

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

              // Stop on terminal events
              if (event.type === 'session.idle' || event.type === 'session.error') {
                break
              }
            }
          } finally {
            clearTimeout(eventTimeout)
          }
        } finally {
          clearInterval(heartbeatInterval)
        }

        console.log(
          `[chat:${sessionId}] Event loop ended. Events: ${eventCount}, Content: ${assistantContent.length} chars`,
        )

        // Persist assistant message
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

        // Broadcast to WebSocket
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

        // Send via SSE
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

  if (meta.opencodeSessionId && meta.opencode_url) {
    const repoPath = meta.repo_path || '/home/user/repo'
    await stopOpenCode(meta.opencodeSessionId, meta.opencode_url, repoPath)
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

  if (!meta.opencode_url) {
    return c.json({ error: 'OpenCode server not available' }, 400)
  }

  try {
    const repoPath = meta.repo_path || '/home/user/repo'
    const client = getOpenCodeClient(meta.opencode_url, repoPath)

    await client.permission.reply({
      requestID: permissionId,
      reply: body.reply,
      message: body.message,
    })

    return c.json({ success: true })
  } catch (error) {
    console.error(`[chat:${sessionId}] Failed to respond to permission:`, error)
    return c.json({ error: error instanceof Error ? error.message : 'Failed to respond' }, 500)
  }
})

export default app
