/**
 * The HTTP boundary for the Effect layer.
 *
 * Route handlers build an `Effect<A, AppError>` and hand it to {@link runToResponse},
 * which executes it on the shared runtime and turns the result into a `Response`:
 * successes go through the caller's encoder, tagged {@link AppError}s map to their
 * declared HTTP status via {@link toHttpErrorResponse}, and unexpected defects
 * collapse to a generic 500 so internals never leak.
 *
 * @packageDocumentation
 */

import { Cause, Exit, type Effect } from 'effect'

import { toHttpErrorResponse, type AppError } from './errors'
import { runPromiseExit } from './runtime'

/** Narrow an unknown failure to one of our tagged {@link AppError}s. */
function isAppError(value: unknown): value is AppError {
  return (
    typeof value === 'object' &&
    value !== null &&
    '_tag' in value &&
    'httpStatus' in value &&
    'retryable' in value
  )
}

const INTERNAL_ERROR_BODY = {
  error: 'InternalError',
  message: 'Internal server error',
  retryable: false,
} as const

/**
 * Run an Effect at the HTTP boundary and encode its outcome as a `Response`.
 *
 * @param effect The program to execute (its error channel must be {@link AppError}).
 * @param onSuccess Encoder for the success value into a `Response`.
 */
export async function runToResponse<A>(
  effect: Effect.Effect<A, AppError>,
  onSuccess: (value: A) => Response | Promise<Response>,
): Promise<Response> {
  const exit = await runPromiseExit(effect)

  if (Exit.isSuccess(exit)) {
    return onSuccess(exit.value)
  }

  const failure = Cause.failureOption(exit.cause)
  if (failure._tag === 'Some' && isAppError(failure.value)) {
    const { status, body } = toHttpErrorResponse(failure.value)
    return Response.json(body, { status })
  }

  return Response.json(INTERNAL_ERROR_BODY, { status: 500 })
}
