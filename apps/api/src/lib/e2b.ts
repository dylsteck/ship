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

  console.log(`[opencode:${sandboxId}] Checking if OpenCode is installed...`)

  // Check if opencode binary exists
  const whichResult = await sandbox.commands.run('which opencode || echo "NOT_FOUND"')
  console.log(`[opencode:${sandboxId}] which opencode: ${whichResult.stdout.trim()}`)

  if (whichResult.stdout.includes('NOT_FOUND')) {
    console.log(`[opencode:${sandboxId}] OpenCode not found, checking .opencode directory...`)

    // Check if .opencode exists (installation directory)
    const checkDirResult = await sandbox.commands.run('ls -la ~/.opencode 2>&1 || echo "DIR_NOT_FOUND"')
    console.log(`[opencode:${sandboxId}] .opencode directory: ${checkDirResult.stdout.slice(0, 200)}`)

    // Try to find the binary in common locations
    const findResult = await sandbox.commands.run('find /home -name "opencode" -type f 2>/dev/null | head -5')
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

  // Get the actual path to opencode binary
  const opencodePathResult = await sandbox.commands.run('which opencode')
  const opencodePath = opencodePathResult.stdout.trim()
  console.log(`[opencode:${sandboxId}] Using opencode at: ${opencodePath}`)

  // Set up environment and start server
  console.log(`[opencode:${sandboxId}] Starting OpenCode server on port 4096...`)

  // Export env var first, then start server (more reliable than inline env in sandbox)
  const setupCmd = `export ANTHROPIC_API_KEY="${anthropicKey}" && export PATH="$HOME/.opencode/bin:$PATH"`
  await sandbox.commands.run(setupCmd)

  // Start the server as background process with full output capture
  const serverCmd = `cd /home/user && ANTHROPIC_API_KEY="${anthropicKey}" opencode serve --port 4096 --host 0.0.0.0 2>&1`
  console.log(`[opencode:${sandboxId}] Running: ${serverCmd}`)

  const proc = await sandbox.commands.run(serverCmd, {
    background: true,
    onStdout: (data: string) => {
      console.log(`[opencode:server] ${data}`)
    },
    onStderr: (data: string) => {
      console.error(`[opencode:server] ${data}`)
    },
  })

  console.log(`[opencode:${sandboxId}] Server process started, PID check: ${proc ? 'yes' : 'no'}`)

  // Wait a moment for server to initialize
  await new Promise((r) => setTimeout(r, 2000))

  // Wait for server to be ready
  await waitForOpenCodeServer(sandbox, 4096, 60, sandboxId)
  console.log(`[opencode:${sandboxId}] Server is ready`)

  // Get public URL for the OpenCode server
  const host = sandbox.getHost(4096)
  const url = `https://${host}`
  console.log(`[opencode:${sandboxId}] Server URL: ${url}`)

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
): Promise<void> {
  const logPrefix = sandboxId ? `[opencode:${sandboxId}]` : '[opencode]'
  console.log(`${logPrefix} Waiting for server on port ${port}...`)

  for (let i = 0; i < maxAttempts; i++) {
    try {
      // Method 1: Try health endpoint
      const result = await sandbox.commands.run(
        `curl -s -o /dev/null -w "%{http_code}" http://localhost:${port}/health`,
      )
      if (result.stdout.trim() === '200') {
        console.log(`${logPrefix} Health check passed on attempt ${i + 1}`)
        return
      }

      // Log non-200 responses for debugging
      if (result.stdout.trim() && result.stdout.trim() !== '000') {
        console.log(`${logPrefix} Health check attempt ${i + 1}: HTTP ${result.stdout.trim()}`)
      }
    } catch (err) {
      // Log error every 5 attempts
      if (i % 5 === 0) {
        console.log(`${logPrefix} Health check attempt ${i + 1}: ${err instanceof Error ? err.message : 'error'}`)
      }
    }

    // Every 10 seconds, log status and check if process is running
    if (i > 0 && i % 10 === 0) {
      console.log(`${logPrefix} Still waiting for server... (${i}s)`)

      // Check what's listening on the port
      try {
        const netstatResult = await sandbox.commands.run(
          `netstat -tlnp 2>/dev/null | grep ${port} || ss -tlnp 2>/dev/null | grep ${port} || echo "No process on port ${port}"`,
        )
        console.log(`${logPrefix} Port ${port} status: ${netstatResult.stdout.trim()}`)
      } catch {
        // Ignore netstat errors
      }

      // Check if opencode process is running
      try {
        const psResult = await sandbox.commands.run(
          `ps aux | grep opencode | grep -v grep || echo "No opencode process"`,
        )
        console.log(`${logPrefix} Process check: ${psResult.stdout.trim().slice(0, 100)}`)
      } catch {
        // Ignore ps errors
      }
    }

    await new Promise((r) => setTimeout(r, 1000))
  }

  // On failure, get detailed diagnostics
  console.error(`${logPrefix} Server failed to start. Getting diagnostics...`)
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
