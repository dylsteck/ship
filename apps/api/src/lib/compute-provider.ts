/**
 * Compute SDK provider helpers for E2B-backed sandboxes.
 *
 * @packageDocumentation
 */

import { e2b, type E2BSandbox } from '@computesdk/e2b'
import { Sandbox as E2BControlPlane } from 'e2b'

/** Compute SDK provider instance configured for the E2B provider. */
export type ComputeProvider = ReturnType<typeof e2b>

/** Compute SDK sandbox wrapper returned by the E2B provider. */
export type ComputeSandbox = Awaited<ReturnType<ComputeProvider['sandbox']['create']>>

/** Sandbox create options supported by Ship's E2B template lifecycle. */
export interface ShipComputeCreateOptions {
  templateId?: string
  timeout?: number
  envs?: Record<string, string>
  metadata?: Record<string, string>
  lifecycle?: {
    onTimeout: 'pause' | 'kill'
  }
}

const providers = new Map<string, ComputeProvider>()

/** Get a lazily initialized Compute SDK provider for an E2B API key. */
export function getComputeProvider(apiKey: string): ComputeProvider {
  const existing = providers.get(apiKey)
  if (existing) return existing
  const provider = e2b({ apiKey })
  providers.set(apiKey, provider)
  return provider
}

/** Create a Compute SDK sandbox using Ship's typed option shape. */
export async function createComputeSandbox(
  apiKey: string,
  options: ShipComputeCreateOptions,
): Promise<ComputeSandbox> {
  return getComputeProvider(apiKey).sandbox.create(options)
}

/** Connect to an existing Compute SDK sandbox, preserving native E2B connection errors. */
export async function connectComputeSandbox(apiKey: string, sandboxId: string): Promise<ComputeSandbox | null> {
  await E2BControlPlane.connect(sandboxId, { apiKey })
  const sandbox = await getComputeProvider(apiKey).sandbox.getById(sandboxId)
  if (!sandbox) throw new Error(`Compute SDK failed to wrap connected sandbox: ${sandboxId}`)
  return sandbox
}

/** Connect to an existing Compute SDK sandbox or throw a contextual error. */
export async function requireComputeSandbox(apiKey: string, sandboxId: string): Promise<ComputeSandbox> {
  const sandbox = await connectComputeSandbox(apiKey, sandboxId)
  if (!sandbox) throw new Error(`Sandbox not found: ${sandboxId}`)
  return sandbox
}

/** Destroy a sandbox with the native E2B SDK so API errors are not swallowed. */
export async function destroyComputeSandbox(apiKey: string, sandboxId: string): Promise<void> {
  await E2BControlPlane.kill(sandboxId, { apiKey })
}

/** Return the native E2B SDK instance for E2B-only APIs such as PTY and pause. */
export function getNativeE2BSandbox(sandbox: ComputeSandbox): E2BSandbox {
  return sandbox.getInstance()
}
