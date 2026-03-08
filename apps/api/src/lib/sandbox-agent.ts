/**
 * Sandbox Agent SDK wrapper
 *
 * Replaces lib/opencode.ts — provides agent-agnostic interface to
 * sandbox-agent (https://github.com/rivet-dev/sandbox-agent).
 *
 * sandbox-agent runs inside the E2B sandbox and exposes HTTP/SSE API
 * that manages ACP agents (Claude Code, OpenCode, Codex, Cursor) via stdio.
 */

import { SandboxAgent, type Session, type SessionEvent } from 'sandbox-agent'
import type { Sandbox } from '@e2b/code-interpreter'
import { getAgent, getDefaultAgentId, type AgentConfig } from './agent-registry'

// Re-export types for convenience
export type { SandboxAgent, Session, SessionEvent }

// Client instance cache per sandbox URL
const clientCache: Map<string, SandboxAgent> = new Map()

// Default port for sandbox-agent server
const SANDBOX_AGENT_PORT = 3000

/**
 * Install sandbox-agent binary and requested agents in an E2B sandbox,
 * start the server, and return the public URL.
 *
 * Replaces startOpenCodeServer() from e2b.ts
 */
export async function startSandboxAgentServer(
  sandbox: Sandbox,
  sandboxId: string,
  agentType: string,
  envVars: Record<string, string>,
): Promise<{ url: string }> {
  const agentConfig = getAgent(agentType) || getAgent(getDefaultAgentId())!

  // Check if sandbox-agent server is already running
  try {
    const healthResult = await sandbox.commands.run(
      `curl -sf http://localhost:${SANDBOX_AGENT_PORT}/v1/health --connect-timeout 2 --max-time 3`,
    )
    if (healthResult.exitCode === 0) {
      const host = sandbox.getHost(SANDBOX_AGENT_PORT)
      const url = `https://${host}`
      console.log(`[sandbox-agent:${sandboxId}] Server already running at ${url}`)
      return { url }
    }
  } catch {
    // Server not running, continue with setup
  }

  // Set environment variables
  const envExports = Object.entries(envVars)
    .map(([k, v]) => `export ${k}="${v}"`)
    .join(' && ')

  // Install sandbox-agent binary
  console.log(`[sandbox-agent:${sandboxId}] Installing sandbox-agent...`)
  const installResult = await sandbox.commands.run(
    'curl -fsSL https://releases.rivet.dev/sandbox-agent/0.3.x/install.sh | sh',
    { timeoutMs: 120000 },
  )
  if (installResult.exitCode !== 0) {
    throw new Error(`Failed to install sandbox-agent: ${installResult.stderr}`)
  }

  // Install the requested agent
  console.log(`[sandbox-agent:${sandboxId}] Installing agent: ${agentConfig.sandboxAgentName}...`)
  const agentInstallResult = await sandbox.commands.run(
    `sandbox-agent install-agent ${agentConfig.sandboxAgentName}`,
    { timeoutMs: 120000 },
  )
  if (agentInstallResult.exitCode !== 0) {
    console.warn(
      `[sandbox-agent:${sandboxId}] Agent install warning: ${agentInstallResult.stderr}`,
    )
    // Don't throw — some agents may already be installed
  }

  // Start sandbox-agent server
  console.log(`[sandbox-agent:${sandboxId}] Starting server on port ${SANDBOX_AGENT_PORT}...`)
  const serverCmd = envExports
    ? `${envExports} && sandbox-agent server --no-token --host 0.0.0.0 --port ${SANDBOX_AGENT_PORT}`
    : `sandbox-agent server --no-token --host 0.0.0.0 --port ${SANDBOX_AGENT_PORT}`

  await sandbox.commands.run(serverCmd, {
    background: true,
    timeoutMs: 0,
  })

  // Wait for server to be ready
  console.log(`[sandbox-agent:${sandboxId}] Waiting for server health...`)
  const maxAttempts = 60
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const healthResult = await sandbox.commands.run(
        `curl -sf http://localhost:${SANDBOX_AGENT_PORT}/v1/health --connect-timeout 2 --max-time 3`,
      )
      if (healthResult.exitCode === 0) {
        console.log(`[sandbox-agent:${sandboxId}] Server healthy after ${i + 1} attempts`)
        break
      }
    } catch {
      // Not ready yet
    }

    if (i === maxAttempts - 1) {
      throw new Error(`sandbox-agent server failed to start within ${maxAttempts}s`)
    }

    await new Promise((r) => setTimeout(r, 1000))
  }

  const host = sandbox.getHost(SANDBOX_AGENT_PORT)
  const url = `https://${host}`
  console.log(`[sandbox-agent:${sandboxId}] Server ready at ${url}`)

  // Verify external connectivity
  await new Promise((r) => setTimeout(r, 2000))
  for (let i = 0; i < 5; i++) {
    try {
      const res = await fetch(`${url}/v1/health`, {
        signal: AbortSignal.timeout(5000),
      })
      if (res.ok) {
        console.log(`[sandbox-agent:${sandboxId}] External health verified`)
        break
      }
    } catch {
      if (i < 4) await new Promise((r) => setTimeout(r, 1000))
    }
  }

  return { url }
}

/**
 * Connect to a sandbox-agent server.
 * Replaces createOpenCodeClientForSandbox()
 */
export async function connectToSandboxAgent(baseUrl: string): Promise<SandboxAgent> {
  const cached = clientCache.get(baseUrl)
  if (cached) return cached

  const client = await SandboxAgent.connect({
    baseUrl,
    waitForHealth: { timeoutMs: 15000 },
  })

  clientCache.set(baseUrl, client)
  return client
}

/**
 * Create an agent session.
 * Replaces createOpenCodeSession()
 */
export async function createAgentSession(
  client: SandboxAgent,
  agentType: string,
  workingDir: string,
): Promise<{ sessionId: string; session: Session }> {
  const agentConfig = getAgent(agentType) || getAgent(getDefaultAgentId())!

  console.log(`[sandbox-agent] Creating session for agent: ${agentConfig.sandboxAgentName}, cwd: ${workingDir}`)

  const session = await client.createSession({
    agent: agentConfig.sandboxAgentName,
    sessionInit: {
      cwd: workingDir,
      mcpServers: [],
    },
  })

  console.log(`[sandbox-agent] Session created: ${session.id}`)

  return {
    sessionId: session.id,
    session,
  }
}

/**
 * Resume an existing session.
 */
export async function resumeAgentSession(
  client: SandboxAgent,
  sessionId: string,
): Promise<Session | null> {
  try {
    const session = await client.resumeSession(sessionId)
    return session
  } catch {
    console.warn(`[sandbox-agent] Failed to resume session ${sessionId}`)
    return null
  }
}

/**
 * Send a prompt to an agent session and return when the turn completes.
 * Events stream via session.onEvent() callback registered before calling this.
 *
 * Replaces promptOpenCode()
 */
export async function promptAgent(
  session: Session,
  content: string,
): Promise<{ response: unknown }> {
  console.log(`[sandbox-agent] Sending prompt (${content.length} chars) to session ${session.id}`)

  const response = await session.prompt([{ type: 'text', text: content }])

  console.log(`[sandbox-agent] Prompt completed for session ${session.id}`)
  return { response }
}

/**
 * Cancel an active agent session.
 * Replaces stopOpenCode()
 */
export async function cancelAgent(
  client: SandboxAgent,
  sessionId: string,
): Promise<void> {
  console.log(`[sandbox-agent] Cancelling session ${sessionId}`)

  try {
    // Use the session's send method to cancel via ACP
    const session = await client.getSession(sessionId)
    if (session) {
      await session.send('session/cancel')
    }
  } catch (error) {
    console.warn(`[sandbox-agent] Cancel error (may be expected):`, error)
  }
}

/**
 * Subscribe to session events.
 * Returns unsubscribe function.
 */
export function subscribeToSessionEvents(
  session: Session,
  listener: (event: SessionEvent) => void,
): () => void {
  return session.onEvent(listener)
}

/**
 * Dispose of a sandbox-agent client and remove from cache.
 */
export async function disposeSandboxAgent(baseUrl: string): Promise<void> {
  const client = clientCache.get(baseUrl)
  if (client) {
    await client.dispose()
    clientCache.delete(baseUrl)
  }
}

/**
 * Clean up all cached clients.
 */
export async function cleanupAllClients(): Promise<void> {
  for (const [url, client] of clientCache) {
    try {
      await client.dispose()
    } catch {
      // Ignore cleanup errors
    }
  }
  clientCache.clear()
}
