/**
 * E2B Sandbox Wrapper
 *
 * Provides lifecycle management for E2B sandboxes:
 * - Create: Provision new sandbox with auto-pause enabled
 * - Resume: Reconnect to existing sandbox
 * - Pause: Manually pause sandbox to control costs
 *
 * Pattern from RESEARCH.md: Use Sandbox.create() with autoPause for cost control
 */

import { Sandbox } from '@e2b/code-interpreter'

// E2B API error types
export class E2BError extends Error {
  constructor(
    message: string,
    public code: string,
    public sandboxId?: string,
  ) {
    super(message)
    this.name = 'E2BError'
  }
}

// Sandbox configuration options
export interface SandboxConfig {
  sessionId: string
  timeoutMs?: number
  autoPause?: boolean
  metadata?: Record<string, string>
}

// Sandbox info returned after creation/resume
export interface SandboxInfo {
  id: string
  status: 'active' | 'paused' | 'error'
  createdAt: number
  metadata?: Record<string, string>
}

/**
 * Create a new sandbox for a session
 * Uses Sandbox.betaCreate() with autoPause enabled per RESEARCH.md Pattern 1
 *
 * @param apiKey - E2B API key
 * @param config - Sandbox configuration including sessionId for metadata
 * @returns SandboxInfo with id and status
 */
export async function createSessionSandbox(apiKey: string, config: SandboxConfig): Promise<SandboxInfo> {
  const timeoutMs = config.timeoutMs ?? 5 * 60 * 1000 // 5-minute default timeout

  try {
    const sandbox = await Sandbox.betaCreate({
      apiKey,
      autoPause: true, // Enable auto-pause for cost control
      timeoutMs,
      metadata: {
        sessionId: config.sessionId,
        ...config.metadata,
      },
    })

    return {
      id: sandbox.sandboxId,
      status: 'active',
      createdAt: Date.now(),
      metadata: {
        sessionId: config.sessionId,
        ...config.metadata,
      },
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown E2B error'
    throw new E2BError(`Failed to create sandbox: ${message}`, 'CREATE_FAILED')
  }
}

/**
 * Resume an existing sandbox
 * Used when SessionDO wakes from hibernation and reconnects to sandbox
 *
 * E2B Pattern: Use Sandbox.connect() to reconnect to existing sandbox
 * The connect() method automatically resumes paused sandboxes
 *
 * @param apiKey - E2B API key
 * @param sandboxId - The sandbox ID to resume
 * @returns SandboxInfo with current status
 */
export async function resumeSandbox(apiKey: string, sandboxId: string): Promise<SandboxInfo> {
  try {
    // Connect to the existing sandbox (auto-resumes if paused)
    const sandbox = await Sandbox.connect(sandboxId, {
      apiKey,
      timeoutMs: 5 * 60 * 1000,
    })

    return {
      id: sandbox.sandboxId,
      status: 'active',
      createdAt: Date.now(), // We don't track original creation time
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown E2B error'
    throw new E2BError(`Failed to resume sandbox: ${message}`, 'RESUME_FAILED', sandboxId)
  }
}

/**
 * Manually pause a sandbox to control costs
 * Called during idle periods or session cleanup
 *
 * E2B Pattern: Use betaPause() method on sandbox instance
 *
 * @param apiKey - E2B API key
 * @param sandboxId - The sandbox ID to pause
 */
export async function pauseSandbox(apiKey: string, sandboxId: string): Promise<void> {
  try {
    // Connect to the specific sandbox
    const sandbox = await Sandbox.connect(sandboxId, {
      apiKey,
      timeoutMs: 5 * 60 * 1000,
    })

    // Use betaPause() to pause the sandbox
    // This is the recommended method for explicit cost control
    await sandbox.betaPause()
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown E2B error'
    throw new E2BError(`Failed to pause sandbox: ${message}`, 'PAUSE_FAILED', sandboxId)
  }
}

/**
 * Terminate a sandbox permanently
 * Used when deleting a session to ensure sandbox is cleaned up
 *
 * @param apiKey - E2B API key
 * @param sandboxId - The sandbox ID to terminate
 */
export async function terminateSandbox(apiKey: string, sandboxId: string): Promise<void> {
  try {
    await Sandbox.kill(sandboxId, { apiKey })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown E2B error'
    throw new E2BError(`Failed to terminate sandbox: ${message}`, 'TERMINATE_FAILED', sandboxId)
  }
}

/**
 * Get sandbox status without modifying state
 * Used for health checks and monitoring
 *
 * @param apiKey - E2B API key
 * @param sandboxId - The sandbox ID to check
 * @returns SandboxInfo with current status
 */
export async function getSandboxStatus(apiKey: string, sandboxId: string): Promise<SandboxInfo> {
  try {
    const sandbox = await Sandbox.connect(sandboxId, {
      apiKey,
      timeoutMs: 5 * 60 * 1000,
    })

    return {
      id: sandbox.sandboxId,
      status: 'active',
      createdAt: Date.now(),
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown E2B error'
    throw new E2BError(`Failed to get sandbox status: ${message}`, 'STATUS_FAILED', sandboxId)
  }
}

/**
 * SandboxManager class
 * Encapsulates sandbox lifecycle for SessionDO integration
 *
 * Usage:
 *   const manager = new SandboxManager(apiKey, sessionId)
 *   await manager.provision()  // Creates new sandbox
 *   await manager.resume()     // Reconnects to existing
 *   await manager.pause()      // Pauses for cost control
 */
export class SandboxManager {
  private apiKey: string
  private sessionId: string
  private _sandboxId: string | null = null

  constructor(apiKey: string, sessionId: string) {
    this.apiKey = apiKey
    this.sessionId = sessionId
  }

  /**
   * Get the current sandbox ID (if provisioned)
   */
  get sandboxId(): string | null {
    return this._sandboxId
  }

  /**
   * Provision a new sandbox for this session
   * @returns SandboxInfo
   */
  async provision(): Promise<SandboxInfo> {
    const info = await createSessionSandbox(this.apiKey, {
      sessionId: this.sessionId,
      autoPause: true, // Always enable auto-pause for cost control
    })

    this._sandboxId = info.id
    return info
  }

  /**
   * Resume an existing sandbox
   * @param sandboxId - The sandbox ID to resume
   * @returns SandboxInfo
   */
  async resume(sandboxId: string): Promise<SandboxInfo> {
    const info = await resumeSandbox(this.apiKey, sandboxId)
    this._sandboxId = info.id
    return info
  }

  /**
   * Pause the current sandbox
   */
  async pause(): Promise<void> {
    if (!this._sandboxId) {
      throw new E2BError('No sandbox to pause', 'NO_SANDBOX')
    }

    await pauseSandbox(this.apiKey, this._sandboxId)
  }

  /**
   * Terminate the current sandbox
   */
  async terminate(): Promise<void> {
    if (!this._sandboxId) {
      throw new E2BError('No sandbox to terminate', 'NO_SANDBOX')
    }

    await terminateSandbox(this.apiKey, this._sandboxId)
    this._sandboxId = null
  }

  /**
   * Get current sandbox status
   */
  async getStatus(): Promise<SandboxInfo> {
    if (!this._sandboxId) {
      throw new E2BError('No sandbox to check', 'NO_SANDBOX')
    }

    return await getSandboxStatus(this.apiKey, this._sandboxId)
  }

  /**
   * Update the tracked sandbox ID (from storage)
   * Used when SessionDO retrieves sandboxId from SQLite
   */
  setSandboxId(id: string | null): void {
    this._sandboxId = id
  }
}

async function resolveSandboxHome(sandbox: Sandbox, sandboxId?: string): Promise<string> {
  try {
    const homeResult = await sandbox.commands.run('echo $HOME')
    const homeDir = homeResult.stdout.trim()
    if (homeDir) {
      return homeDir
    }
  } catch (error) {
    console.warn(
      `[opencode${sandboxId ? `:${sandboxId}` : ''}] Failed to resolve $HOME, falling back to /home/user`,
      error,
    )
  }

  return '/home/user'
}

async function checkOpenCodeServer(
  sandbox: Sandbox,
  port: number,
): Promise<{ ok: boolean; code: string; details?: string }> {
  try {
    // Try health endpoint first
    const healthResult = await sandbox.commands.run(
      `curl -s -w "%{http_code}\n%{time_total}\n%{size_download}" -o /dev/null http://localhost:${port}/health --connect-timeout 3 --max-time 5`,
    )
    const [healthCode, timeTaken, sizeDownload] = healthResult.stdout.trim().split('\n')

    if (healthCode === '200' && parseFloat(timeTaken) < 2) {
      return { ok: true, code: healthCode, details: `health:${timeTaken}s` }
    }

    // Try root endpoint as fallback
    const rootResult = await sandbox.commands.run(
      `curl -s -w "%{http_code}\n%{time_total}" -o /dev/null http://localhost:${port}/ --connect-timeout 3 --max-time 5`,
    )
    const [rootCode, rootTime] = rootResult.stdout.trim().split('\n')

    if (rootCode && rootCode !== '000' && rootCode !== '000' && parseFloat(rootTime) < 2) {
      return { ok: true, code: rootCode, details: `root:${rootTime}s` }
    }

    return {
      ok: false,
      code: rootCode || healthCode || '000',
      details: `health:${healthCode}(${timeTaken}s),root:${rootCode}(${rootTime}s)`,
    }
  } catch (error) {
    return { ok: false, code: '000', details: error instanceof Error ? error.message : 'Unknown error' }
  }
}

/**
 * Start OpenCode server in sandbox and return public URL
 * Installs OpenCode if not present, then starts the server
 *
 * @param apiKey - E2B API key
 * @param sandboxId - The sandbox ID to connect to
 * @param anthropicKey - Anthropic API key for OpenCode
 * @returns Object with URL and process handle
 */
export async function startOpenCodeServer(
  apiKey: string,
  sandboxId: string,
  anthropicKey: string,
): Promise<{ url: string; process: unknown }> {
  const sandbox = await Sandbox.connect(sandboxId, { apiKey })
  const homeDir = await resolveSandboxHome(sandbox, sandboxId)

  const existingServer = await checkOpenCodeServer(sandbox, 4096)
  if (existingServer.ok) {
    const host = sandbox.getHost(4096)
    const url = `https://${host}`
    console.log(`[opencode:${sandboxId}] Existing server detected (status ${existingServer.code}). Using ${url}`)
    return { url, process: null }
  }

  console.log(`[opencode:${sandboxId}] Checking if OpenCode is installed...`)

  // Check if opencode binary exists
  const whichResult = await sandbox.commands.run(
    `PATH="${homeDir}/.opencode/bin:$PATH" which opencode || echo "NOT_FOUND"`,
  )
  console.log(`[opencode:${sandboxId}] which opencode: ${whichResult.stdout.trim()}`)

  if (whichResult.stdout.includes('NOT_FOUND')) {
    console.log(`[opencode:${sandboxId}] OpenCode not found, checking .opencode directory...`)

    // Check if .opencode exists (installation directory)
    const checkDirResult = await sandbox.commands.run(`ls -la "${homeDir}/.opencode" 2>&1 || echo "DIR_NOT_FOUND"`)
    console.log(`[opencode:${sandboxId}] .opencode directory: ${checkDirResult.stdout.slice(0, 200)}`)

    // Try to find the binary in common locations
    const findResult = await sandbox.commands.run(`find "${homeDir}" -name "opencode" -type f 2>/dev/null | head -5`)
    console.log(`[opencode:${sandboxId}] find result: ${findResult.stdout}`)

    // Install OpenCode if not found
    console.log(`[opencode:${sandboxId}] Installing OpenCode CLI...`)
    const installResult = await sandbox.commands.run('curl -fsSL https://opencode.ai/install | bash', {
      timeoutMs: 120000,
      onStdout: (data: string) => console.log(`[opencode:install] ${data}`),
      onStderr: (data: string) => console.error(`[opencode:install] ${data}`),
    })
    console.log(`[opencode:${sandboxId}] Install exit code: ${installResult.exitCode}`)

    if (installResult.exitCode !== 0) {
      throw new Error(`Failed to install OpenCode: ${installResult.stderr}`)
    }
  }

  // Get the actual path to opencode binary (check multiple locations)
  let opencodePath = ''
  try {
    const resolvedWhich = await sandbox.commands.run(
      `PATH="${homeDir}/.opencode/bin:$PATH" which opencode || echo "NOT_FOUND"`,
    )
    if (!resolvedWhich.stdout.includes('NOT_FOUND')) {
      opencodePath = resolvedWhich.stdout.trim().split('\n')[0]
      console.log(`[opencode:${sandboxId}] Found opencode via PATH: ${opencodePath}`)
    }
  } catch {
    // Fallback to explicit path checks
  }

  if (!opencodePath) {
    const pathResult = await sandbox.commands.run(
      `ls -la "${homeDir}/.opencode/bin/opencode" 2>/dev/null || echo "NOT_FOUND"`,
    )
    if (!pathResult.stdout.includes('NOT_FOUND') && !pathResult.stdout.includes('No such file')) {
      opencodePath = `${homeDir}/.opencode/bin/opencode`
      console.log(`[opencode:${sandboxId}] Found opencode at: ${opencodePath}`)
    }
  }

  if (!opencodePath) {
    throw new Error('Could not find opencode binary after installation')
  }

  // Write opencode.json with MCP servers (grep, deepwiki, context7, exa) so they load in the sandbox session
  const opencodeConfig = {
    $schema: 'https://opencode.ai/config.json',
    mcp: {
      grep: { type: 'remote', url: 'https://mcp.grep.app', enabled: true },
      deepwiki: { type: 'remote', url: 'https://mcp.deepwiki.com/mcp', enabled: true },
      context7: {
        type: 'remote',
        url: 'https://mcp.context7.com/mcp',
        headers: { CONTEXT7_API_KEY: '{env:CONTEXT7_API_KEY}' },
        enabled: true,
      },
      exa: { type: 'remote', url: 'https://mcp.exa.ai/mcp', enabled: true },
    },
    tools: { 'grep*': true, 'deepwiki*': true, 'context7*': true, 'exa*': true },
  }
  const configPath = `${homeDir}/opencode.json`
  try {
    await sandbox.files.write(configPath, JSON.stringify(opencodeConfig, null, 2))
    console.log(`[opencode:${sandboxId}] Wrote opencode.json with MCP servers (grep, deepwiki, context7, exa)`)
  } catch (writeErr) {
    console.warn(`[opencode:${sandboxId}] Failed to write opencode.json (MCPs may not load):`, writeErr)
  }

  // Set up environment and start server
  console.log(`[opencode:${sandboxId}] Starting OpenCode server on port 4096...`)

  // Start the server as background process with full output capture
  // Use full path to binary and explicit environment
  // Determine correct host flag (varies by CLI version)
  let hostFlag = '--hostname'
  try {
    const helpResult = await sandbox.commands.run(`${opencodePath} serve --help`)
    const helpText = helpResult.stdout || ''
    const hasHost = /(^|\s)--host(\s|,|$)/.test(helpText)
    const hasHostname = /(^|\s)--hostname(\s|,|$)/.test(helpText)
    if (hasHost) {
      hostFlag = '--host'
    } else if (hasHostname) {
      hostFlag = '--hostname'
    } else {
      hostFlag = ''
    }
  } catch {
    // Keep default host flag
  }

  const hostArg = hostFlag ? `${hostFlag} 0.0.0.0` : ''
  const serverCmd = `export ANTHROPIC_API_KEY="${anthropicKey}" && export PATH="${homeDir}/.opencode/bin:$PATH" && cd "${homeDir}" && ${opencodePath} serve --port 4096${hostArg ? ` ${hostArg}` : ''} 2>&1`
  console.log(`[opencode:${sandboxId}] Running: ${serverCmd.replace(anthropicKey, '[REDACTED]')}`)

  const proc = await sandbox.commands.run(serverCmd, {
    background: true,
    onStdout: (data: string) => {
      console.log(`[opencode:server] ${data}`)
    },
    onStderr: (data: string) => {
      console.error(`[opencode:server] ${data}`)
    },
  })

  console.log(`[opencode:${sandboxId}] Server process started`)

  // Wait for server to be ready (poll every 500ms for up to 30 seconds)
  await waitForOpenCodeServer(sandbox, 4096, 60, sandboxId, 500)
  console.log(`[opencode:${sandboxId}] Server is ready`)

  // Get public URL for OpenCode server
  const host = sandbox.getHost(4096)
  const url = `https://${host}`
  console.log(`[opencode:${sandboxId}] Server URL: ${url}`)

  // Wait for port forwarding to stabilize and verify health thoroughly
  console.log(`[opencode:${sandboxId}] Verifying server health and port forwarding...`)

  // First, wait for port forwarding to stabilize
  await new Promise((resolve) => setTimeout(resolve, 3000))

  // Then verify the server is actually responsive to API calls
  for (let i = 0; i < 10; i++) {
    try {
      // Test both global health and a simple API endpoint
      const [healthCheck, providersCheck] = await Promise.allSettled([
        fetch(`${url}/global/health`, {
          signal: AbortSignal.timeout(5000),
          headers: { 'User-Agent': 'ship-verify/1.0' },
        }),
        fetch(`${url}/global/providers`, {
          signal: AbortSignal.timeout(5000),
          headers: { 'User-Agent': 'ship-verify/1.0' },
        }),
      ])

      const healthOk = healthCheck.status === 'fulfilled' && healthCheck.value.ok
      const providersOk = providersCheck.status === 'fulfilled' && providersCheck.value.ok

      if (healthOk && providersOk) {
        console.log(`[opencode:${sandboxId}] ✅ Server fully verified (attempt ${i + 1}/10)`)
        break
      } else {
        const healthStatus = healthCheck.status === 'rejected' ? 'failed' : healthCheck.value.status
        const providersStatus = providersCheck.status === 'rejected' ? 'failed' : providersCheck.value.status
        console.log(
          `[opencode:${sandboxId}] Health check ${i + 1}/10: health=${healthStatus}, providers=${providersStatus}`,
        )
      }
    } catch (err) {
      console.log(
        `[opencode:${sandboxId}] External verification attempt ${i + 1}/10 failed:`,
        err instanceof Error ? err.message : err,
      )
    }

    if (i < 9) {
      await new Promise((resolve) => setTimeout(resolve, 1000))
    }
  }

  return { url, process: proc }
}

/**
 * Wait for OpenCode server to be ready by polling health endpoint
 *
 * @param sandbox - E2B sandbox instance
 * @param port - Port to check
 * @param maxAttempts - Maximum number of attempts (default 60 = 60 seconds)
 * @param sandboxId - Sandbox ID for logging
 */
async function waitForOpenCodeServer(
  sandbox: Sandbox,
  port: number,
  maxAttempts = 60,
  sandboxId?: string,
  pollIntervalMs = 1000,
): Promise<void> {
  const logPrefix = sandboxId ? `[opencode:${sandboxId}]` : '[opencode]'
  console.log(`${logPrefix} Waiting for server on port ${port}...`)

  let lastCheckDetails = ''
  for (let i = 0; i < maxAttempts; i++) {
    const check = await checkOpenCodeServer(sandbox, port)
    if (check.ok) {
      console.log(
        `${logPrefix} ✅ Server responded with ${check.code} in ${((i * pollIntervalMs) / 1000).toFixed(1)}s${check.details ? ` (${check.details})` : ''}`,
      )
      return
    }

    // Log changes in check details for debugging
    if (check.details && check.details !== lastCheckDetails) {
      console.log(`${logPrefix} Health check changed: ${check.details}`)
      lastCheckDetails = check.details
    }

    // Log progress every ~5 seconds
    if (i > 0 && i % Math.ceil(5000 / pollIntervalMs) === 0) {
      console.log(`${logPrefix} Still waiting... (${((i * pollIntervalMs) / 1000).toFixed(0)}s)`)
    }

    await new Promise((r) => setTimeout(r, pollIntervalMs))
  }

  // On failure, get detailed diagnostics
  console.error(`${logPrefix} ❌ Server failed to start. Getting diagnostics...`)
  try {
    const psResult = await sandbox.commands.run(
      'ps aux | grep -E "opencode|node" | grep -v grep || echo "No matching processes"',
    )
    console.error(`${logPrefix} Running processes: ${psResult.stdout}`)
  } catch {}

  try {
    const logResult = await sandbox.commands.run('cat /tmp/opencode.log 2>/dev/null || echo "No log file"')
    console.error(`${logPrefix} Log file: ${logResult.stdout.slice(0, 500)}`)
  } catch {}

  try {
    // Final health check with more details
    const finalCheck = await checkOpenCodeServer(sandbox, port)
    console.error(`${logPrefix} Final health check result:`, finalCheck)
  } catch {}

  throw new Error(`OpenCode server failed to start within ${maxAttempts} seconds`)
}

/**
 * Get the public URL for a port in the sandbox
 *
 * @param apiKey - E2B API key
 * @param sandboxId - The sandbox ID
 * @param port - The port number
 * @returns Public URL string
 */
export async function getSandboxPortUrl(apiKey: string, sandboxId: string, port: number): Promise<string> {
  const sandbox = await Sandbox.connect(sandboxId, { apiKey })
  const host = sandbox.getHost(port)
  return `https://${host}`
}

// Re-export types from E2B SDK for convenience
export { Sandbox } from '@e2b/code-interpreter'

/**
 * Test function to verify OpenCode server startup
 * Can be called manually to debug issues
 */
export async function testOpenCodeServerStartup(apiKey: string, anthropicKey: string): Promise<void> {
  console.log('[test] Creating test sandbox...')
  const sandbox = await Sandbox.betaCreate({ apiKey, autoPause: true })
  console.log(`[test] Sandbox created: ${sandbox.sandboxId}`)

  try {
    console.log('[test] Starting OpenCode server...')
    const { url } = await startOpenCodeServer(apiKey, sandbox.sandboxId, anthropicKey)
    console.log(`[test] SUCCESS! Server running at ${url}`)

    // Test health endpoint from outside
    const healthRes = await fetch(`${url}/health`)
    console.log(`[test] External health check: ${healthRes.status}`)
  } catch (error) {
    console.error('[test] FAILED:', error)
    throw error
  } finally {
    // Cleanup
    await Sandbox.kill(sandbox.sandboxId, { apiKey })
    console.log('[test] Test sandbox cleaned up')
  }
}
