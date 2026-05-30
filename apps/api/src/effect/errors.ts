/**
 * Typed, tagged error hierarchy for the Ship API's Effect layer.
 *
 * Every failure mode in the Effect codebase is modelled as a `Data.TaggedError`
 * so it lives in the Effect error channel (`Effect<A, E, R>`) instead of being
 * thrown. This makes failures exhaustively matchable with `Effect.catchTag`,
 * and gives a single place to map domain errors onto HTTP responses.
 *
 * @packageDocumentation
 */

import { Data } from 'effect'

/** A D1/database operation failed unexpectedly (mirrors a thrown rejection). */
export class DatabaseError extends Data.TaggedError('DatabaseError')<{
  readonly operation: string
  readonly cause: unknown
}> {
  get httpStatus() {
    return 500
  }
  get retryable() {
    return true
  }
  override get message() {
    return `Database operation failed: ${this.operation}`
  }
}

/** An outbound GitHub HTTP call failed at the transport level. */
export class GitHubApiError extends Data.TaggedError('GitHubApiError')<{
  readonly operation: string
  readonly status?: number
  readonly cause?: unknown
}> {
  get httpStatus() {
    return this.status ?? 502
  }
  get retryable() {
    return this.status === undefined || this.status >= 500
  }
  override get message() {
    return `GitHub API call failed: ${this.operation}${this.status ? ` (status ${this.status})` : ''}`
  }
}

/** Creating an E2B-backed compute sandbox failed. */
export class SandboxCreateError extends Data.TaggedError('SandboxCreateError')<{
  readonly cause: unknown
}> {
  get httpStatus() {
    return 502
  }
  get retryable() {
    return true
  }
  override get message() {
    return 'Failed to create compute sandbox'
  }
}

/** Connecting to an existing sandbox failed at the provider level. */
export class SandboxConnectError extends Data.TaggedError('SandboxConnectError')<{
  readonly sandboxId: string
  readonly cause: unknown
}> {
  get httpStatus() {
    return 502
  }
  get retryable() {
    return true
  }
  override get message() {
    return `Failed to connect to sandbox ${this.sandboxId}`
  }
}

/** A sandbox was requested by id but does not exist. */
export class SandboxNotFoundError extends Data.TaggedError('SandboxNotFoundError')<{
  readonly sandboxId: string
}> {
  get httpStatus() {
    return 404
  }
  get retryable() {
    return false
  }
  override get message() {
    return `Sandbox not found: ${this.sandboxId}`
  }
}

/** The union of all domain errors the API layer can produce. */
export type AppError =
  | DatabaseError
  | GitHubApiError
  | SandboxCreateError
  | SandboxConnectError
  | SandboxNotFoundError

/** Shape of an HTTP error body returned to clients. */
export interface HttpErrorResponse {
  readonly status: number
  readonly body: {
    readonly error: string
    readonly message: string
    readonly retryable: boolean
  }
}

/**
 * Maps any tagged {@link AppError} onto a deterministic HTTP response shape.
 * Unknown errors collapse to a 500 so we never leak internals.
 */
export function toHttpErrorResponse(error: AppError): HttpErrorResponse {
  return {
    status: error.httpStatus,
    body: {
      error: error._tag,
      message: error.message,
      retryable: error.retryable,
    },
  }
}
