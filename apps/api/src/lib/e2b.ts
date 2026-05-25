/**
 * E2B Sandbox Wrapper
 *
 * Provides lifecycle management for E2B sandboxes:
 * - Create: Provision new sandbox with pause-on-timeout enabled
 * - Resume: Reconnect to existing sandbox
 * - Pause: Manually pause sandbox to control costs
 *
 * Pattern: Use Compute SDK's E2B provider with pause-on-timeout lifecycle for cost control.
 */

import {
  connectComputeSandbox,
  createComputeSandbox,
  destroyComputeSandbox,
  getNativeE2BSandbox,
  requireComputeSandbox,
  type ShipComputeCreateOptions,
} from './compute-provider'

/**
 * Custom E2B template id pre-baked with common dev tooling
 * (node, bun, jq, ripgrep, build-essential). Falls back to E2B's default
 * image if empty. Build with `e2b template build` from `e2b/Dockerfile`.
 */
export const E2B_TEMPLATE_ID = 'n1exdf9kj7gpwk6810c9'

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
  /** Env vars for sandbox (e.g. ANTHROPIC_API_KEY, OPENAI_API_KEY). Available to all processes. */
  envs?: Record<string, string>
}

// Sandbox info returned after creation/resume
export interface SandboxInfo {
  id: string
  status: 'active' | 'paused' | 'error'
  createdAt: number
  metadata?: Record<string, string>
}

function isE2BRateLimitError(error: unknown): boolean {
  const msg = (error instanceof Error ? error.message : String(error)).toLowerCase()
  return msg.includes('429') || msg.includes('rate limit') || msg.includes('too many requests')
}

/** Convert Ship's lifecycle config to Compute SDK create options. */
export function buildComputeCreateOptions(config: SandboxConfig): ShipComputeCreateOptions {
  const timeoutMs = config.timeoutMs ?? 5 * 60 * 1000
  const hasEnvs = config.envs && Object.keys(config.envs).length > 0
  return {
    ...(E2B_TEMPLATE_ID ? { templateId: E2B_TEMPLATE_ID } : {}),
    lifecycle: { onTimeout: config.autoPause === false ? 'kill' : 'pause' },
    timeout: timeoutMs,
    metadata: {
      sessionId: config.sessionId,
      ...config.metadata,
    },
    ...(hasEnvs ? { envs: config.envs } : {}),
  }
}

async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

/**
 * Create a new sandbox for a session
 * Uses Compute SDK create with pause-on-timeout lifecycle enabled.
 * Retries with backoff on E2B 429 (sandbox creation rate: 1/sec on Hobby plan)
 *
 * @param apiKey - E2B API key
 * @param config - Sandbox configuration including sessionId for metadata
 * @returns SandboxInfo with id and status
 */
export async function createSessionSandbox(apiKey: string, config: SandboxConfig): Promise<SandboxInfo> {
  const maxRetries = 3
  const baseDelayMs = 2000

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const sandbox = await createComputeSandbox(apiKey, buildComputeCreateOptions(config))

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
      if (attempt < maxRetries && isE2BRateLimitError(error)) {
        const delay = baseDelayMs * Math.pow(2, attempt)
        await sleep(delay)
        continue
      }
      throw new E2BError(`Failed to create sandbox: ${message}`, 'CREATE_FAILED')
    }
  }

  throw new E2BError('Failed to create sandbox after retries', 'CREATE_FAILED')
}

/**
 * Resume an existing sandbox
 * Used when SessionDO wakes from hibernation and reconnects to sandbox
 *
 * Compute SDK's getById() reconnects to the existing sandbox.
 * Retries with backoff on E2B 429
 *
 * @param apiKey - E2B API key
 * @param sandboxId - The sandbox ID to resume
 * @returns SandboxInfo with current status
 */
export async function resumeSandbox(apiKey: string, sandboxId: string): Promise<SandboxInfo> {
  const maxRetries = 2
  const baseDelayMs = 1500

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const sandbox = await connectComputeSandbox(apiKey, sandboxId)
      if (!sandbox) throw new Error('Sandbox not found')
      await getNativeE2BSandbox(sandbox).setTimeout(5 * 60 * 1000)

      return {
        id: sandbox.sandboxId,
        status: 'active',
        createdAt: Date.now(), // We don't track original creation time
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown E2B error'
      if (attempt < maxRetries && isE2BRateLimitError(error)) {
        const delay = baseDelayMs * Math.pow(2, attempt)
        await sleep(delay)
        continue
      }
      throw new E2BError(`Failed to resume sandbox: ${message}`, 'RESUME_FAILED', sandboxId)
    }
  }

  throw new E2BError('Failed to resume sandbox after retries', 'RESUME_FAILED', sandboxId)
}

/**
 * Manually pause a sandbox to control costs
 * Called during idle periods or session cleanup
 *
 * E2B pause remains provider-specific and is accessed via getInstance().
 *
 * @param apiKey - E2B API key
 * @param sandboxId - The sandbox ID to pause
 */
export async function pauseSandbox(apiKey: string, sandboxId: string): Promise<void> {
  try {
    const sandbox = await requireComputeSandbox(apiKey, sandboxId)
    await getNativeE2BSandbox(sandbox).pause()
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
    await destroyComputeSandbox(apiKey, sandboxId)
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
    const sandbox = await connectComputeSandbox(apiKey, sandboxId)
    if (!sandbox) throw new Error('Sandbox not found')

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
   * @param envs - Optional env vars (ANTHROPIC_API_KEY, OPENAI_API_KEY, etc.) for agent auth
   * @returns SandboxInfo
   */
  async provision(envs?: Record<string, string>): Promise<SandboxInfo> {
    const info = await createSessionSandbox(this.apiKey, {
      sessionId: this.sessionId,
      autoPause: true, // Preserve API-level default: pause on timeout for cost control
      ...(envs && Object.keys(envs).length > 0 && { envs }),
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
 * Get the public URL for a port in the sandbox
 *
 * @param apiKey - E2B API key
 * @param sandboxId - The sandbox ID
 * @param port - The port number
 * @returns Public URL string
 */
export async function getSandboxPortUrl(apiKey: string, sandboxId: string, port: number): Promise<string> {
  const sandbox = await requireComputeSandbox(apiKey, sandboxId)
  return sandbox.getUrl({ port })
}

/**
 * Refresh the auto-pause timeout on a running sandbox
 * Call this on every user message to keep the sandbox alive during active chat
 *
 * @param apiKey - E2B API key
 * @param sandboxId - The sandbox ID to refresh
 * @param timeoutMs - New timeout in ms (default: 5 minutes)
 */
export async function refreshSandboxTimeout(apiKey: string, sandboxId: string, timeoutMs?: number): Promise<void> {
  const sandbox = await requireComputeSandbox(apiKey, sandboxId)
  await getNativeE2BSandbox(sandbox).setTimeout(timeoutMs ?? 5 * 60 * 1000)
}
