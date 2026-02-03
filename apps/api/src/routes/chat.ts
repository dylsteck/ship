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
  // Use both console.log and console.error to ensure logs are captured
  console.error(`[chat:${sessionId}] ===== CHAT REQUEST STARTED =====`)
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

  console.error(`[chat:${sessionId}] Mode: ${mode}, Content length: ${content?.length || 0}`)
  console.log(`[chat:${sessionId}] Mode: ${mode}, Content length: ${content?.length || 0}`)

  if (!content?.trim()) {
    return c.json({ error: 'Message content required' }, 400)
  }

  // Get DO stub
  const id = c.env.SESSION_DO.idFromName(sessionId)
  const stub = c.env.SESSION_DO.get(id)
  console.error(`[chat:${sessionId}] Got DO stub`)
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
  // Model is stored as 'model' in sessions.ts, but may also be 'selected_model' for backwards compat
  const selectedModel = meta.model || meta.selected_model // Per-session model preference
  console.error(`[chat:${sessionId}] Model from meta: model=${meta.model}, selected_model=${meta.selected_model}, using: ${selectedModel}`)
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
  console.error(`[chat:${sessionId}] Starting SSE stream immediately, mode=${mode}, model=${selectedModel}`)
  console.log(`[chat:${sessionId}] Starting SSE stream immediately, mode=${mode}, model=${selectedModel}`)

  // Stream OpenCode events as SSE
  try {
    return streamSSE(c, async (stream) => {
    console.error(`[chat:${sessionId}] SSE stream handler started`)
    console.log(`[chat:${sessionId}] SSE stream handler started`)
    
    try {
      // Send initial status event so UI knows we're working
      console.error(`[chat:${sessionId}] Sending initial status event`)
      await stream.writeSSE({
        event: 'status',
        data: JSON.stringify({
          type: 'status',
          status: 'initializing',
          message: 'Preparing sandbox and agent...',
        }),
      })
      console.error(`[chat:${sessionId}] Initial status event sent`)

      // Initialize variables safely - ensure all are defined
      let currentSandboxId: string | undefined = sandboxId || undefined
      let currentSandboxStatus: string | undefined = sandboxStatus || undefined
      let currentOpencodeUrl: string | undefined = opencodeUrl || undefined
      let currentOpencodeSessionId: string | undefined = opencodeSessionId || undefined

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

      // Re-fetch meta to get latest repo info before OpenCode session creation
      let latestMetaRes = await stub.fetch(new Request(`${doUrl}/meta`))
      let latestMeta = (await latestMetaRes.json()) as Record<string, string>

      if (!currentOpencodeSessionId) {
        // Create new OpenCode session
        console.error(`[chat:${sessionId}] ===== CREATING OPENCODE SESSION =====`)
        console.log(`[chat:${sessionId}] Creating OpenCode session...`)
        
        // CRITICAL: Ensure repo is cloned BEFORE creating OpenCode session
        // Re-fetch meta to get latest repo status
        latestMetaRes = await stub.fetch(new Request(`${doUrl}/meta`))
        latestMeta = (await latestMetaRes.json()) as Record<string, string>
        
        const repoPath = '/home/user/repo'
        let repoExists = false

        const repoOwner = latestMeta.repoOwner || latestMeta.repo_owner
        const repoName = latestMeta.repoName || latestMeta.repo_name
        const userId = latestMeta.userId || latestMeta.user_id

        if (!repoOwner || !repoName) {
          console.error(`[chat:${sessionId}] Missing repository metadata; cannot clone repo`)
          await stream.writeSSE({
            event: 'error',
            data: JSON.stringify({
              error: 'Repository metadata missing. Please refresh and try again.',
              category: 'persistent',
              retryable: true,
            }),
          })
          return
        }
        
        // ALWAYS check if repo exists and clone if needed
        if (repoOwner && repoName && currentSandboxId) {
          console.error(`[chat:${sessionId}] Checking repo status: owner=${repoOwner}, name=${repoName}`)
          
          // Check if repo directory exists in sandbox
          try {
            const { Sandbox } = await import('../lib/e2b')
            const sandbox = await Sandbox.connect(currentSandboxId, { apiKey: c.env.E2B_API_KEY })
            const checkResult = await sandbox.commands.run(`test -d ${repoPath} && echo "EXISTS" || echo "NOT_FOUND"`)
            repoExists = checkResult.stdout.trim() === 'EXISTS'
            console.error(`[chat:${sessionId}] Repo directory check: ${repoExists ? 'EXISTS' : 'NOT_FOUND'} at ${repoPath}`)
            console.log(`[chat:${sessionId}] Repo directory check: ${repoExists ? 'EXISTS' : 'NOT_FOUND'} at ${repoPath}`)
          } catch (checkError) {
            console.error(`[chat:${sessionId}] Could not verify repo existence:`, checkError)
            console.warn(`[chat:${sessionId}] Could not verify repo existence:`, checkError)
          }
          
          // If repo doesn't exist, clone it NOW
          if (!repoExists) {
            console.error(`[chat:${sessionId}] ===== CLONING REPO BEFORE OPENCODE SESSION =====`)
            console.log(`[chat:${sessionId}] Repo not cloned yet, cloning now before creating OpenCode session...`)
            
            await stream.writeSSE({
              event: 'status',
              data: JSON.stringify({
                type: 'status',
                status: 'cloning',
                message: `Cloning repository ${repoOwner}/${repoName}...`,
              }),
            })
            
            try {
              // Get GitHub token
              if (!userId) {
                throw new Error('User ID not found for session')
              }
              const accountRes = await c.env.DB.prepare(
                'SELECT access_token FROM accounts WHERE user_id = ? AND provider = ? LIMIT 1',
              )
                .bind(userId, 'github')
                .first<{ access_token: string }>()

              if (!accountRes?.access_token) {
                throw new Error('No GitHub token found')
              }

              const repoUrl = `https://github.com/${repoOwner}/${repoName}.git`
              const branchName = `ship-${Date.now()}-${sessionId.slice(0, 8)}`

              // Connect to sandbox and clone repo
              const { Sandbox } = await import('../lib/e2b')
              const sandbox = await Sandbox.connect(currentSandboxId, { apiKey: c.env.E2B_API_KEY })
              const authUrl = repoUrl.replace('https://', `https://${accountRes.access_token}@`)

              console.error(`[chat:${sessionId}] Cloning ${repoUrl} to ${repoPath}...`)
              console.log(`[chat:${sessionId}] Cloning ${repoUrl}...`)
              
              const cloneResult = await sandbox.commands.run(`git clone ${authUrl} ${repoPath}`)

              if (cloneResult.exitCode !== 0) {
                throw new Error(`Git clone failed: ${cloneResult.stderr}`)
              }

              // Configure git and create branch
              await sandbox.commands.run(`cd ${repoPath} && git config user.name "Ship Agent"`)
              await sandbox.commands.run(`cd ${repoPath} && git config user.email "agent@ship.dylansteck.com"`)
              await sandbox.commands.run(`cd ${repoPath} && git checkout -b ${branchName}`)

              // Verify repo was cloned
              const verifyResult = await sandbox.commands.run(`test -d ${repoPath} && echo "EXISTS" || echo "NOT_FOUND"`)
              if (verifyResult.stdout.trim() !== 'EXISTS') {
                throw new Error('Repo directory not found after clone')
              }

              // Store repo info
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

              // Re-fetch meta to get updated repo_path
              latestMetaRes = await stub.fetch(new Request(`${doUrl}/meta`))
              latestMeta = (await latestMetaRes.json()) as Record<string, string>
              repoExists = true
              
              console.error(`[chat:${sessionId}] ✓ Repo cloned successfully, path: ${repoPath}`)
              console.log(`[chat:${sessionId}] ✓ Repo cloned successfully, path: ${repoPath}`)
              
              await stream.writeSSE({
                event: 'status',
                data: JSON.stringify({
                  type: 'status',
                  status: 'repo-ready',
                  message: `Repository cloned. Branch: ${branchName}`,
                }),
              })
            } catch (cloneError) {
              console.error(`[chat:${sessionId}] ✗ Failed to clone repo:`, cloneError)
              console.error(`[chat:${sessionId}] Clone error details:`, cloneError instanceof Error ? {
                message: cloneError.message,
                stack: cloneError.stack
              } : cloneError)
              
              await stream.writeSSE({
                event: 'error',
                data: JSON.stringify({
                  error: 'Failed to clone repository',
                  details: cloneError instanceof Error ? cloneError.message : String(cloneError),
                  category: 'persistent',
                  retryable: true,
                }),
              })
              // Don't continue - OpenCode needs the repo to work properly
              return
            }
          } else {
            console.error(`[chat:${sessionId}] ✓ Repo already exists at ${repoPath}`)
            console.log(`[chat:${sessionId}] ✓ Repo already exists at ${repoPath}`)
          }
        }
        
        // Use repoPath (always /home/user/repo if repo was cloned)
        const projectPath = repoExists ? repoPath : (latestMeta.repo_path || latestMeta.repoPath || '/home/user/repo')
        console.error(`[chat:${sessionId}] Using project path: ${projectPath}, repo exists: ${repoExists}`)
        console.log(`[chat:${sessionId}] Project path: ${projectPath}`)
        console.log(`[chat:${sessionId}] Repo URL: ${latestMeta.repo_url || 'none'}`)
        console.log(`[chat:${sessionId}] Repo cloned: ${!!latestMeta.repo_url}`)
        console.log(`[chat:${sessionId}] Repo exists in sandbox: ${repoExists}`)

        if (!repoExists && repoOwner && repoName) {
          console.error(`[chat:${sessionId}] ✗ CRITICAL: Repo should exist but doesn't! Cannot create OpenCode session.`)
          await stream.writeSSE({
            event: 'error',
            data: JSON.stringify({
              error: 'Repository not found. Please try again.',
              category: 'persistent',
              retryable: true,
            }),
          })
          return
        }

        try {
          const ocSession = await createOpenCodeSession(projectPath, currentOpencodeUrl)
          currentOpencodeSessionId = ocSession.id
          console.error(`[chat:${sessionId}] ✓ OpenCode session created: ${currentOpencodeSessionId}`)
          console.log(`[chat:${sessionId}] ✓ OpenCode session created: ${currentOpencodeSessionId}`)
          console.error(`[chat:${sessionId}] Session project path: ${ocSession.projectPath}`)
          console.log(`[chat:${sessionId}] Session project path: ${ocSession.projectPath}`)
          
          // CRITICAL: Verify session exists and is ready before proceeding
          // Give OpenCode a moment to initialize the session
          await new Promise(resolve => setTimeout(resolve, 1000))
          
          // Verify session by checking if we can access it
          try {
            const { getOpenCodeClient } = await import('../lib/opencode')
            const verifyClient = await getOpenCodeClient(currentOpencodeUrl)
            const sessionCheck = await verifyClient.session.get({ path: { id: currentOpencodeSessionId } })
            if (sessionCheck.error) {
              console.error(`[chat:${sessionId}] ⚠️ Session verification failed:`, sessionCheck.error)
            } else {
              console.error(`[chat:${sessionId}] ✓ Session verified and ready`)
              console.log(`[chat:${sessionId}] ✓ Session verified and ready`)
            }
          } catch (verifyError) {
            console.error(`[chat:${sessionId}] ⚠️ Could not verify session:`, verifyError)
            // Continue anyway - session might still work
          }

          // Save to session meta
          await stub.fetch(
            new Request(`${doUrl}/meta`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ opencodeSessionId: currentOpencodeSessionId }),
            }),
          )

          // Broadcast session created event so frontend can update
          await stub.fetch(
            new Request(`${doUrl}/broadcast`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                type: 'opencode-session-created',
                sessionId: currentOpencodeSessionId,
              }),
            }),
          )
        } catch (sessionError) {
          console.error(`[chat:${sessionId}] ✗ Failed to create OpenCode session:`, sessionError)
          console.error(`[chat:${sessionId}] Error details:`, sessionError instanceof Error ? {
            message: sessionError.message,
            stack: sessionError.stack,
            name: sessionError.name
          } : sessionError)
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

      // Verify OpenCode server is still healthy before subscribing
      if (!currentSandboxId) {
        await stream.writeSSE({
          event: 'error',
          data: JSON.stringify({
            error: 'Sandbox not available for health check',
            category: 'persistent',
            retryable: true,
          }),
        })
        return
      }

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

      // Subscribe to events BEFORE sending prompt so we don't miss any events
      console.error(`[chat:${sessionId}] ===== SUBSCRIBING TO EVENTS =====`)
      console.log(`[chat:${sessionId}] ===== SUBSCRIBING TO EVENTS =====`)
      console.error(`[chat:${sessionId}] OpenCode URL: ${currentOpencodeUrl}`)
      console.log(`[chat:${sessionId}] OpenCode URL: ${currentOpencodeUrl}`)
      console.error(`[chat:${sessionId}] OpenCode Session ID: ${currentOpencodeSessionId}`)
      console.log(`[chat:${sessionId}] OpenCode Session ID: ${currentOpencodeSessionId}`)
      
      // Get the project directory for directory-scoped events
      const projectPath = latestMeta.repo_path || latestMeta.repoPath || '/home/user/repo'
      console.error(`[chat:${sessionId}] Subscribing to directory-scoped events for: ${projectPath}`)
      console.log(`[chat:${sessionId}] Project directory: ${projectPath}`)
      
      let eventStream: AsyncIterable<Event>
      try {
        const subscribeStartTime = Date.now()
        eventStream = await subscribeToEvents(currentOpencodeUrl, projectPath)
        const subscribeElapsed = ((Date.now() - subscribeStartTime) / 1000).toFixed(2)
        console.log(`[chat:${sessionId}] ✓ Successfully subscribed to event stream (took ${subscribeElapsed}s)`)
        console.log(`[chat:${sessionId}] Event stream type: ${typeof eventStream}, isAsyncIterable: ${Symbol.asyncIterator in eventStream}`)
        
        // Verify the stream is actually iterable
        if (!eventStream || typeof eventStream[Symbol.asyncIterator] !== 'function') {
          throw new Error(`Event stream is not async iterable. Type: ${typeof eventStream}`)
        }
        console.log(`[chat:${sessionId}] ✓ Event stream is async iterable`)
      } catch (streamError) {
        console.error(`[chat:${sessionId}] ✗ Failed to subscribe to events:`, streamError)
        console.error(`[chat:${sessionId}] Error details:`, streamError instanceof Error ? {
          message: streamError.message,
          stack: streamError.stack,
          name: streamError.name
        } : streamError)
        await stream.writeSSE({
          event: 'error',
          data: JSON.stringify({
            error: 'Failed to subscribe to agent events. Please try again.',
            details: streamError instanceof Error ? streamError.message : 'Unknown error',
            category: 'persistent',
            retryable: true,
          }),
        })
        return
      }
      
      // CRITICAL: Wait a moment after subscribing to ensure event stream is ready
      // This ensures we don't miss the first events
      await new Promise(resolve => setTimeout(resolve, 500))
      
      // Filter events for this session
      const sessionEvents = filterSessionEvents(eventStream, currentOpencodeSessionId!)
      console.error(`[chat:${sessionId}] ✓ Event filter created for session ${currentOpencodeSessionId}`)
      console.log(`[chat:${sessionId}] ✓ Event filter created for session ${currentOpencodeSessionId}`)
      console.error(`[chat:${sessionId}] ===== READY TO SEND PROMPT =====`)
      console.log(`[chat:${sessionId}] ===== READY TO SEND PROMPT =====`)

      console.error(`[chat:${sessionId}] ===== SENDING PROMPT =====`)
      console.log(`[chat:${sessionId}] ===== SENDING PROMPT =====`)
      console.error(`[chat:${sessionId}] Prompt length: ${content.length} chars, mode: ${mode}, model: ${selectedModel || 'default'}`)
      console.log(`[chat:${sessionId}] Prompt length: ${content.length} chars, mode: ${mode}, model: ${selectedModel || 'default'}`)
      console.error(`[chat:${sessionId}] OpenCode Session ID: ${currentOpencodeSessionId}`)
      console.error(`[chat:${sessionId}] OpenCode URL: ${currentOpencodeUrl}`)
      console.error(`[chat:${sessionId}] Prompt content: ${content.slice(0, 100)}...`)
      
      await stream.writeSSE({
        event: 'status',
        data: JSON.stringify({
          type: 'status',
          status: 'sending-prompt',
          message: 'Sending prompt to agent...',
        }),
      })
      const promptStartTime = Date.now()
      
      // CRITICAL: Start event loop BEFORE sending prompt to ensure we catch all events
      // The event loop runs in parallel with prompt sending
      const eventLoopPromise = (async () => {
        console.error(`[chat:${sessionId}] Starting event loop in parallel with prompt...`)
        // This will be handled in the main event loop below
      })()
      
      // Send prompt to OpenCode with retry wrapper
      try {
        await executeWithRetry(
          async () => {
            console.error(`[chat:${sessionId}] Calling promptOpenCode with session ${currentOpencodeSessionId?.slice(0, 8)}...`)
            console.log(`[chat:${sessionId}] Calling promptOpenCode with session ${currentOpencodeSessionId?.slice(0, 8)}...`)
            
            // Send prompt - this should trigger events
            await promptOpenCode(currentOpencodeSessionId!, content, { mode, model: selectedModel }, currentOpencodeUrl!)
            
            console.error(`[chat:${sessionId}] ✓ promptOpenCode call completed - events should start flowing`)
            console.log(`[chat:${sessionId}] promptOpenCode call completed`)
            
            // Give OpenCode a moment to start processing
            await new Promise(resolve => setTimeout(resolve, 1000))
          },
          {
            operationName: 'Send prompt to OpenCode',
            onError: async (error, attempt) => {
              console.error(`[chat:${sessionId}] Prompt send error (attempt ${attempt}):`, error)
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
        const promptElapsed = ((Date.now() - promptStartTime) / 1000).toFixed(2)
        console.error(`[chat:${sessionId}] ✓ Prompt sent successfully (took ${promptElapsed}s)`)
        console.log(`[chat:${sessionId}] ✓ Prompt sent successfully (took ${promptElapsed}s)`)
        console.error(`[chat:${sessionId}] Now waiting for events from OpenCode...`)
        console.error(`[chat:${sessionId}] Event stream should start yielding message.part.updated events soon...`)
      } catch (promptError) {
        console.error(`[chat:${sessionId}] ✗ Failed to send prompt:`, promptError)
        console.error(`[chat:${sessionId}] Error details:`, promptError instanceof Error ? {
          message: promptError.message,
          stack: promptError.stack,
          name: promptError.name
        } : promptError)
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
      
      console.error(`[chat:${sessionId}] ===== WAITING FOR EVENTS =====`)
      console.log(`[chat:${sessionId}] ===== WAITING FOR EVENTS =====`)
      console.error(`[chat:${sessionId}] Event stream is ready, waiting for events from OpenCode...`)
      console.log(`[chat:${sessionId}] Event stream is ready, waiting for events from OpenCode...`)
      console.error(`[chat:${sessionId}] About to enter event loop - sessionEvents is:`, typeof sessionEvents)
      console.log(`[chat:${sessionId}] About to enter event loop - sessionEvents is:`, typeof sessionEvents)
      
      // Send initial status to confirm SSE stream is working
      console.error(`[chat:${sessionId}] Sending initial status via SSE...`)
      try {
        await stream.writeSSE({
          event: 'status',
          data: JSON.stringify({
            type: 'status',
            status: 'agent-active',
            message: 'Agent is processing your request...',
          }),
        })
        console.error(`[chat:${sessionId}] ✓ Initial status sent via SSE, stream is working`)
        console.log(`[chat:${sessionId}] ✓ Initial status sent via SSE, stream is working`)
      } catch (statusError) {
        console.error(`[chat:${sessionId}] ✗ Failed to send initial status:`, statusError)
        throw statusError
      }

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
          console.error(`[chat:${sessionId}] Event timeout after ${EVENT_TIMEOUT_MS / 1000}s`)
          console.error(`[chat:${sessionId}] Event stream stats: eventCount=${eventCount}, lastEventTime=${new Date(lastEventTime).toISOString()}, timeSinceLastEvent=${Date.now() - lastEventTime}ms`)
          console.error(`[chat:${sessionId}] OpenCode session: ${currentOpencodeSessionId}, URL: ${currentOpencodeUrl}`)
          await stream.writeSSE({
            event: 'error',
            data: JSON.stringify({
              error: 'Agent did not respond in time. The request may have timed out.',
              details: `No events received after ${EVENT_TIMEOUT_MS / 1000}s. Event count: ${eventCount}`,
              category: 'persistent',
              retryable: true,
            }),
          })
        }, EVENT_TIMEOUT_MS)

        // Process events
        console.log(`[chat:${sessionId}] ===== STARTING EVENT LOOP =====`)
        console.log(`[chat:${sessionId}] Session ID: ${currentOpencodeSessionId}, URL: ${currentOpencodeUrl}`)
        console.log(`[chat:${sessionId}] Entering for-await loop...`)
        console.log(`[chat:${sessionId}] sessionEvents type: ${typeof sessionEvents}, isAsyncIterable: ${Symbol.asyncIterator in sessionEvents}`)
        
        let loopStarted = false
        let loopEntered = false
        try {
          // Start the async iterator explicitly
          const iterator = sessionEvents[Symbol.asyncIterator]()
          console.log(`[chat:${sessionId}] ✓ Got async iterator from sessionEvents`)
          
          while (true) {
            if (!loopEntered) {
              loopEntered = true
              console.log(`[chat:${sessionId}] Starting to iterate events...`)
            }
            
            const result = await iterator.next()
            
            if (result.done) {
              console.error(`[chat:${sessionId}] Event iterator done, breaking loop`)
              console.log(`[chat:${sessionId}] Event iterator done, breaking loop`)
              break
            }
            
            const event = result.value
            
            if (!loopStarted) {
              loopStarted = true
              console.error(`[chat:${sessionId}] ✓ Event loop started, received first event: ${event.type}`)
              console.log(`[chat:${sessionId}] ✓ Event loop started, received first event: ${event.type}`)
            }
            
            clearTimeout(eventTimeout) // Reset timeout on each event
            lastEventTime = Date.now()
            eventCount++
          
          // Always log first 20 events, then every 10th event
          if (eventCount <= 20 || eventCount % 10 === 0) {
            console.error(`[chat:${sessionId}] Event #${eventCount}: type=${event.type}, hasProperties=${!!event.properties}`)
            console.log(`[chat:${sessionId}] Event #${eventCount}: type=${event.type}, hasProperties=${!!event.properties}`)
            if (eventCount <= 5) {
              console.error(`[chat:${sessionId}] Event #${eventCount} full structure:`, JSON.stringify(event).slice(0, 1000))
              console.log(`[chat:${sessionId}] Event #${eventCount} full structure:`, JSON.stringify(event).slice(0, 500))
            }
          }
          
          // CRITICAL: Log message.part.updated events immediately
          if (event.type === 'message.part.updated') {
            console.error(`[chat:${sessionId}] 🎉 GOT message.part.updated EVENT!`)
            console.error(`[chat:${sessionId}] Part type: ${event.properties?.part?.type}`)
            console.error(`[chat:${sessionId}] Part data:`, JSON.stringify(event.properties?.part).slice(0, 500))
            
            // Send immediate status update for tool calls
            const part = event.properties?.part
            if (part?.type === 'tool') {
              const toolName = typeof part.tool === 'string' ? part.tool : (part.tool as { name?: string })?.name
              if (toolName) {
                await stream.writeSSE({
                  event: 'status',
                  data: JSON.stringify({
                    type: 'status',
                    status: 'tool-call',
                    message: `Using tool: ${toolName}`,
                    toolName,
                    toolTitle: part.state?.title || toolName,
                  }),
                })
              }
            } else if (part?.type === 'text') {
              // Send status for text parts
              await stream.writeSSE({
                event: 'status',
                data: JSON.stringify({
                  type: 'status',
                  status: 'agent-thinking',
                  message: 'Agent is thinking...',
                }),
              })
            }
          }

        // Stream event to client - ALWAYS send all events
        console.error(`[chat:${sessionId}] Sending event #${eventCount} via SSE: type=${event.type}`)
        try {
          await stream.writeSSE({
            event: 'event',
            data: JSON.stringify(event),
          })
          console.error(`[chat:${sessionId}] ✓ Event #${eventCount} sent successfully`)
        } catch (sseError) {
          console.error(`[chat:${sessionId}] ✗ Failed to send event #${eventCount} via SSE:`, sseError)
          throw sseError
        }

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
          
          console.log(`[chat:${sessionId}] Event iterator loop completed`)
        } catch (loopError) {
          console.error(`[chat:${sessionId}] ✗ Error in event loop:`, loopError)
          console.error(`[chat:${sessionId}] Loop error details:`, loopError instanceof Error ? {
            message: loopError.message,
            stack: loopError.stack,
            name: loopError.name
          } : loopError)
          await stream.writeSSE({
            event: 'error',
            data: JSON.stringify({
              error: 'Error processing agent events',
              details: loopError instanceof Error ? loopError.message : 'Unknown error',
              category: 'persistent',
              retryable: true,
            }),
          })
        } finally {
          clearTimeout(eventTimeout) // Clear timeout if we exit normally
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
        console.error(`[chat:${sessionId}] Error stack:`, error instanceof Error ? error.stack : 'No stack trace')

        // Classify and report error
        const details = classifyError(error)
        const sanitized = sanitizeError(error)
        const errorMessage = error instanceof Error ? error.message : String(error)

        // Broadcast error to WebSocket clients too
        try {
          await stub.fetch(
            new Request(`${doUrl}/broadcast`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                type: 'error',
                error: sanitized,
                message: errorMessage,
                category: details.category,
                retryable: details.retryable,
              }),
            }),
          )
        } catch (broadcastError) {
          console.error(`[chat:${sessionId}] Failed to broadcast error:`, broadcastError)
        }

        // Always try to send error via SSE, even if stream might be broken
        try {
          await stream.writeSSE({
            event: 'error',
            data: JSON.stringify({
              error: sanitized,
              message: errorMessage,
              category: details.category,
              retryable: details.retryable,
            }),
          })
        } catch (sseError) {
          console.error(`[chat:${sessionId}] Failed to send error via SSE:`, sseError)
          // If SSE fails, at least we logged it and broadcasted to WebSocket
        }
      }
    } catch (outerError) {
      // Catch any errors from the outer try block (line 85) that weren't caught by inner catches
      console.error(`[chat:${sessionId}] Unhandled error in stream handler:`, outerError)
      // Try to send error via SSE if possible
      try {
        await stream.writeSSE({
          event: 'error',
          data: JSON.stringify({
            error: outerError instanceof Error ? outerError.message : 'Unknown error',
            category: 'persistent',
            retryable: true,
          }),
        })
      } catch {
        // Ignore if SSE is already broken
      }
    }
  })
  } catch (handlerError) {
    console.error(`[chat:${sessionId}] CRITICAL: Error in chat handler before SSE:`, handlerError)
    console.error(`[chat:${sessionId}] Error stack:`, handlerError instanceof Error ? handlerError.stack : 'No stack')
    return c.json({ 
      error: 'Failed to start chat stream',
      details: handlerError instanceof Error ? handlerError.message : String(handlerError)
    }, 500)
  }
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
