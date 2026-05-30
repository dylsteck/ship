/**
 * Effect-native wrappers around the E2B compute-provider helpers.
 *
 * The underlying `lib/compute-provider` functions keep their exact signatures
 * (they are mocked directly in tests), but this module lifts them into the
 * Effect world: each operation returns an `Effect` whose failures are tagged
 * sandbox errors instead of thrown exceptions, so callers can handle them
 * exhaustively and map them onto HTTP responses via `toHttpErrorResponse`.
 *
 * @packageDocumentation
 */

import { Context, Effect, Layer } from 'effect'

import {
  connectComputeSandbox,
  createComputeSandbox,
  destroyComputeSandbox,
  requireComputeSandbox,
  type ComputeSandbox,
  type ShipComputeCreateOptions,
} from '../lib/compute-provider'
import { SandboxConnectError, SandboxCreateError, SandboxNotFoundError } from './errors'

/** Service interface for managing E2B-backed compute sandboxes. */
export interface ComputeSandboxesService {
  /** Create a new sandbox, failing with {@link SandboxCreateError}. */
  readonly create: (
    apiKey: string,
    options: ShipComputeCreateOptions,
  ) => Effect.Effect<ComputeSandbox, SandboxCreateError>
  /** Connect to an existing sandbox; `null` when the provider has no record. */
  readonly connect: (
    apiKey: string,
    sandboxId: string,
  ) => Effect.Effect<ComputeSandbox | null, SandboxConnectError>
  /** Connect to a sandbox, failing with {@link SandboxNotFoundError} when missing. */
  readonly require: (
    apiKey: string,
    sandboxId: string,
  ) => Effect.Effect<ComputeSandbox, SandboxConnectError | SandboxNotFoundError>
  /** Destroy a sandbox via the native E2B control plane. */
  readonly destroy: (apiKey: string, sandboxId: string) => Effect.Effect<void, SandboxConnectError>
}

/** Injectable {@link ComputeSandboxesService}. */
export class ComputeSandboxes extends Context.Tag('ComputeSandboxes')<
  ComputeSandboxes,
  ComputeSandboxesService
>() {}

const service: ComputeSandboxesService = {
  create: (apiKey, options) =>
    Effect.tryPromise({
      try: () => createComputeSandbox(apiKey, options),
      catch: (cause) => new SandboxCreateError({ cause }),
    }),

  connect: (apiKey, sandboxId) =>
    Effect.tryPromise({
      try: () => connectComputeSandbox(apiKey, sandboxId),
      catch: (cause) => new SandboxConnectError({ sandboxId, cause }),
    }),

  require: (apiKey, sandboxId) =>
    Effect.tryPromise({
      try: () => requireComputeSandbox(apiKey, sandboxId),
      catch: (cause) =>
        cause instanceof Error && /not found/i.test(cause.message)
          ? new SandboxNotFoundError({ sandboxId })
          : new SandboxConnectError({ sandboxId, cause }),
    }),

  destroy: (apiKey, sandboxId) =>
    Effect.tryPromise({
      try: () => destroyComputeSandbox(apiKey, sandboxId),
      catch: (cause) => new SandboxConnectError({ sandboxId, cause }),
    }),
}

/** Live implementation delegating to the E2B compute-provider helpers. */
export const ComputeSandboxesLive = Layer.succeed(ComputeSandboxes, service)
