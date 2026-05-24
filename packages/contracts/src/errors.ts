import { z } from 'zod'

/** Error category for UI treatment and retry behavior. */
export const ErrorCategorySchema = z.enum(['transient', 'persistent', 'user-action', 'fatal'])
export type ErrorCategory = z.infer<typeof ErrorCategorySchema>

/** Stable error codes shared across web and API. */
export const ErrorCodeSchema = z.enum([
  'PROMPT_TIMEOUT',
  'GIT_ACCESS',
  'CREDIT_BALANCE',
  'RATE_LIMIT',
  'NETWORK',
  'PERMISSION',
  'AUTH',
  'NOT_FOUND',
  'VALIDATION',
  'UNKNOWN',
  'FATAL',
])
export type ErrorCode = z.infer<typeof ErrorCodeSchema>

export interface ClassifiedError {
  category: ErrorCategory
  retryable: boolean
  code: ErrorCode
}

/**
 * Classify an error message using shared heuristics from web and API layers.
 *
 * @param message - Raw or sanitized error message text
 */
export function classifyErrorFromMessage(message: string): ClassifiedError {
  const lower = message.toLowerCase()

  if (lower.includes('prompt timed out')) {
    return { category: 'persistent', retryable: false, code: 'PROMPT_TIMEOUT' }
  }

  if (
    (lower.includes('clone') || lower.includes('repository') || lower.includes('git')) &&
    (lower.includes('403') ||
      lower.includes('private') ||
      lower.includes('access denied') ||
      lower.includes('authentication failed') ||
      lower.includes('could not read from remote'))
  ) {
    return { category: 'user-action', retryable: false, code: 'GIT_ACCESS' }
  }

  if (lower.includes('credit balance') || lower.includes('anthropic api')) {
    return { category: 'user-action', retryable: false, code: 'CREDIT_BALANCE' }
  }

  if (
    lower.includes('429') ||
    lower.includes('rate limit') ||
    lower.includes('too many requests') ||
    lower.includes('too many api requests') ||
    lower.includes('worker invocation')
  ) {
    return { category: 'transient', retryable: true, code: 'RATE_LIMIT' }
  }

  if (
    lower.includes('econnreset') ||
    lower.includes('etimedout') ||
    lower.includes('enotfound') ||
    lower.includes('econnrefused') ||
    lower.includes('timeout') ||
    lower.includes('temporary') ||
    lower.includes('service unavailable') ||
    lower.includes('bad gateway') ||
    lower.includes('gateway timeout') ||
    lower.includes('port is not open') ||
    lower.includes('502') ||
    lower.includes('503') ||
    lower.includes('504') ||
    lower.includes('network') ||
    lower.includes('connection') ||
    lower.includes('overloaded') ||
    lower.includes('529')
  ) {
    return { category: 'transient', retryable: true, code: 'NETWORK' }
  }

  if (
    lower.includes('permission') ||
    lower.includes('unauthorized') ||
    lower.includes('confirm') ||
    lower.includes('approve') ||
    lower.includes('requires user action')
  ) {
    return { category: 'user-action', retryable: false, code: 'PERMISSION' }
  }

  if (
    lower.includes('authentication') ||
    lower.includes('not found') ||
    lower.includes('invalid') ||
    lower.includes('failed') ||
    lower.includes('forbidden') ||
    lower.includes('does not exist') ||
    lower.includes('no such') ||
    lower.includes('cannot find')
  ) {
    return { category: 'persistent', retryable: false, code: 'NOT_FOUND' }
  }

  return { category: 'persistent', retryable: false, code: 'UNKNOWN' }
}
