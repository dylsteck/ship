import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import {
  startSandboxAgentServer,
  type SandboxAgentOptions,
  connectToSandboxAgent,
  checkSandboxAgentHealth,
  createAgentSession,
  configureAgentSession,
  promptAgent,
  cancelAgent,
  resumeAgentSession,
  subscribeToSessionEvents,
  disposeSandboxAgent,
  validateAgentRuntime,
  type SandboxAgent,
  type AgentSessionConfig,
} from '../lib/sandbox-agent'
import { EventTranslatorState } from '../lib/event-translator'
import { getAgent, getDefaultAgentId } from '../lib/agent-registry'
import { executeWithRetry, classifyError, sanitizeError, safeErrorForLog } from '../lib/error-handler'
import { generateBranchName } from '../lib/git-workflow'
import { generateSessionTitle } from '../lib/generate-session-title'
import { buildAgentEnvVars, writeStatusEvent, writeErrorEvent, StreamStatus } from '../lib/chat-helpers'
import type { Env } from '../env.d'

const CREATE_SESSION_TIMEOUT_MS = 25_000
const RESUME_SESSION_TIMEOUT_MS = 15_000

async function createAgentSessionWithTimeout(
  client: SandboxAgent,
  agentType: string,
  repoPath: string,
  config: AgentSessionConfig,
) {
  return Promise.race([
    createAgentSession(client, agentType, repoPath, config),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Create agent session timed out')), CREATE_SESSION_TIMEOUT_MS),
    ),
  ])
}

async function resumeAgentSessionWithTimeout(
  client: SandboxAgent,
  sessionId: string,
): Promise<Awaited<ReturnType<typeof resumeAgentSession>> | null> {
  try {
    return await Promise.race([
      resumeAgentSession(client, sessionId),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Resume agent session timed out')), RESUME_SESSION_TIMEOUT_MS),
      ),
    ])
  } catch {
    return null
  }
}

const app = new Hono<{ Bindings: Env }>()

// POST /chat/:sessionId - Send message and receive streaming response
app.post('/:sessionId', async (c) => {
  const sessionId = c.req.param('sessionId')
  console.log(`[chat:${sessionId}] ===== CHAT REQUEST STARTED =====`)

  let content: string
  let mode = 'agent'

  try {
    const body = await c.req.json<{
      content: string
      mode?: string
    }>()
    content = body.content
    mode = body.mode || 'agent'
  } catch (parseError) {
    console.error(`[chat:${sessionId}] Failed to parse request body:`, parseError)
    return c.json({ error: 'Invalid request body' }, 400)
  }

  console.log(`[chat:${sessionId}] Mode: ${mode}, Content length: ${content?.length || 0}`)

  if (!content?.trim()) {
    return c.json({ error: 'Message content required' }, 400)
  }

  const MAX_PROMPT_LENGTH = 100_000
  if (content.length > MAX_PROMPT_LENGTH) {
    return c.json(
      { error: `Prompt too long (${content.length} chars). Maximum is ${MAX_PROMPT_LENGTH}.` },
      413,
    )
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
  let sandboxAgentToken = meta.sandbox_agent_token || ''
  const agentType = meta.agent_type || getDefaultAgentId()

  console.log(
    `[chat:${sessionId}] Meta: sandboxId=${sandboxId}, sandboxAgentUrl=${sandboxAgentUrl}, agentSessionId=${agentSessionId}, agentType=${agentType}`,
  )

  // Wait for sandbox when we don't have one — unless we know it failed (error).
  // Covers: provisioning in progress, or DO cold start (meta not yet set).
  const needsSandboxWait = !sandboxId && sandboxStatus !== 'error'

  try {
    return streamSSE(c, async (stream) => {
      console.log(`[chat:${sessionId}] SSE stream handler started`)

      let currentSandboxId: string | undefined = sandboxId
      let currentSandboxAgentUrl: string | undefined = sandboxAgentUrl
      let currentSandboxAgentToken: string = sandboxAgentToken
      let currentAgentSessionId: string | undefined = agentSessionId
      let agentJustStarted = false

      const isFirstMessage = !currentAgentSessionId

      try {
        // Send initial status (only on first message — follow-ups just show "Thinking...")
        if (isFirstMessage) {
          await stream.writeSSE({
            event: 'status',
            data: JSON.stringify({
              type: 'status',
              status: 'initializing',
              message: 'Preparing agent...',
            }),
          })
        }

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
              const payload = {
                error: 'Sandbox provisioning failed',
                details: (meta as Record<string, string>).sandbox_error || (meta as Record<string, string>).error || undefined,
                category: 'persistent' as const,
                retryable: true,
              }
              console.error(`[chat:${sessionId}] ERROR:`, payload)
              await stream.writeSSE({
                event: 'error',
                data: JSON.stringify(payload),
              })
              return
            }
          }

          if (!currentSandboxId) {
            const payload = {
              error: 'Sandbox provisioning timed out',
              details: 'Waited 30s for sandbox; provisioning may have failed',
              category: 'persistent' as const,
              retryable: true,
            }
            console.error(`[chat:${sessionId}] ERROR:`, payload)
            await stream.writeSSE({
              event: 'error',
              data: JSON.stringify(payload),
            })
            return
          }
        }

        // Ensure we have a sandbox
        if (!currentSandboxId) {
          const payload = {
            error: 'No sandbox available. Please refresh and try again.',
            details: 'Sandbox provisioning failed or timed out',
            category: 'persistent' as const,
            retryable: false,
          }
          console.error(`[chat:${sessionId}] ERROR:`, payload)
          await stream.writeSSE({
            event: 'error',
            data: JSON.stringify(payload),
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
            const { Sandbox } = await import('../lib/e2b')
            const sandbox = await Sandbox.connect(currentSandboxId, { apiKey: c.env.E2B_API_KEY })

            // Extend timeout to prevent auto-pause during agent server startup
            await sandbox.setTimeout(10 * 60 * 1000)

            const { url, token: newToken } = await startSandboxAgentServer(sandbox, currentSandboxId, agentType, buildAgentEnvVars(c.env), sandboxAgentOptions)
            currentSandboxAgentUrl = url
            currentSandboxAgentToken = newToken
            agentJustStarted = true
            console.log(`[chat:${sessionId}] sandbox-agent server started at ${url}`)

            await stub.fetch(
              new Request(`${doUrl}/meta`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  sandbox_agent_url: url,
                  sandbox_agent_token: newToken,
                }),
              }),
            )

            await stream.writeSSE({
              event: 'agent-url',
              data: JSON.stringify({ type: 'agent-url', url }),
            })
          } catch (error) {
            const errMsg = safeErrorForLog(error)
            const stack = error instanceof Error ? error.stack : undefined
            console.error(`[chat:${sessionId}] Failed to start sandbox-agent server: ${errMsg}`)
            if (stack) console.error(`[chat:${sessionId}] Stack: ${stack}`)
            const payload = {
              error: 'Failed to start agent server',
              details: error instanceof Error ? error.message : 'Unknown error',
              category: 'persistent' as const,
              retryable: true,
            }
            console.error(`[chat:${sessionId}] ERROR:`, payload)
            await stream.writeSSE({
              event: 'error',
              data: JSON.stringify(payload),
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

        // Check Bankr preference for this user
        let bankrEnabled = false
        if (userId && c.env.BANKR_API_KEY) {
          try {
            const bankrPref = await c.env.DB.prepare('SELECT value FROM user_preferences WHERE user_id = ? AND key = ?')
              .bind(userId, 'use_bankr')
              .first<{ value: string }>()
            bankrEnabled = bankrPref?.value === 'true'
          } catch { /* ignore — default to false */ }
        }
        const sandboxAgentOptions = bankrEnabled ? { bankrEnabled: true, bankrApiKey: c.env.BANKR_API_KEY! } : undefined

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
            const baseBranch = latestMeta.base_branch || 'main'
            const taskSlug = content?.trim().slice(0, 80) || 'agent-task'
            const branchName = generateBranchName(taskSlug, sessionId)

            const { Sandbox } = await import('../lib/e2b')
            const sandbox = await Sandbox.connect(currentSandboxId, { apiKey: c.env.E2B_API_KEY })

            // Extend timeout to prevent auto-pause during clone
            await sandbox.setTimeout(10 * 60 * 1000)

            // NOTE: E2B SDK throws CommandExitError on non-zero exit codes
            // GIT_TERMINAL_PROMPT=0 prevents git from hanging waiting for credentials
            // Try with auth first, fall back to unauthenticated (works for public repos)
            try {
              await sandbox.commands.run(
                `GIT_TERMINAL_PROMPT=0 git -c http.extraHeader="Authorization: Bearer ${accountRes.access_token}" clone --depth 1 --single-branch ${repoUrl} ${repoPath}`,
                { timeoutMs: 60000 },
              )
            } catch (authCloneErr) {
              console.warn(`[chat:${sessionId}] Auth clone failed, retrying without auth (public repo fallback)`)
              // Clean up failed clone attempt
              await sandbox.commands.run(`rm -rf ${repoPath}`).catch(() => {})
              await sandbox.commands.run(
                `GIT_TERMINAL_PROMPT=0 git clone --depth 1 --single-branch ${repoUrl} ${repoPath}`,
                { timeoutMs: 60000 },
              )
            }

            await sandbox.commands.run(`cd ${repoPath} && git config user.name "Ship Agent"`)
            await sandbox.commands.run(`cd ${repoPath} && git config user.email "shipagent@dylansteck.com"`)
            try {
              await sandbox.commands.run(`cd ${repoPath} && git checkout ${baseBranch}`)
            } catch {
              // baseBranch may already be checked out after clone
            }
            await sandbox.commands.run(`cd ${repoPath} && git checkout -b ${branchName}`)

            await stub.fetch(
              new Request(`${doUrl}/meta`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  repo_url: repoUrl,
                  current_branch: branchName,
                  base_branch: baseBranch,
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
            const cloneErrMsg = safeErrorForLog(cloneError)
            // E2B CommandExitError has stdout/stderr properties
            const cmdErr = cloneError as { stderr?: string; stdout?: string }
            console.error(`[chat:${sessionId}] Clone failed: ${cloneErrMsg}`)
            if (cmdErr.stderr) console.error(`[chat:${sessionId}] Clone stderr: ${cmdErr.stderr}`)
            if (cmdErr.stdout) console.error(`[chat:${sessionId}] Clone stdout: ${cmdErr.stdout}`)
            const clonePayload = {
              error: 'Failed to clone repository',
              details: cloneError instanceof Error ? cloneError.message : String(cloneError),
              category: 'persistent' as const,
              retryable: true,
            }
            console.error(`[chat:${sessionId}] ERROR:`, clonePayload)
            await stream.writeSSE({
              event: 'error',
              data: JSON.stringify(clonePayload),
            })
            return
          }
        }

        // Health-check existing sandbox-agent URL before use (skip if we just started it)
        if (currentSandboxAgentUrl && !agentJustStarted) {
          const healthy = await checkSandboxAgentHealth(currentSandboxAgentUrl, currentSandboxAgentToken)
          if (!healthy) {
            console.warn(`[chat:${sessionId}] Sandbox agent unhealthy at ${currentSandboxAgentUrl}`)

            // Step 1: If we have a sandbox ID, try resuming it (handles paused sandboxes)
            let resumed = false
            if (currentSandboxId) {
              try {
                console.log(`[chat:${sessionId}] Attempting to resume sandbox ${currentSandboxId}...`)
                await stream.writeSSE({
                  event: 'status',
                  data: JSON.stringify({
                    type: 'status',
                    status: 'reconnecting',
                    message: 'Resuming sandbox...',
                  }),
                })

                const { resumeSandbox } = await import('../lib/e2b')
                await resumeSandbox(c.env.E2B_API_KEY, currentSandboxId)
                console.log(`[chat:${sessionId}] Sandbox resumed successfully: ${currentSandboxId}`)

                // Re-check sandbox-agent health after resume
                const healthyAfterResume = await checkSandboxAgentHealth(currentSandboxAgentUrl, currentSandboxAgentToken)
                if (healthyAfterResume) {
                  console.log(`[chat:${sessionId}] Sandbox-agent healthy after resume`)
                  resumed = true
                } else {
                  // Sandbox is running but sandbox-agent server needs restart
                  console.log(`[chat:${sessionId}] Sandbox resumed but agent unhealthy, restarting sandbox-agent server...`)
                  await stream.writeSSE({
                    event: 'status',
                    data: JSON.stringify({
                      type: 'status',
                      status: 'reconnecting',
                      message: 'Restarting agent server on resumed sandbox...',
                    }),
                  })

                  const { Sandbox: E2BSandbox } = await import('../lib/e2b')
                  const resumedSandbox = await E2BSandbox.connect(currentSandboxId, { apiKey: c.env.E2B_API_KEY })
                  // Extend timeout to prevent re-pause during agent server restart
                  await resumedSandbox.setTimeout(10 * 60 * 1000)

                  const { url, token: restartToken } = await startSandboxAgentServer(resumedSandbox, currentSandboxId, agentType, buildAgentEnvVars(c.env), sandboxAgentOptions)
                  currentSandboxAgentUrl = url
                  currentSandboxAgentToken = restartToken
                  currentAgentSessionId = undefined
                  console.log(`[chat:${sessionId}] Sandbox-agent restarted on resumed sandbox at ${url}`)

                  await stub.fetch(
                    new Request(`${doUrl}/meta`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        sandbox_agent_url: url,
                        sandbox_agent_token: restartToken,
                        agent_session_id: '',
                      }),
                    }),
                  )

                  await stream.writeSSE({
                    event: 'agent-url',
                    data: JSON.stringify({ type: 'agent-url', url }),
                  })
                  resumed = true
                }
              } catch (resumeError) {
                console.warn(`[chat:${sessionId}] Resume failed (sandbox may be terminated):`, safeErrorForLog(resumeError))
                // Fall through to full re-provisioning
              }
            }

            // Step 2: If resume didn't work, fall back to full re-provisioning
            if (!resumed) {
              console.log(`[chat:${sessionId}] Re-provisioning sandbox...`)
              await stream.writeSSE({
                event: 'status',
                data: JSON.stringify({
                  type: 'status',
                  status: 'reconnecting',
                  message: 'Reconnecting — sandbox expired, re-provisioning...',
                }),
              })

              // Clear stale metadata
              await stub.fetch(
                new Request(`${doUrl}/meta`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    sandbox_agent_url: '',
                    agent_session_id: '',
                    sandbox_id: '',
                    sandbox_status: '',
                  }),
                }),
              )
              currentSandboxAgentUrl = undefined
              currentAgentSessionId = undefined

              // Re-provision sandbox
              try {
                const { createSessionSandbox, Sandbox } = await import('../lib/e2b')
                const agentEnvs = buildAgentEnvVars(c.env)
                const sandboxInfo = await createSessionSandbox(c.env.E2B_API_KEY, {
                  sessionId,
                  ...(Object.keys(agentEnvs).length > 0 && { envs: agentEnvs }),
                })
                currentSandboxId = sandboxInfo.id
                const newSandbox = await Sandbox.connect(currentSandboxId, { apiKey: c.env.E2B_API_KEY })
                // Extend timeout to prevent auto-pause during re-provisioning setup
                await newSandbox.setTimeout(10 * 60 * 1000)
                console.log(`[chat:${sessionId}] New sandbox provisioned: ${currentSandboxId}`)

                // Save new sandbox ID
                await stub.fetch(
                  new Request(`${doUrl}/meta`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      sandbox_id: currentSandboxId,
                      sandbox_status: 'active',
                    }),
                  }),
                )

                const { url, token: reprovisionToken } = await startSandboxAgentServer(newSandbox, currentSandboxId, agentType, buildAgentEnvVars(c.env), sandboxAgentOptions)
                currentSandboxAgentUrl = url
                currentSandboxAgentToken = reprovisionToken
                console.log(`[chat:${sessionId}] Re-provisioned sandbox-agent at ${url}`)

                await stub.fetch(
                  new Request(`${doUrl}/meta`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      sandbox_agent_url: url,
                      sandbox_agent_token: reprovisionToken,
                    }),
                  }),
                )

                // Re-clone repo if needed
                const repoMeta = await stub.fetch(new Request(`${doUrl}/meta`))
                const repoMetaJson = (await repoMeta.json()) as Record<string, string>
                if (repoMetaJson.repoOwner || repoMetaJson.repo_owner) {
                  const owner = repoMetaJson.repoOwner || repoMetaJson.repo_owner
                  const name = repoMetaJson.repoName || repoMetaJson.repo_name
                  const uid = repoMetaJson.userId || repoMetaJson.user_id

                  if (owner && name && uid) {
                    await stream.writeSSE({
                      event: 'status',
                      data: JSON.stringify({
                        type: 'status',
                        status: 'cloning',
                        message: `Re-cloning ${owner}/${name}...`,
                      }),
                    })

                    const accountRes = await c.env.DB.prepare(
                      'SELECT access_token FROM accounts WHERE user_id = ? AND provider = ? LIMIT 1',
                    )
                      .bind(uid, 'github')
                      .first<{ access_token: string }>()

                    if (accountRes?.access_token) {
                      const repoUrl = `https://github.com/${owner}/${name}.git`
                      const baseBranch = repoMetaJson.base_branch || 'main'
                      const branchName = repoMetaJson.current_branch || generateBranchName('agent-task', sessionId)

                      let cloneOk = false
                      try {
                        await newSandbox.commands.run(
                          `GIT_TERMINAL_PROMPT=0 git -c http.extraHeader="Authorization: Bearer ${accountRes.access_token}" clone --depth 1 --single-branch ${repoUrl} ${repoPath}`,
                          { timeoutMs: 60000 },
                        )
                        cloneOk = true
                      } catch {
                        // Auth clone failed — retry without auth (public repo fallback)
                        await newSandbox.commands.run(`rm -rf ${repoPath}`).catch(() => {})
                        try {
                          await newSandbox.commands.run(
                            `GIT_TERMINAL_PROMPT=0 git clone --depth 1 --single-branch ${repoUrl} ${repoPath}`,
                            { timeoutMs: 60000 },
                          )
                          cloneOk = true
                        } catch { /* both failed */ }
                      }
                      if (cloneOk) {
                        await newSandbox.commands.run(`cd ${repoPath} && git config user.name "Ship Agent"`)
                        await newSandbox.commands.run(`cd ${repoPath} && git config user.email "shipagent@dylansteck.com"`)
                        await newSandbox.commands.run(`cd ${repoPath} && git checkout ${baseBranch}`)
                        await newSandbox.commands.run(`cd ${repoPath} && git checkout -b ${branchName}`)

                        await stub.fetch(
                          new Request(`${doUrl}/meta`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ repo_url: repoUrl, current_branch: branchName, base_branch: baseBranch, repo_path: repoPath }),
                          }),
                        )
                      }
                    }
                  }
                }

                await stream.writeSSE({
                  event: 'agent-url',
                  data: JSON.stringify({ type: 'agent-url', url }),
                })
              } catch (reprovisionError) {
                console.error(`[chat:${sessionId}] Re-provisioning failed:`, reprovisionError)
                const reprovisionPayload = {
                  error: 'Failed to re-provision sandbox',
                  details: reprovisionError instanceof Error ? reprovisionError.message : 'Unknown error',
                  category: 'persistent' as const,
                  retryable: true,
                }
                console.error(`[chat:${sessionId}] ERROR:`, reprovisionPayload)
                await stream.writeSSE({
                  event: 'error',
                  data: JSON.stringify(reprovisionPayload),
                })
                return
              }
            }
          }
        }

        // Keep-alive: refresh sandbox timeout on every message
        if (currentSandboxId && currentSandboxAgentUrl) {
          try {
            const { refreshSandboxTimeout } = await import('../lib/e2b')
            await refreshSandboxTimeout(c.env.E2B_API_KEY, currentSandboxId)
            console.log(`[chat:${sessionId}] Refreshed sandbox timeout for ${currentSandboxId}`)
          } catch (e) {
            console.warn(`[chat:${sessionId}] Failed to refresh sandbox timeout:`, e)
            // Non-fatal — continue with the request
          }
        }

        // Ensure we have sandbox-agent URL
        if (!currentSandboxAgentUrl) {
          console.error(`[chat:${sessionId}] No sandbox-agent URL available`)
          const noAgentPayload = {
            error: 'Agent server not started',
            details: 'Sandbox-agent server failed to start or was not provisioned',
            category: 'persistent' as const,
            retryable: true,
          }
          console.error(`[chat:${sessionId}] ERROR:`, noAgentPayload)
          await stream.writeSSE({
            event: 'error',
            data: JSON.stringify(noAgentPayload),
          })
          return
        }

        // Connect to sandbox-agent
        console.log(`[chat:${sessionId}] Connecting to sandbox-agent at ${currentSandboxAgentUrl}, agentType=${agentType}`)
        const client = await connectToSandboxAgent(currentSandboxAgentUrl, currentSandboxAgentToken || undefined)
        await validateAgentRuntime(client, agentType)
        console.log(`[chat:${sessionId}] Agent runtime validated for ${agentType}`)

        const sessionConfig = {
          mode,
          model: latestMeta.model || undefined,
        }

        // Verify/create agent session
        if (currentAgentSessionId) {
          try {
            const existingSession = await resumeAgentSessionWithTimeout(client, currentAgentSessionId)
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
            const heartbeatInterval = setInterval(async () => {
              try {
                await stream.writeSSE({
                  event: 'status',
                  data: JSON.stringify({
                    type: 'status',
                    status: 'creating-session',
                    message: 'Still creating agent session...',
                  }),
                })
              } catch {
                // Stream may be closed
              }
            }, 12000)
            try {
              const result = await createAgentSessionWithTimeout(client, agentType, repoPath, sessionConfig)
              currentAgentSessionId = result.sessionId
              session = result.session
              console.log(`[chat:${sessionId}] Agent session created: ${currentAgentSessionId}`)
            } finally {
              clearInterval(heartbeatInterval)
            }

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
            const sessionPayload = {
              error: 'Failed to create agent session',
              details: sessionError instanceof Error ? sessionError.message : 'Unknown error',
              category: 'persistent' as const,
              retryable: true,
            }
            console.error(`[chat:${sessionId}] ERROR:`, sessionPayload)
            await stream.writeSSE({
              event: 'error',
              data: JSON.stringify(sessionPayload),
            })
            return
          }
        } else {
          // Resume existing session
          session = await resumeAgentSessionWithTimeout(client, currentAgentSessionId)
          if (!session) {
            // Recreate if resume fails
            const result = await createAgentSessionWithTimeout(client, agentType, repoPath, sessionConfig)
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
          const establishPayload = {
            error: 'Failed to establish agent session',
            details: 'createAgentSession returned null or invalid session',
            category: 'persistent' as const,
            retryable: true,
          }
          console.error(`[chat:${sessionId}] ERROR:`, establishPayload)
          await stream.writeSSE({
            event: 'error',
            data: JSON.stringify(establishPayload),
          })
          return
        }

        await configureAgentSession(session, { mode: sessionConfig.mode })

        // Send agent-session so frontend can build Logs link (sandbox-agent session id)
        if (currentAgentSessionId) {
          const agentSessionEvent = {
            type: 'agent-session' as const,
            agentSessionId: currentAgentSessionId,
          }
          await stream.writeSSE({
            event: 'agent-session',
            data: JSON.stringify(agentSessionEvent),
          })
          try {
            await stub.fetch(
              new Request(`${doUrl}/broadcast`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type: 'agent-event', event: agentSessionEvent }),
              }),
            )
            await stub.fetch(
              new Request(`${doUrl}/events`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  events: [
                    {
                      id: crypto.randomUUID(),
                      type: 'agent-session',
                      timestamp: Date.now(),
                      payload: agentSessionEvent,
                    },
                  ],
                }),
              }),
            )
          } catch {
            // Ignore broadcast errors
          }
        }

        // Set up event translator
        const translator = new EventTranslatorState(sessionId)

        // Register event handler BEFORE prompting
        let eventCount = 0
        let lastEventTime = Date.now()
        let receivedAiTitle = false
        const EVENT_TIMEOUT_MS = 300000 // 5 min — allow for retries (502, port not open)
        const HEARTBEAT_INTERVAL_MS = 10000

        const pendingEvents: Array<{ id: string; type: string; timestamp: number; payload: unknown }> = []
        const BATCH_SIZE = 5
        const flushEventsToPersist = async () => {
          if (pendingEvents.length === 0) return
          const batch = pendingEvents.splice(0, pendingEvents.length)
          try {
            await stub.fetch(
              new Request(`${doUrl}/events`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ events: batch }),
              }),
            )
          } catch (e) {
            console.error(`[chat:${sessionId}] Failed to persist events:`, e)
          }
        }

        const unsubscribe = subscribeToSessionEvents(session, async (event) => {
          lastEventTime = Date.now()
          eventCount++

          // Translate ACP/UniversalEvent to Ship SSE events
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

            pendingEvents.push({
              id: crypto.randomUUID(),
              type: sseEvent.type,
              timestamp: Date.now(),
              payload: sseEvent,
            })
            if (pendingEvents.length >= BATCH_SIZE) {
              await flushEventsToPersist()
            }

            // Persist session title to DB when received from agent (any harness)
            if (sseEvent.type === 'session.updated') {
              const info = (sseEvent as { properties?: { info?: { title?: string } } }).properties?.info
              if (info?.title) {
                receivedAiTitle = true
                try {
                  await c.env.DB.prepare(
                    'UPDATE chat_sessions SET title = ?, last_activity = ? WHERE id = ?',
                  )
                    .bind(info.title, Math.floor(Date.now() / 1000), sessionId)
                    .run()
                } catch (persistErr) {
                  console.error(`[chat:${sessionId}] Failed to persist title:`, persistErr)
                }
              }
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
            const heartbeatPayload = {
              type: 'heartbeat',
              message: 'Waiting for agent response...',
              eventCount,
              timeSinceLastEvent: Math.floor(timeSinceLastEvent / 1000),
            }
            try {
              await stream.writeSSE({
                event: 'heartbeat',
                data: JSON.stringify(heartbeatPayload),
              })
              // Don't persist heartbeat — Overview shows only raw agent harness events
            } catch {
              // Stream might be closed
            }
          }
        }, HEARTBEAT_INTERVAL_MS)

        // Event timeout
        const eventTimeout = setTimeout(async () => {
          if (eventCount === 0) {
            console.error(`[chat:${sessionId}] Event timeout after ${EVENT_TIMEOUT_MS / 1000}s (no events received)`)
            try {
              const timeoutPayload = {
                error: 'Agent did not respond in time',
                details: `No events after ${EVENT_TIMEOUT_MS / 1000}s`,
                category: 'persistent' as const,
                retryable: true,
              }
              console.error(`[chat:${sessionId}] ERROR:`, timeoutPayload)
              await stream.writeSSE({
                event: 'error',
                data: JSON.stringify(timeoutPayload),
              })
            } catch {
              // Stream might be closed
            }
          }
        }, EVENT_TIMEOUT_MS)

        // Send prompt status (only on first message)
        if (isFirstMessage) {
          const statusPayload = {
            type: 'status',
            status: 'sending-prompt',
            message: 'Sending request to agent...',
          }
          await stream.writeSSE({
            event: 'status',
            data: JSON.stringify(statusPayload),
          })
          // Don't persist chat-route status — Overview shows only raw agent harness events
        }

        // Send prompt — blocks until turn completes
        try {
          await executeWithRetry(
            async () => {
              await promptAgent(session!, content)
            },
            {
              operationName: 'Send prompt to agent',
              onError: async (error, attempt) => {
                console.error(`[chat:${sessionId}] Prompt error (attempt ${attempt}):`, safeErrorForLog(error))
                const details = classifyError(sanitizeError(error))
                const errorMsg = sanitizeError(error)

                if (details.retryable) {
                  // Send status event during retries so the frontend stays in streaming mode.
                  // Sending error events would kill the frontend stream prematurely.
                  const retryMsg = errorMsg.toLowerCase().includes('rate limit') || errorMsg.toLowerCase().includes('429') || errorMsg.toLowerCase().includes('too many requests')
                    ? `Rate limited — retrying (attempt ${attempt + 1})...`
                    : errorMsg.toLowerCase().includes('overloaded') || errorMsg.toLowerCase().includes('529')
                      ? `API overloaded — retrying (attempt ${attempt + 1})...`
                      : `Transient error — retrying (attempt ${attempt + 1})...`
                  await stream.writeSSE({
                    event: 'status',
                    data: JSON.stringify({
                      type: 'status',
                      status: 'retrying',
                      message: retryMsg,
                    }),
                  })
                } else {
                  // Non-retryable: send error event immediately
                  const nonRetryPayload = {
                    error: errorMsg,
                    details: errorMsg,
                    category: details.category,
                    retryable: false,
                  }
                  console.error(`[chat:${sessionId}] ERROR:`, nonRetryPayload)
                  await stream.writeSSE({
                    event: 'error',
                    data: JSON.stringify(nonRetryPayload),
                  })
                  // Persist non-retryable errors so user sees them on refresh
                  try {
                    await stub.fetch(
                      new Request(`${doUrl}/messages`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          role: 'system',
                          content: errorMsg,
                          parts: JSON.stringify([
                            { type: 'error', category: details.category, retryable: details.retryable },
                          ]),
                        }),
                      }),
                    )
                  } catch (persistErr) {
                    console.error(`[chat:${sessionId}] Failed to persist error:`, persistErr)
                  }
                }
              },
            },
          )
          console.log(`[chat:${sessionId}] Prompt completed`)
        } catch (promptError) {
          // All retries exhausted or non-retryable error
          console.error(`[chat:${sessionId}] Failed to send prompt after retries:`, safeErrorForLog(promptError))
          const finalDetails = classifyError(sanitizeError(promptError))
          const finalMsg = sanitizeError(promptError)
          const exhaustedPayload = {
            error: finalMsg,
            details: finalMsg,
            category: finalDetails.category,
            retryable: true,
          }
          console.error(`[chat:${sessionId}] ERROR:`, exhaustedPayload)
          await stream.writeSSE({
            event: 'error',
            data: JSON.stringify(exhaustedPayload),
          })
        } finally {
          clearTimeout(eventTimeout)
          clearInterval(heartbeatInterval)
          unsubscribe()
          await flushEventsToPersist()
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
            console.error(`[chat:${sessionId}] Git workflow error:`, safeErrorForLog(gitError))
          }
        }

        // Persist assistant message with parts (reasoning, tools) for reload
        const assistantContent = translator.accumulatedText
        const parts = translator.getAccumulatedParts()
        if (assistantContent || parts !== '[]') {
          await stub.fetch(
            new Request(`${doUrl}/messages`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                role: 'assistant',
                content: assistantContent || '',
                parts: parts !== '[]' ? parts : undefined,
              }),
            }),
          )
        }

        // Generate LLM title when agent did not send session_info_update
        if (!receivedAiTitle && content?.trim() && (c.env.BANKR_API_KEY || c.env.ANTHROPIC_API_KEY || c.env.OPENAI_API_KEY)) {
          const generatedTitle = await generateSessionTitle({
            userPrompt: content,
            assistantPreview: assistantContent?.slice(0, 300),
            bankrApiKey: bankrEnabled ? c.env.BANKR_API_KEY : undefined,
            anthropicApiKey: c.env.ANTHROPIC_API_KEY,
            openaiApiKey: c.env.OPENAI_API_KEY,
          })
          if (generatedTitle) {
            try {
              await c.env.DB.prepare(
                'UPDATE chat_sessions SET title = ?, last_activity = ? WHERE id = ?',
              )
                .bind(generatedTitle, Math.floor(Date.now() / 1000), sessionId)
                .run()

              const sessionUpdatedEvent = {
                type: 'session.updated',
                properties: {
                  info: {
                    id: sessionId,
                    slug: '',
                    version: '',
                    projectID: '',
                    directory: '',
                    title: generatedTitle,
                    time: { created: Math.floor(Date.now() / 1000), updated: Math.floor(Date.now() / 1000) },
                    summary: { additions: 0, deletions: 0, files: 0 },
                  },
                },
              }
              await stream.writeSSE({
                event: 'session.updated',
                data: JSON.stringify(sessionUpdatedEvent),
              })
              await stub.fetch(
                new Request(`${doUrl}/broadcast`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ type: 'agent-event', event: sessionUpdatedEvent }),
                }),
              )
              console.log(`[chat:${sessionId}] Generated session title: ${generatedTitle.slice(0, 40)}...`)
            } catch (titleErr) {
              console.error(`[chat:${sessionId}] Failed to persist generated title:`, titleErr)
            }
          }
        }

        // Send done event
        await stream.writeSSE({
          event: 'done',
          data: JSON.stringify({ type: 'done' }),
        })
        console.log(`[chat:${sessionId}] SSE stream completed successfully`)
      } catch (error) {
        console.error(`[chat:${sessionId}] Error in stream handler:`, safeErrorForLog(error))
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
          const outerPayload = {
            error: sanitized,
            details: error instanceof Error ? error.message : String(error),
            category: details.category,
            retryable: details.retryable,
          }
          console.error(`[chat:${sessionId}] ERROR:`, outerPayload)
          await stream.writeSSE({
            event: 'error',
            data: JSON.stringify({
              ...outerPayload,
              message: outerPayload.details,
            }),
          })
        } catch {
          // Stream might be closed
        }
      } finally {
        if (currentSandboxAgentUrl) {
          try {
            await disposeSandboxAgent(currentSandboxAgentUrl)
          } catch (e) {
            console.warn(`[chat:${sessionId}] Dispose warning:`, e)
          }
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

      // Keep stream open until session ends (timeout after 5 min)
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

// GET /chat/:sessionId/subagent/:subagentSessionId/stream - SSE stream for sub-agent session
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

      // Keep stream open until session ends (timeout after 5 min)
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

// GET /chat/:sessionId/events - Get persisted SSE events for Overview inspector
app.get('/:sessionId/events', async (c) => {
  const sessionId = c.req.param('sessionId')

  const id = c.env.SESSION_DO.idFromName(sessionId)
  const stub = c.env.SESSION_DO.get(id)

  const response = await stub.fetch(new Request('https://do/events'))
  return new Response(response.body, response)
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

    // Get the session and send permission reply via ACP
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

// POST /chat/:sessionId/question/:questionId - Reply to agent question
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

// POST /chat/:sessionId/question/:questionId/reject - Reject/skip agent question
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

export default app
