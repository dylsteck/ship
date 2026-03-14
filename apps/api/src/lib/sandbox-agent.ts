/**
 * Sandbox Agent SDK wrapper
 *
 * Replaces lib/opencode.ts — provides agent-agnostic interface to
 * sandbox-agent (https://github.com/rivet-dev/sandbox-agent).
 *
 * sandbox-agent runs inside the E2B sandbox and exposes HTTP/SSE API
 * that manages ACP agents (Claude Code, OpenCode, Codex) via stdio.
 */

import {
  SandboxAgent,
  SandboxAgentError,
  type McpServerConfig,
  type Session,
  type SessionEvent,
} from 'sandbox-agent'
import type { Sandbox } from '@e2b/code-interpreter'
import { getAgent, getDefaultAgentId, type AgentConfig } from './agent-registry'

function generateToken(): string {
  const array = new Uint8Array(24)
  crypto.getRandomValues(array)
  return Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('')
}

// Re-export types for convenience
export type { SandboxAgent, Session, SessionEvent }

export interface AgentSessionConfig {
  mode?: string
  model?: string
}

// Client instance cache per sandbox URL with TTL eviction
interface CachedClient {
  client: SandboxAgent
  token: string
  lastUsed: number
}

const clientCache = new Map<string, CachedClient>()
const CACHE_TTL_MS = 30 * 60 * 1000 // 30 minutes

function evictStaleClients(): void {
  const now = Date.now()
  for (const [url, entry] of clientCache) {
    if (now - entry.lastUsed > CACHE_TTL_MS) {
      entry.client.dispose().catch(() => {})
      clientCache.delete(url)
    }
  }
}

// Default port for sandbox-agent server
const SANDBOX_AGENT_PORT = 3000

const SHARED_MCP_CONFIGS: Record<string, McpServerConfig> = {
  grep: {
    type: 'remote',
    url: 'https://mcp.grep.app',
    enabled: true,
  },
  deepwiki: {
    type: 'remote',
    url: 'https://mcp.deepwiki.com/mcp',
    enabled: true,
  },
  exa: {
    type: 'remote',
    url: 'https://mcp.exa.ai/mcp',
    enabled: true,
  },
}

const REMOVED_SHARED_MCP_NAMES = ['context7'] as const

const MCP_SYNC_TIMEOUT_MS = 25_000

async function syncSharedMcpConfigs(client: SandboxAgent, workingDir: string): Promise<void> {
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('MCP config sync timed out')), MCP_SYNC_TIMEOUT_MS),
  )

  await Promise.race([
    (async () => {
      for (const [mcpName, config] of Object.entries(SHARED_MCP_CONFIGS)) {
        await client.setMcpConfig(
          {
            directory: workingDir,
            mcpName,
          },
          config,
        )
      }

      for (const mcpName of REMOVED_SHARED_MCP_NAMES) {
        try {
          await client.deleteMcpConfig({
            directory: workingDir,
            mcpName,
          })
        } catch (error) {
          if (error instanceof SandboxAgentError && error.status === 404) continue
          console.warn(`[sandbox-agent] Failed to delete MCP config "${mcpName}" for ${workingDir}`, error)
        }
      }
    })(),
    timeoutPromise,
  ])
}

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
): Promise<{ url: string; token: string }> {
  const agentConfig = getAgent(agentType) || getAgent(getDefaultAgentId())!
  const sandboxToken = generateToken()

  // Check if sandbox-agent server is already running (no token — existing server may have its own)
  try {
    const healthResult = await sandbox.commands.run(
      `curl -sf http://localhost:${SANDBOX_AGENT_PORT}/v1/health --connect-timeout 2 --max-time 3`,
    )
    if (healthResult.exitCode === 0) {
      const host = sandbox.getHost(SANDBOX_AGENT_PORT)
      const url = `https://${host}`
      console.log(`[sandbox-agent:${sandboxId}] Server already running at ${url}`)
      // Return empty token — existing server may have its own token stored in DO metadata
      return { url, token: '' }
    }
  } catch {
    // Server not running, continue with setup
  }

  // Check if sandbox-agent binary is pre-installed (custom template)
  const checkBinary = await sandbox.commands.run('which sandbox-agent')
  if (checkBinary.exitCode !== 0) {
    // Install sandbox-agent binary (fallback for non-custom templates)
    console.log(`[sandbox-agent:${sandboxId}] Installing sandbox-agent...`)
    const installResult = await sandbox.commands.run(
      'curl -fsSL https://releases.rivet.dev/sandbox-agent/0.3.x/install.sh | sh',
      { timeoutMs: 120000 },
    )
    if (installResult.exitCode !== 0) {
      throw new Error(`Failed to install sandbox-agent: ${installResult.stderr}`)
    }
  } else {
    console.log(`[sandbox-agent:${sandboxId}] sandbox-agent binary already installed (custom template)`)
  }

  // Check if the requested agent is already installed
  const agentCheck = await sandbox.commands.run(
    `sandbox-agent list-agents 2>/dev/null | grep -q ${agentConfig.sandboxAgentName}`,
  )
  if (agentCheck.exitCode !== 0) {
    // Install the requested agent (fallback)
    console.log(`[sandbox-agent:${sandboxId}] Installing agent: ${agentConfig.sandboxAgentName}...`)
    const agentInstallResult = await sandbox.commands.run(
      `sandbox-agent install-agent ${agentConfig.sandboxAgentName}`,
      { timeoutMs: 120000 },
    )
    if (agentInstallResult.exitCode !== 0) {
      console.warn(
        `[sandbox-agent:${sandboxId}] Agent install warning: ${agentInstallResult.stderr}`,
      )
    }
  } else {
    console.log(`[sandbox-agent:${sandboxId}] Agent ${agentConfig.sandboxAgentName} already installed`)
  }

  // Start sandbox-agent server — pass env vars via E2B's envs param (no temp files)
  console.log(`[sandbox-agent:${sandboxId}] Starting server on port ${SANDBOX_AGENT_PORT}...`)
  const serverCmd = `sandbox-agent server --token ${sandboxToken} --host 0.0.0.0 --port ${SANDBOX_AGENT_PORT}`

  await sandbox.commands.run(serverCmd, {
    background: true,
    timeoutMs: 0,
    ...(Object.keys(envVars).length > 0 && { envs: envVars }),
  })

  // Wait for server to be ready (exponential backoff: 200ms, 400ms, 800ms... cap 5s)
  console.log(`[sandbox-agent:${sandboxId}] Waiting for server health...`)
  const MAX_HEALTH_WAIT_MS = 60_000
  let healthElapsed = 0
  let healthDelay = 200
  let healthAttempts = 0

  while (healthElapsed < MAX_HEALTH_WAIT_MS) {
    healthAttempts++
    try {
      const healthResult = await sandbox.commands.run(
        `curl -sf -H "Authorization: Bearer ${sandboxToken}" http://localhost:${SANDBOX_AGENT_PORT}/v1/health --connect-timeout 2 --max-time 3`,
      )
      if (healthResult.exitCode === 0) {
        console.log(`[sandbox-agent:${sandboxId}] Server healthy after ${healthAttempts} attempts (${healthElapsed}ms)`)
        break
      }
    } catch {
      // Not ready yet
    }

    if (healthElapsed + healthDelay >= MAX_HEALTH_WAIT_MS) {
      throw new Error(`sandbox-agent server failed to start within ${MAX_HEALTH_WAIT_MS / 1000}s (${healthAttempts} attempts)`)
    }

    await new Promise((r) => setTimeout(r, healthDelay))
    healthElapsed += healthDelay
    healthDelay = Math.min(healthDelay * 2, 5000)
  }

  const host = sandbox.getHost(SANDBOX_AGENT_PORT)
  const url = `https://${host}`
  console.log(`[sandbox-agent:${sandboxId}] Server ready at ${url}`)

  // Verify external connectivity (health requires Bearer token when --token is used)
  await new Promise((r) => setTimeout(r, 2000))
  for (let i = 0; i < 5; i++) {
    try {
      const res = await fetch(`${url}/v1/health`, {
        headers: { Authorization: `Bearer ${sandboxToken}` },
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

  return { url, token: sandboxToken }
}

/**
 * Check if a sandbox-agent server is healthy.
 * Clears client cache on failure so stale clients aren't reused.
 * Returns true if healthy, false otherwise.
 * @param token - Required when server was started with --token
 */
export async function checkSandboxAgentHealth(baseUrl: string, token?: string): Promise<boolean> {
  try {
    const headers: Record<string, string> = {}
    if (token) headers['Authorization'] = `Bearer ${token}`
    const res = await fetch(`${baseUrl}/v1/health`, {
      headers,
      signal: AbortSignal.timeout(5000),
    })
    if (res.ok) return true
  } catch {
    // Health check failed
  }

  // Unhealthy — clear cached client
  console.warn(`[sandbox-agent] Health check failed for ${baseUrl}, clearing cache`)
  const cached = clientCache.get(baseUrl)
  if (cached) {
    try { await cached.client.dispose() } catch { /* ignore */ }
    clientCache.delete(baseUrl)
  }
  return false
}

/**
 * Connect to a sandbox-agent server.
 * Health-checks cached clients before reuse, disposes stale ones.
 * Evicts TTL-expired entries on each call.
 */
export async function connectToSandboxAgent(baseUrl: string, token?: string): Promise<SandboxAgent> {
  evictStaleClients()

  const cached = clientCache.get(baseUrl)
  if (cached) {
    // Verify cached client is still healthy
    const healthy = await checkSandboxAgentHealth(baseUrl, token ?? cached.token)
    if (healthy) {
      cached.lastUsed = Date.now()
      return cached.client
    }
    // Cache was already cleared by checkSandboxAgentHealth
  }

  const client = await SandboxAgent.connect({
    baseUrl,
    ...(token && { token }),
    waitForHealth: { timeoutMs: 15000 },
  })

  clientCache.set(baseUrl, { client, token: token ?? '', lastUsed: Date.now() })
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
  config: AgentSessionConfig = {},
): Promise<{ sessionId: string; session: Session }> {
  const agentConfig = getAgent(agentType) || getAgent(getDefaultAgentId())!

  console.log(
    `[sandbox-agent] Creating session for agent: ${agentConfig.sandboxAgentName}, cwd: ${workingDir}, mode: ${config.mode ?? 'default'}, model: ${config.model ?? 'default'}`,
  )

  await syncSharedMcpConfigs(client, workingDir)

  const session = await client.createSession({
    agent: agentConfig.sandboxAgentName,
    sessionInit: {
      cwd: workingDir,
      mcpServers: [],
    },
    mode: config.mode,
    // model omitted — set below with graceful fallback for agents that don't support session/set_config_option
  })

  if (config.model) {
    try {
      await session.setModel(config.model)
    } catch {
      // Agent doesn't support session/set_config_option — use default model (expected for opencode)
    }
  }

  console.log(`[sandbox-agent] Session created: ${session.id}`)

  return {
    sessionId: session.id,
    session,
  }
}

export async function configureAgentSession(
  session: Session,
  config: AgentSessionConfig,
): Promise<void> {
  if (config.mode) {
    await session.setMode(config.mode)
  }

  if (config.model) {
    try {
      await session.setModel(config.model)
    } catch {
      // Agent doesn't support session/set_config_option — use default model
    }
  }
}

export async function validateAgentRuntime(
  client: SandboxAgent,
  agentType: string,
): Promise<void> {
  const agentConfig = getAgent(agentType) || getAgent(getDefaultAgentId())!
  const agentInfo = await client.getAgent(agentConfig.sandboxAgentName, {
    config: true,
    noCache: true,
  })

  if (!agentInfo.installed) {
    throw new Error(`${agentConfig.name} is not installed in sandbox-agent`)
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

// Default timeout for prompt calls (5 minutes)
const PROMPT_TIMEOUT_MS = 5 * 60 * 1000

/**
 * Send a prompt to an agent session and return when the turn completes.
 * Events stream via session.onEvent() callback registered before calling this.
 * Times out after 5 minutes to prevent indefinite hangs.
 *
 * Replaces promptOpenCode()
 */
export async function promptAgent(
  session: Session,
  content: string,
): Promise<{ response: unknown }> {
  console.log(`[sandbox-agent] Sending prompt (${content.length} chars) to session ${session.id}`)

  const response = await Promise.race([
    session.prompt([{ type: 'text', text: content }]),
    new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error(`Prompt timed out after ${PROMPT_TIMEOUT_MS / 1000}s`)),
        PROMPT_TIMEOUT_MS,
      ),
    ),
  ])

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
  const cached = clientCache.get(baseUrl)
  if (cached) {
    await cached.client.dispose()
    clientCache.delete(baseUrl)
  }
}

/**
 * Clean up all cached clients.
 */
export async function cleanupAllClients(): Promise<void> {
  for (const [, entry] of clientCache) {
    try {
      await entry.client.dispose()
    } catch {
      // Ignore cleanup errors
    }
  }
  clientCache.clear()
}
