/**
 * Error classification and retry utilities
 *
 * Classifies errors as transient (auto-retry) vs persistent (pause and notify).
 * Implements exponential backoff with jitter for retry logic.
 *
 * Pattern: Different errors need different UX - transient = silent retry, persistent = notify user
 */

/**
 * Error categories for classification
 */
export enum ErrorCategory {
  Transient = 'transient', // Network, rate limit, timeout - auto-retry
  Persistent = 'persistent', // Auth, permission, logic error - pause & notify
  UserAction = 'user-action', // Needs user decision - prompt via UI
  Fatal = 'fatal', // Unrecoverable - abort task
}

/**
 * Error classification details
 */
export interface ErrorDetails {
  category: ErrorCategory
  retryable: boolean
  maxRetries: number
  backoffMs: number
  message: string
}

/**
 * Retry context for operation tracking
 */
export interface RetryContext {
  operationName: string
  onError?: (error: Error, attempt: number, category: ErrorCategory) => void
  onRetry?: (attempt: number, delay: number) => void
}

/**
 * Classify error based on pattern matching
 *
 * @param error - Error to classify
 * @returns Error details with category and retry configuration
 */
export function classifyError(error: unknown): ErrorDetails {
  const message = error instanceof Error ? error.message : String(error)
  const lowerMessage = message.toLowerCase()

  // Transient errors - network, timeouts, rate limits
  // These should auto-retry with exponential backoff
  if (
    lowerMessage.includes('econnreset') ||
    lowerMessage.includes('etimedout') ||
    lowerMessage.includes('enotfound') ||
    lowerMessage.includes('econnrefused') ||
    lowerMessage.includes('429') ||
    lowerMessage.includes('rate limit') ||
    lowerMessage.includes('timeout') ||
    lowerMessage.includes('temporary') ||
    lowerMessage.includes('too many requests') ||
    lowerMessage.includes('service unavailable') ||
    lowerMessage.includes('bad gateway') ||
    lowerMessage.includes('gateway timeout') ||
    lowerMessage.includes('port is not open') || // E2B sandbox port not ready
    lowerMessage.includes('502') || // Generic 502 errors
    lowerMessage.includes('503') || // Service temporarily unavailable
    lowerMessage.includes('504') // Gateway timeout code
  ) {
    return {
      category: ErrorCategory.Transient,
      retryable: true,
      maxRetries: 5, // Increase retries for port issues
      backoffMs: 2000, // 2s, 4s, 8s, 16s, 32s exponential
      message,
    }
  }

  // User-action errors - permissions, confirmations
  // These need user intervention via UI
  if (
    lowerMessage.includes('permission') ||
    lowerMessage.includes('unauthorized') ||
    lowerMessage.includes('confirm') ||
    lowerMessage.includes('approve') ||
    lowerMessage.includes('requires user action')
  ) {
    return {
      category: ErrorCategory.UserAction,
      retryable: false,
      maxRetries: 0,
      backoffMs: 0,
      message,
    }
  }

  // Persistent errors - logic, auth failures, not found
  // These should pause agent and notify user
  if (
    lowerMessage.includes('authentication') ||
    lowerMessage.includes('not found') ||
    lowerMessage.includes('invalid') ||
    lowerMessage.includes('failed') ||
    lowerMessage.includes('forbidden') ||
    lowerMessage.includes('does not exist') ||
    lowerMessage.includes('no such') ||
    lowerMessage.includes('cannot find')
  ) {
    return {
      category: ErrorCategory.Persistent,
      retryable: false,
      maxRetries: 0,
      backoffMs: 0,
      message,
    }
  }

  // Default to fatal - unrecoverable error
  return {
    category: ErrorCategory.Fatal,
    retryable: false,
    maxRetries: 0,
    backoffMs: 0,
    message,
  }
}

/**
 * Sleep utility with optional jitter
 * Adds random 0-100ms to prevent thundering herd
 *
 * @param ms - Base delay in milliseconds
 * @param withJitter - Whether to add jitter (default: true)
 */
export function sleep(ms: number, withJitter: boolean = true): Promise<void> {
  const jitter = withJitter ? Math.random() * 100 : 0
  const delay = ms + jitter
  return new Promise((resolve) => setTimeout(resolve, delay))
}

/**
 * Execute operation with automatic retry on transient errors
 *
 * Uses exponential backoff: delay * 2^(attempt-1)
 * Adds jitter to prevent synchronized retries
 *
 * @param operation - Async operation to execute
 * @param context - Retry context with callbacks
 * @returns Result of operation
 * @throws Last error if all retries fail or error is not retryable
 */
export async function executeWithRetry<T>(operation: () => Promise<T>, context: RetryContext): Promise<T> {
  let lastError: Error

  // First attempt
  try {
    return await operation()
  } catch (error) {
    const details = classifyError(error)
    lastError = error instanceof Error ? error : new Error(String(error))

    // Call error callback
    context.onError?.(lastError, 0, details.category)

    // If not retryable, throw immediately
    if (!details.retryable) {
      throw lastError
    }

    // Retry with exponential backoff
    for (let attempt = 1; attempt <= details.maxRetries; attempt++) {
      // Calculate delay: 2s, 4s, 8s...
      const delay = details.backoffMs * Math.pow(2, attempt - 1)

      // Notify about retry
      context.onRetry?.(attempt, delay)

      // Wait with jitter
      await sleep(delay)

      try {
        return await operation()
      } catch (retryError) {
        lastError = retryError instanceof Error ? retryError : new Error(String(retryError))
        const retryDetails = classifyError(retryError)

        // Call error callback with attempt number
        context.onError?.(lastError, attempt, retryDetails.category)

        // If error category changed to non-retryable, stop retrying
        if (!retryDetails.retryable) {
          throw lastError
        }
      }
    }

    // All retries exhausted
    throw lastError
  }
}

/**
 * Sanitize error message to remove sensitive data
 * Removes tokens, API keys, passwords from error messages
 *
 * @param error - Error to sanitize
 * @returns Sanitized error message
 */
export function sanitizeError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)

  // Remove common token patterns
  return (
    message
      // GitHub tokens (ghp_xxx, gho_xxx, etc.)
      .replace(/gh[pso]_[a-zA-Z0-9]{36}/g, '[GITHUB_TOKEN]')
      // Generic bearer tokens
      .replace(/Bearer\s+[a-zA-Z0-9._-]+/gi, 'Bearer [TOKEN]')
      // API keys
      .replace(/[Aa]pi[_-]?[Kk]ey[:\s=]+[a-zA-Z0-9_-]+/g, 'api_key=[REDACTED]')
      // Anthropic API keys
      .replace(/sk-ant-[a-zA-Z0-9_-]+/g, '[ANTHROPIC_KEY]')
      // Generic secrets
      .replace(/[Ss]ecret[:\s=]+[a-zA-Z0-9_-]+/g, 'secret=[REDACTED]')
      // Passwords
      .replace(/[Pp]assword[:\s=]+[^\s]+/g, 'password=[REDACTED]')
  )
}
