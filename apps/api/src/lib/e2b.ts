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

import { Effect } from 'effect'
import {
  buildComputeCreateOptions,
  E2B_TEMPLATE_ID,
  SandboxLifecycle,
  SandboxLifecycleLive,
  type SandboxConfig,
  type SandboxInfo,
  type SandboxLifecycleService,
} from '../effect/sandbox-lifecycle'
import { ComputeSandboxesLive, type ComputeSandboxes } from '../effect/compute'
import type { AppError } from '../effect/errors'
import { runPromise } from '../effect/runtime'

export { buildComputeCreateOptions, E2B_TEMPLATE_ID }

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

export type { SandboxConfig, SandboxInfo }

function causeMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'cause' in error) {
    const cause = (error as { cause?: unknown }).cause
    if (cause instanceof Error) return cause.message
    if (cause != null) return String(cause)
  }
  return error instanceof Error ? error.message : String(error)
}

function toE2BError(error: AppError, action: string, code: string, sandboxId?: string): E2BError {
  return new E2BError(`Failed to ${action}: ${causeMessage(error)}`, code, sandboxId)
}

function runLifecycle<A>(
  use: (lifecycle: SandboxLifecycleService) => Effect.Effect<A, AppError, ComputeSandboxes>,
): Promise<A> {
  return runPromise(
    Effect.gen(function* () {
      const lifecycle = yield* SandboxLifecycle
      return yield* use(lifecycle)
    }).pipe(Effect.provide(SandboxLifecycleLive), Effect.provide(ComputeSandboxesLive)),
  )
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
  try {
    return await runLifecycle((lifecycle) => lifecycle.createSession(apiKey, config))
  } catch (error) {
    throw toE2BError(error as AppError, 'create sandbox', 'CREATE_FAILED')
  }
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
  try {
    return await runLifecycle((lifecycle) => lifecycle.resume(apiKey, sandboxId))
  } catch (error) {
    throw toE2BError(error as AppError, 'resume sandbox', 'RESUME_FAILED', sandboxId)
  }
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
    await runLifecycle((lifecycle) => lifecycle.pause(apiKey, sandboxId))
  } catch (error) {
    throw toE2BError(error as AppError, 'pause sandbox', 'PAUSE_FAILED', sandboxId)
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
    await runLifecycle((lifecycle) => lifecycle.terminate(apiKey, sandboxId))
  } catch (error) {
    throw toE2BError(error as AppError, 'terminate sandbox', 'TERMINATE_FAILED', sandboxId)
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
    return await runLifecycle((lifecycle) => lifecycle.getStatus(apiKey, sandboxId))
  } catch (error) {
    throw toE2BError(error as AppError, 'get sandbox status', 'STATUS_FAILED', sandboxId)
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
  try {
    return await runLifecycle((lifecycle) => lifecycle.getPortUrl(apiKey, sandboxId, port))
  } catch (error) {
    throw toE2BError(error as AppError, 'get sandbox port URL', 'PORT_URL_FAILED', sandboxId)
  }
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
  try {
    await runLifecycle((lifecycle) => lifecycle.refreshTimeout(apiKey, sandboxId, timeoutMs))
  } catch (error) {
    throw toE2BError(error as AppError, 'refresh sandbox timeout', 'REFRESH_TIMEOUT_FAILED', sandboxId)
  }
}
