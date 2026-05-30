/**
 * Effect-native E2B sandbox lifecycle service.
 *
 * This module owns Ship's higher-level sandbox operations: create/resume with
 * retry policy, provider-specific pause/timeout calls, and the stable
 * `SandboxInfo` shape consumed by routes and the Session Durable Object.
 *
 * @packageDocumentation
 */

import { Context, Effect, Layer, Schedule } from 'effect'

import {
  getNativeE2BSandbox,
  type ComputeSandbox,
  type ShipComputeCreateOptions,
} from '../lib/compute-provider'
import {
  SandboxConnectError,
  SandboxCreateError,
  SandboxNotFoundError,
  SandboxRateLimitError,
  type AppError,
} from './errors'
import { ComputeSandboxes } from './compute'

/** Custom E2B template id pre-baked with common dev tooling. */
export const E2B_TEMPLATE_ID = 'n1exdf9kj7gpwk6810c9'

/** Sandbox configuration options used by Ship sessions. */
export interface SandboxConfig {
  readonly sessionId: string
  readonly timeoutMs?: number
  readonly autoPause?: boolean
  readonly metadata?: Record<string, string>
  readonly envs?: Record<string, string>
}

/** Sandbox info returned after creation/resume/status calls. */
export interface SandboxInfo {
  readonly id: string
  readonly status: 'active' | 'paused' | 'error'
  readonly createdAt: number
  readonly metadata?: Record<string, string>
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

/** High-level sandbox lifecycle operations. */
export interface SandboxLifecycleService {
  /** Create a new session sandbox with rate-limit retries. */
  readonly createSession: (
    apiKey: string,
    config: SandboxConfig,
  ) => Effect.Effect<SandboxInfo, SandboxCreateError | SandboxRateLimitError, ComputeSandboxes>
  /** Resume an existing sandbox with rate-limit retries and timeout refresh. */
  readonly resume: (
    apiKey: string,
    sandboxId: string,
  ) => Effect.Effect<
    SandboxInfo,
    SandboxConnectError | SandboxNotFoundError | SandboxRateLimitError,
    ComputeSandboxes
  >
  /** Pause a sandbox through the native E2B control plane. */
  readonly pause: (
    apiKey: string,
    sandboxId: string,
  ) => Effect.Effect<void, SandboxConnectError | SandboxNotFoundError, ComputeSandboxes>
  /** Terminate a sandbox permanently. */
  readonly terminate: (apiKey: string, sandboxId: string) => Effect.Effect<void, SandboxConnectError, ComputeSandboxes>
  /** Read sandbox status without mutating persisted state. */
  readonly getStatus: (
    apiKey: string,
    sandboxId: string,
  ) => Effect.Effect<SandboxInfo, SandboxConnectError | SandboxNotFoundError, ComputeSandboxes>
  /** Get the public URL for a port in a sandbox. */
  readonly getPortUrl: (
    apiKey: string,
    sandboxId: string,
    port: number,
  ) => Effect.Effect<string, SandboxConnectError | SandboxNotFoundError, ComputeSandboxes>
  /** Refresh the auto-pause timeout on a running sandbox. */
  readonly refreshTimeout: (
    apiKey: string,
    sandboxId: string,
    timeoutMs?: number,
  ) => Effect.Effect<void, SandboxConnectError | SandboxNotFoundError, ComputeSandboxes>
}

/** Injectable {@link SandboxLifecycleService}. */
export class SandboxLifecycle extends Context.Tag('SandboxLifecycle')<
  SandboxLifecycle,
  SandboxLifecycleService
>() {}

function isE2BRateLimitError(error: unknown): boolean {
  const msg = (error instanceof Error ? error.message : String(error)).toLowerCase()
  return msg.includes('429') || msg.includes('rate limit') || msg.includes('too many requests')
}

function rateLimitOrCreate(cause: unknown): SandboxCreateError | SandboxRateLimitError {
  return isE2BRateLimitError(cause)
    ? new SandboxRateLimitError({ operation: 'create', cause })
    : new SandboxCreateError({ cause })
}

function rateLimitOrConnect(sandboxId: string, cause: SandboxConnectError): SandboxConnectError | SandboxRateLimitError {
  return isE2BRateLimitError(cause.cause)
    ? new SandboxRateLimitError({ operation: 'resume', sandboxId, cause: cause.cause })
    : cause
}

function retryRateLimits<E extends AppError>(times: number, baseDelayMs: number) {
  return {
    times,
    while: (error: E) => error._tag === 'SandboxRateLimitError',
    schedule: Schedule.exponential(`${baseDelayMs} millis`),
  }
}

function setNativeTimeout(
  sandbox: ComputeSandbox,
  sandboxId: string,
  timeoutMs: number,
): Effect.Effect<void, SandboxConnectError> {
  return Effect.tryPromise({
    try: () => Promise.resolve(getNativeE2BSandbox(sandbox).setTimeout(timeoutMs)),
    catch: (cause) => new SandboxConnectError({ sandboxId, cause }),
  })
}

function pauseNativeSandbox(sandbox: ComputeSandbox, sandboxId: string): Effect.Effect<void, SandboxConnectError> {
  return Effect.tryPromise({
    try: () => Promise.resolve(getNativeE2BSandbox(sandbox).pause()),
    catch: (cause) => new SandboxConnectError({ sandboxId, cause }),
  })
}

const service: SandboxLifecycleService = {
  createSession: (apiKey, config) =>
    Effect.gen(function* () {
      const compute = yield* ComputeSandboxes
      const sandbox = yield* compute
        .create(apiKey, buildComputeCreateOptions(config))
        .pipe(Effect.mapError(rateLimitOrCreate))

      return {
        id: sandbox.sandboxId,
        status: 'active' as const,
        createdAt: Date.now(),
        metadata: {
          sessionId: config.sessionId,
          ...config.metadata,
        },
      }
    }).pipe(Effect.retry(retryRateLimits(3, 2000))),

  resume: (apiKey, sandboxId) =>
    Effect.gen(function* () {
      const compute = yield* ComputeSandboxes
      const sandbox = yield* compute.require(apiKey, sandboxId).pipe(
        Effect.mapError((error) =>
          error._tag === 'SandboxConnectError' ? rateLimitOrConnect(sandboxId, error) : error,
        ),
      )
      yield* setNativeTimeout(sandbox, sandboxId, 5 * 60 * 1000).pipe(
        Effect.mapError((error) => rateLimitOrConnect(sandboxId, error)),
      )

      return {
        id: sandbox.sandboxId,
        status: 'active' as const,
        createdAt: Date.now(),
      }
    }).pipe(Effect.retry(retryRateLimits(2, 1500))),

  pause: (apiKey, sandboxId) =>
    Effect.gen(function* () {
      const compute = yield* ComputeSandboxes
      const sandbox = yield* compute.require(apiKey, sandboxId)
      yield* pauseNativeSandbox(sandbox, sandboxId)
    }),

  terminate: (apiKey, sandboxId) =>
    Effect.gen(function* () {
      const compute = yield* ComputeSandboxes
      yield* compute.destroy(apiKey, sandboxId)
    }),

  getStatus: (apiKey, sandboxId) =>
    Effect.gen(function* () {
      const compute = yield* ComputeSandboxes
      const sandbox = yield* compute.require(apiKey, sandboxId)
      return {
        id: sandbox.sandboxId,
        status: 'active' as const,
        createdAt: Date.now(),
      }
    }),

  getPortUrl: (apiKey, sandboxId, port) =>
    Effect.gen(function* () {
      const compute = yield* ComputeSandboxes
      const sandbox = yield* compute.require(apiKey, sandboxId)
      return yield* Effect.tryPromise({
        try: () => Promise.resolve(sandbox.getUrl({ port })),
        catch: (cause) => new SandboxConnectError({ sandboxId, cause }),
      })
    }),

  refreshTimeout: (apiKey, sandboxId, timeoutMs) =>
    Effect.gen(function* () {
      const compute = yield* ComputeSandboxes
      const sandbox = yield* compute.require(apiKey, sandboxId)
      yield* setNativeTimeout(sandbox, sandboxId, timeoutMs ?? 5 * 60 * 1000)
    }),
}

/** Live sandbox lifecycle service. */
export const SandboxLifecycleLive = Layer.succeed(SandboxLifecycle, service)
