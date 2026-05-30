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

interface HttpMappableError {
  readonly _tag: string
  readonly httpStatus: number
  readonly retryable: boolean
  readonly message: string
}

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

/** Required runtime configuration was missing or invalid. */
export class ConfigError extends Data.TaggedError('ConfigError')<{
  readonly key: string
  readonly cause?: unknown
}> {
  get httpStatus() {
    return 500
  }
  get retryable() {
    return false
  }
  override get message() {
    return `Missing or invalid configuration: ${this.key}`
  }
}

/** Authentication failed or no identity could be established. */
export class AuthError extends Data.TaggedError('AuthError')<{
  readonly reason: string
  readonly cause?: unknown
}> {
  get httpStatus() {
    return 401
  }
  get retryable() {
    return false
  }
  override get message() {
    return this.reason
  }
}

/** A known identity attempted an operation it is not allowed to perform. */
export class AuthorizationError extends Data.TaggedError('AuthorizationError')<{
  readonly reason: string
  readonly cause?: unknown
}> {
  get httpStatus() {
    return 403
  }
  get retryable() {
    return false
  }
  override get message() {
    return this.reason
  }
}

/** Caller-provided input failed validation. */
export class ValidationError extends Data.TaggedError('ValidationError')<{
  readonly reason: string
  readonly cause?: unknown
}> {
  get httpStatus() {
    return 400
  }
  get retryable() {
    return false
  }
  override get message() {
    return this.reason
  }
}

/** A requested resource does not exist. */
export class NotFoundError extends Data.TaggedError('NotFoundError')<{
  readonly resource: string
  readonly id?: string
  readonly cause?: unknown
}> {
  get httpStatus() {
    return 404
  }
  get retryable() {
    return false
  }
  override get message() {
    return this.id ? `${this.resource} not found: ${this.id}` : `${this.resource} not found`
  }
}

/** A Durable Object RPC or persistence operation failed. */
export class DurableObjectError extends Data.TaggedError('DurableObjectError')<{
  readonly operation: string
  readonly cause?: unknown
}> {
  get httpStatus() {
    return 502
  }
  get retryable() {
    return true
  }
  override get message() {
    return `Durable Object operation failed: ${this.operation}`
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

/** A GitHub repository or pull request operation failed. */
export class GitHubRepoError extends Data.TaggedError('GitHubRepoError')<{
  readonly operation: string
  readonly code: string
  readonly messageOverride?: string
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
    return this.messageOverride ?? `GitHub repository operation failed: ${this.operation}`
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

/** A sandbox operation exhausted its allotted wait time. */
export class SandboxTimeoutError extends Data.TaggedError('SandboxTimeoutError')<{
  readonly operation: string
  readonly sandboxId?: string
  readonly cause?: unknown
}> {
  get httpStatus() {
    return 504
  }
  get retryable() {
    return true
  }
  override get message() {
    return `Timed out during sandbox operation: ${this.operation}`
  }
}

/** The sandbox provider rate-limited a lifecycle operation. */
export class SandboxRateLimitError extends Data.TaggedError('SandboxRateLimitError')<{
  readonly operation: string
  readonly sandboxId?: string
  readonly cause?: unknown
}> {
  get httpStatus() {
    return 429
  }
  get retryable() {
    return true
  }
  override get message() {
    return `Sandbox provider rate limited operation: ${this.operation}`
  }
}

/** A command executed inside a sandbox failed. */
export class SandboxCommandError extends Data.TaggedError('SandboxCommandError')<{
  readonly command: string
  readonly reason: string
  readonly cause?: unknown
}> {
  get httpStatus() {
    return 502
  }
  get retryable() {
    return false
  }
  override get message() {
    return `Sandbox command failed: ${this.reason}`
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

/** A git operation inside a sandbox failed. */
export class GitWorkflowEffectError extends Data.TaggedError('GitWorkflowEffectError')<{
  readonly operation: string
  readonly code: string
  readonly command?: string
  readonly messageOverride?: string
  readonly cause?: unknown
}> {
  get httpStatus() {
    return 502
  }
  get retryable() {
    return false
  }
  override get message() {
    return this.messageOverride ?? `Git workflow failed: ${this.operation}`
  }
}

/** Bootstrapping or communicating with the ACP bridge failed. */
export class AcpBridgeError extends Data.TaggedError('AcpBridgeError')<{
  readonly operation: string
  readonly cause?: unknown
}> {
  get httpStatus() {
    return 502
  }
  get retryable() {
    return true
  }
  override get message() {
    return `ACP bridge operation failed: ${this.operation}`
  }
}

/** ACP JSON-RPC failed or returned an error response. */
export class AcpRpcError extends Data.TaggedError('AcpRpcError')<{
  readonly method: string
  readonly cause?: unknown
}> {
  get httpStatus() {
    return 502
  }
  get retryable() {
    return true
  }
  override get message() {
    return `ACP RPC failed: ${this.method}`
  }
}

/** Writing to an SSE stream failed. */
export class StreamWriteError extends Data.TaggedError('StreamWriteError')<{
  readonly event: string
  readonly cause?: unknown
}> {
  get httpStatus() {
    return 499
  }
  get retryable() {
    return false
  }
  override get message() {
    return `Failed to write stream event: ${this.event}`
  }
}

/** Generating or persisting a session title failed. */
export class TitleGenerationError extends Data.TaggedError('TitleGenerationError')<{
  readonly operation: string
  readonly cause?: unknown
}> {
  get httpStatus() {
    return 502
  }
  get retryable() {
    return true
  }
  override get message() {
    return `Title generation failed: ${this.operation}`
  }
}

/** The union of all domain errors the API layer can produce. */
export type AppError =
  | AcpBridgeError
  | AcpRpcError
  | AuthError
  | AuthorizationError
  | ConfigError
  | DatabaseError
  | DurableObjectError
  | GitHubRepoError
  | GitHubApiError
  | GitWorkflowEffectError
  | NotFoundError
  | SandboxCommandError
  | SandboxCreateError
  | SandboxConnectError
  | SandboxNotFoundError
  | SandboxRateLimitError
  | SandboxTimeoutError
  | StreamWriteError
  | TitleGenerationError
  | ValidationError

/**
 * The set of `_tag`s that identify an {@link AppError}. Used at the HTTP boundary
 * to robustly recognise our domain errors without a loose structural check.
 */
export const APP_ERROR_TAGS: ReadonlySet<string> = new Set([
  'AcpBridgeError',
  'AcpRpcError',
  'AuthError',
  'AuthorizationError',
  'ConfigError',
  'DatabaseError',
  'DurableObjectError',
  'GitHubApiError',
  'GitHubRepoError',
  'GitWorkflowEffectError',
  'NotFoundError',
  'SandboxCommandError',
  'SandboxCreateError',
  'SandboxConnectError',
  'SandboxNotFoundError',
  'SandboxRateLimitError',
  'SandboxTimeoutError',
  'StreamWriteError',
  'TitleGenerationError',
  'ValidationError',
])

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
export function toHttpErrorResponse(error: AppError | HttpMappableError): HttpErrorResponse {
  return {
    status: error.httpStatus,
    body: {
      error: error._tag,
      message: error.message,
      retryable: error.retryable,
    },
  }
}
