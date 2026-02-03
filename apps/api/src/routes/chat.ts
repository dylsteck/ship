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

// Debug endpoint to verify deployment and test logging
app.get("/debug", (c) => {
  console.log("[chat:debug] Debug endpoint called")
  return c.json({ 
    status: "ok", 
    timestamp: new Date().toISOString(),
    version: "99-01-debug-v2",
    env: c.env.ENVIRONMENT
  })
})

// POST /chat/:sessionId - Send message and receive streaming response
app.post('/:sessionId', async (c) => {
  const sessionId = c.req.param('sessionId')
  console.log(`[chat:${sessionId}] ===== CHAT REQUEST STARTED =====`)

  const { content, mode = 'build' } = await c.req.json<{
    content: string
    mode?: 'build' | 'plan'
  }>()

  console.log(`[chat:${sessionId}] Mode: ${mode}, Content length: ${content?.length || 0}`)

  if (!content?.trim()) {
    return c.json({ error: 'Message content required' }, 400)
  }

  // Get DO stub
  const id = c.env.SESSION_DO.idFromName(sessionId)
  const stub = c.env.SESSION_DO.get(id)
  console.log(`[chat:${sessionId}] Got DO stub`)

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
  let opencodeUrl = meta.opencode_url // Get initial opencode URL from meta

  // Check if we're in development mode
  const isDev = c.env.ENVIRONMENT === 'development'

  // If sandbox is still provisioning, wait for it to complete (with timeout)
  // BUT: We need to start the SSE stream FIRST so UI gets updates
  // So we'll handle this inside the SSE stream handler instead
  const needsSandboxWait = !sandboxId && sandboxStatus === 'provisioning' && !isDev

  // All sandbox setup will happen INSIDE the SSE stream handler
  // so UI gets immediate feedback via SSE events
  console.log(
    `[chat:${sessionId}] Starting SSE stream immediately, mode=${mode}, model=${selectedModel}`,
  )

  // Stream OpenCode events as SSE
  return streamSSE(c, async (stream) => {
    try {
      // Send initial status event so UI knows we're working
      await stream.writeSSE({
        event: 'status',
        data: JSON.stringify({
          type: 'status',
          status: 'initializing',
          message: 'Preparing sandbox and agent...',
        }),
      })

      // If sandbox is still provisioning, wait for it WITH progress updates via SSE
      let currentSandboxId = sandboxId
      let currentSandboxStatus = sandboxStatus
      let currentOpencodeUrl = opencodeUrl || undefined
      let currentOpencodeSessionId = opencodeSessionId || undefined

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

        const maxWaitMs = 30000 // 30 seconds max wait (reduced from 60s)
        const pollIntervalMs = 1000 // Poll every 1 second (faster)
        const startTime = Date.now()
        let pollCount = 0
        let currentSandboxId = sandboxId
        let currentSandboxStatus = sandboxStatus

        while (Date.now() - startTime < maxWaitMs) {
          await new Promise((r) => setTimeout(r, pollIntervalMs))
          pollCount++

          // Re-fetch metadata to check sandbox status
          const metaRes = await stub.fetch(new Request(`${doUrl}/meta`))
          const meta = (await metaRes.json()) as Record<string, string>
          currentSandboxId = meta.sandbox_id
          currentSandboxStatus = meta.sandbox_status

          // Update progress every 3 seconds
          if (pollCount % 3 === 0) {
            const elapsed = pollCount
            console.log(`[chat:${sessionId}] Still waiting for sandbox... (${elapsed}s elapsed)`)
            await stream.writeSSE({
              event: 'status',
              data: JSON.stringify({
                type: 'status',
                status: 'provisioning',
                message: `Provisioning sandbox... (${elapsed}s)`,
              }),
            })
          }

          if (currentSandboxId) {
            // Broadcast sandbox ready status
            console.log(`[chat:${sessionId}] Sandbox provisioned: ${currentSandboxId}`)
            await stub.fetch(
              new Request(`${doUrl}/broadcast`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  type: 'sandbox-status',
                  sandboxId: currentSandboxId,
                  status: 'ready',
                }),
              }),
            )
            await stream.writeSSE({
              event: 'status',
              data: JSON.stringify({
                type: 'status',
                status: 'sandbox-ready',
                message: 'Sandbox ready, starting OpenCode server...',
              }),
            })
            // Update variables for rest of function
            currentSandboxId = currentSandboxId
            currentSandboxStatus = 'ready'
            break
          }

          if (currentSandboxStatus === 'error') {
            // Broadcast error status
            await stub.fetch(
              new Request(`${doUrl}/broadcast`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  type: 'sandbox-status',
                  status: 'error',
                }),
              }),
            )
            await stream.writeSSE({
              event: 'error',
              data: JSON.stringify({
                error: 'Sandbox provisioning failed. Please try again.',
                category: 'persistent',
                retryable: true,
              }),
            })
            return
          }
        }

        if (!currentSandboxId) {
          console.error(`[chat:${sessionId}] Sandbox provisioning timed out after ${maxWaitMs / 1000}s`)
          await stream.writeSSE({
            event: 'error',
            data: JSON.stringify({
              error: 'Sandbox provisioning timed out. Please try again.',
              category: 'persistent',
              retryable: true,
            }),
          })
          return
        }
      }

      // Update variables after sandbox wait
      if (needsSandboxWait) {
        const metaRes = await stub.fetch(new Request(`${doUrl}/meta`))
        const updatedMeta = (await metaRes.json()) as Record<string, string>
        currentSandboxId = updatedMeta.sandbox_id || currentSandboxId
        currentSandboxStatus = updatedMeta.sandbox_status || currentSandboxStatus
        currentOpencodeUrl = updatedMeta.opencode_url || currentOpencodeUrl
        currentOpencodeSessionId = updatedMeta.opencodeSessionId || currentOpencodeSessionId
      }

      // If no sandbox and not provisioning, we can't proceed in production
      if (!currentSandboxId && !isDev) {
        await stream.writeSSE({
          event: 'error',
          data: JSON.stringify({
            error: 'Sandbox not provisioned. Please refresh and try again.',
            category: 'persistent',
            retryable: false,
          }),
        })
        return
      }

      // If we have a sandbox but no OpenCode URL, start the OpenCode server
      if (currentSandboxId && !currentOpencodeUrl) {
        try {
          console.log(`[chat:${sessionId}] Starting OpenCode server in sandbox ${currentSandboxId}...`)
          await stream.writeSSE({
            event: 'status',
            data: JSON.stringify({
              type: 'status',
              status: 'starting-opencode',
              message: 'Starting OpenCode server...',
            }),
          })
          const startTime = Date.now()
          const { url } = await startOpenCodeServer(c.env.E2B_API_KEY, currentSandboxId, c.env.ANTHROPIC_API_KEY)
          const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
          currentOpencodeUrl = url
          console.log(`[chat:${sessionId}] OpenCode server started at ${url} (took ${elapsed}s)`)

          // Store the URL for future requests
          await stub.fetch(
            new Request(`${doUrl}/meta`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ opencode_url: url }),
            }),
          )

          // Broadcast OpenCode server started
          console.log(`[chat:${sessionId}] Broadcasting opencode-started event`)
          await stub.fetch(
            new Request(`${doUrl}/broadcast`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                type: 'opencode-started',
                url,
              }),
            }),
          )
        } catch (error) {
          console.error(`[chat:${sessionId}] Failed to start OpenCode server in sandbox:`, error)
          await stream.writeSSE({
            event: 'error',
            data: JSON.stringify({
              error: 'Failed to start agent server',
              details: error instanceof Error ? error.message : 'Unknown error',
              sandboxId,
              suggestion: 'The sandbox may need more time to initialize. Please refresh and try again.',
              category: 'persistent',
              retryable: true,
            }),
          })
          return
        }
      }

      // Clone repository if we have repo info but no repo_url yet
      // Re-fetch meta to get latest repo info
      const latestMetaRes = await stub.fetch(new Request(`${doUrl}/meta`))
      const latestMeta = (await latestMetaRes.json()) as Record<string, string>
      
      if (currentSandboxId && latestMeta.repo_owner && latestMeta.repo_name && !latestMeta.repo_url) {
        try {
          console.log(`[chat:${sessionId}] Repository not cloned yet, cloning now...`)
          const cloneStartTime = Date.now()

          await stream.writeSSE({
            event: 'status',
            data: JSON.stringify({
              type: 'status',
              status: 'cloning',
              message: `Cloning repository ${latestMeta.repo_owner}/${latestMeta.repo_name}...`,
            }),
          })

          // Broadcast cloning started
          await stub.fetch(
            new Request(`${doUrl}/broadcast`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                type: 'sandbox-cloning',
                repoOwner: latestMeta.repo_owner,
                repoName: latestMeta.repo_name,
              }),
            }),
          )

          // Get GitHub token from accounts
          const accountRes = await c.env.DB.prepare(
            'SELECT access_token FROM accounts WHERE user_id = ? AND provider = ? LIMIT 1',
          )
            .bind(latestMeta.user_id, 'github')
            .first<{ access_token: string }>()

          if (!accountRes?.access_token) {
            console.error(`[chat:${sessionId}] No GitHub token found for user`)
          } else {
            const repoUrl = `https://github.com/${latestMeta.repo_owner}/${latestMeta.repo_name}.git`
            const branchName = `ship-${Date.now()}-${sessionId.slice(0, 8)}`

            // Connect to sandbox and clone repo
            const { Sandbox } = await import('../lib/e2b')
            const sandbox = await Sandbox.connect(currentSandboxId, { apiKey: c.env.E2B_API_KEY })

            // Clone the repository
            const repoPath = '/home/user/repo'
            const authUrl = repoUrl.replace('https://', `https://${accountRes.access_token}@`)

            console.log(`[chat:${sessionId}] Cloning ${repoUrl}...`)
            const cloneResult = await sandbox.commands.run(`git clone ${authUrl} ${repoPath}`)

            if (cloneResult.exitCode !== 0) {
              throw new Error(`Git clone failed: ${cloneResult.stderr}`)
            }

            // Configure git user
            await sandbox.commands.run(`cd ${repoPath} && git config user.name "Ship Agent"`)
            await sandbox.commands.run(`cd ${repoPath} && git config user.email "agent@ship.dylansteck.com"`)

            // Create and checkout branch
            await sandbox.commands.run(`cd ${repoPath} && git checkout -b ${branchName}`)

            // Store repo info in session meta
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

            const cloneElapsed = ((Date.now() - cloneStartTime) / 1000).toFixed(1)
            console.log(`[chat:${sessionId}] Repository cloned and branch ${branchName} created (took ${cloneElapsed}s)`)

            // Broadcast cloning completed
            await stub.fetch(
              new Request(`${doUrl}/broadcast`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  type: 'sandbox-ready',
                  repoUrl,
                  branchName,
                }),
              }),
            )

            await stream.writeSSE({
              event: 'status',
              data: JSON.stringify({
                type: 'status',
                status: 'repo-ready',
                message: `Repository cloned. Branch: ${branchName}`,
              }),
            })

            // Initialize agent executor now that we have everything needed
            console.log(`[chat:${sessionId}] Initializing agent executor...`)

            try {
              await stub.fetch(
                new Request(`${doUrl}/agent/init`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    githubToken: accountRes.access_token,
                    gitUser: {
                      name: 'Ship Agent',
                      email: 'agent@ship.dylansteck.com',
                    },
                  }),
                }),
              )
              console.log(`[chat:${sessionId}] Agent executor initialized successfully`)
            } catch (initError) {
              console.error(`[chat:${sessionId}] Failed to initialize agent executor:`, initError)
              // Don't fail - chat can still work without agent executor
            }
          }
        } catch (error) {
          console.error(`[chat:${sessionId}] Failed to clone repository:`, error)
          await stream.writeSSE({
            event: 'status',
            data: JSON.stringify({
              type: 'status',
              status: 'warning',
              message: 'Repository cloning failed, continuing without repo...',
            }),
          })
          // Don't fail the chat - just log the error and continue
          // The agent can still work without a cloned repo
        }
      }

      if (!currentOpencodeSessionId) {
        // Create new OpenCode session
        console.log(`[chat:${sessionId}] Creating OpenCode session...`)
        const projectPath = latestMeta.repoPath || latestMeta.repo_path || '/home/user/repo'
        console.log(`[chat:${sessionId}] Project path: ${projectPath}`)

        try {
          const ocSession = await createOpenCodeSession(projectPath, currentOpencodeUrl)
          currentOpencodeSessionId = ocSession.id
          console.log(`[chat:${sessionId}] OpenCode session created: ${currentOpencodeSessionId}`)

          // Save to session meta
          await stub.fetch(
            new Request(`${doUrl}/meta`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ opencodeSessionId }),
            }),
          )
        } catch (sessionError) {
          console.error(`[chat:${sessionId}] Failed to create OpenCode session:`, sessionError)
          await stream.writeSSE({
            event: 'error',
            data: JSON.stringify({
              error: 'Failed to create OpenCode session',
              details: sessionError instanceof Error ? sessionError.message : 'Unknown error',
              category: 'persistent',
              retryable: true,
            }),
          })
          return
        }
      } else {
        console.log(`[chat:${sessionId}] Using existing OpenCode session: ${currentOpencodeSessionId}`)
      }

      if (!currentOpencodeSessionId) {
        await stream.writeSSE({
          event: 'error',
          data: JSON.stringify({
            error: 'Failed to create OpenCode session',
            category: 'persistent',
            retryable: true,
          }),
        })
        return
      }

      if (!currentOpencodeUrl) {
        await stream.writeSSE({
          event: 'error',
          data: JSON.stringify({
            error: 'OpenCode server URL not available',
            category: 'persistent',
            retryable: true,
          }),
        })
        return
      }

      console.log(`[chat:${sessionId}] SSE stream connected, sending prompt to OpenCode...`)
      await stream.writeSSE({
        event: 'status',
        data: JSON.stringify({
          type: 'status',
          status: 'sending-prompt',
          message: 'Sending prompt to agent...',
        }),
      })
      const promptStartTime = Date.now()
      // Send prompt to OpenCode with retry wrapper
      await executeWithRetry(
        async () => {
          await promptOpenCode(currentOpencodeSessionId!, content, { mode, model: selectedModel }, currentOpencodeUrl!)
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

      console.log(`[chat:${sessionId}] Prompt sent (took ${((Date.now() - promptStartTime) / 1000).toFixed(2)}s), subscribing to events...`)
      
      // Verify OpenCode server is still healthy before subscribing
      try {
        const { Sandbox } = await import('../lib/e2b')
        const sandbox = await Sandbox.connect(currentSandboxId, { apiKey: c.env.E2B_API_KEY })
        const healthCheck = await sandbox.commands.run('curl -s -o /dev/null -w "%{http_code}" http://localhost:4096/health')
        if (healthCheck.stdout.trim() !== '200') {
          throw new Error(`OpenCode server health check failed: ${healthCheck.stdout.trim()}`)
        }
        console.log(`[chat:${sessionId}] OpenCode server health check passed`)
      } catch (healthError) {
        console.error(`[chat:${sessionId}] OpenCode health check failed:`, healthError)
        await stream.writeSSE({
          event: 'error',
          data: JSON.stringify({
            error: 'OpenCode server is not responding. Please try again.',
            category: 'persistent',
            retryable: true,
          }),
        })
        return
      }

      // Subscribe to events and filter for this session
      const eventStream = await subscribeToEvents(currentOpencodeUrl)
      const sessionEvents = filterSessionEvents(eventStream, currentOpencodeSessionId!)
      console.log(`[chat:${sessionId}] Event subscription started, waiting for events...`)
      
      await stream.writeSSE({
        event: 'status',
        data: JSON.stringify({
          type: 'status',
          status: 'agent-active',
          message: 'Agent is processing your request...',
        }),
      })

      // Accumulate assistant message content
      let assistantContent = ''
      const parts: Part[] = []
      let currentMessageId: string | undefined
      let hasChanges = false
      let eventCount = 0
      let lastEventTime = Date.now()
      const EVENT_TIMEOUT_MS = 120000 // 2 minutes max wait for events
      const HEARTBEAT_INTERVAL_MS = 10000 // Send heartbeat every 10s if no events

      // Set up heartbeat timer
      const heartbeatInterval = setInterval(async () => {
        const timeSinceLastEvent = Date.now() - lastEventTime
        if (timeSinceLastEvent > HEARTBEAT_INTERVAL_MS) {
          await stream.writeSSE({
            event: 'heartbeat',
            data: JSON.stringify({
              type: 'heartbeat',
              message: 'Waiting for agent response...',
              eventCount,
              timeSinceLastEvent: Math.floor(timeSinceLastEvent / 1000),
            }),
          })
        }
      }, HEARTBEAT_INTERVAL_MS)

      try {
        // Process events with timeout
        const eventTimeout = setTimeout(async () => {
          console.error(`[chat:${sessionId}] Event timeout after ${EVENT_TIMEOUT_MS / 1000}s, no events received`)
          await stream.writeSSE({
            event: 'error',
            data: JSON.stringify({
              error: 'Agent did not respond in time. The request may have timed out.',
              category: 'persistent',
              retryable: true,
            }),
          })
        }, EVENT_TIMEOUT_MS)

        // Process events
        for await (const event of sessionEvents) {
          clearTimeout(eventTimeout) // Reset timeout on each event
          lastEventTime = Date.now()
        eventCount++
        if (eventCount <= 10 || eventCount % 50 === 0) {
          console.log(`[chat:${sessionId}] Event #${eventCount}: type=${event.type}`)
        }

        // Stream event to client
        await stream.writeSSE({
          event: 'event',
          data: JSON.stringify(event),
        })

        // Broadcast to WebSocket clients via DO
        if (eventCount <= 5 || eventCount % 20 === 0) {
          console.log(`[chat:${sessionId}] Broadcasting event #${eventCount} type=${event.type} to WebSocket clients`)
        }
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
            console.log(`[chat:${sessionId}] Session idle, stopping event loop after ${eventCount} events`)
            clearTimeout(eventTimeout)
            break
          }
        }

        clearTimeout(eventTimeout) // Clear timeout if we exit normally
      } finally {
        clearInterval(heartbeatInterval) // Always clear heartbeat
      }

      console.log(
        `[chat:${sessionId}] Event loop ended, total events: ${eventCount}, assistantContent length: ${assistantContent.length}, parts: ${parts.length}`,
      )

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
      console.log(`[chat:${sessionId}] SSE stream completed successfully`)
    } catch (error) {
      console.error(`[chat:${sessionId}] OpenCode error:`, error)

      // Classify and report error
      const details = classifyError(error)
      const sanitized = sanitizeError(error)

      // Broadcast error to WebSocket clients too
      try {
        await stub.fetch(
          new Request(`${doUrl}/broadcast`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: 'error',
              error: sanitized,
              category: details.category,
              retryable: details.retryable,
            }),
          }),
        )
      } catch (broadcastError) {
        console.error(`[chat:${sessionId}] Failed to broadcast error:`, broadcastError)
      }

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
