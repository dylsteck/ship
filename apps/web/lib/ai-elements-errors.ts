export type ErrorCategory = 'transient' | 'persistent' | 'user-action' | 'fatal'

export function classifyError(errorMessage: string): {
  category: ErrorCategory
  retryable: boolean
} {
  const lower = errorMessage.toLowerCase()

  if (
    (lower.includes('clone') || lower.includes('repository') || lower.includes('git')) &&
    (lower.includes('403') ||
      lower.includes('private') ||
      lower.includes('access denied') ||
      lower.includes('authentication failed') ||
      lower.includes('could not read from remote'))
  ) {
    return { category: 'user-action', retryable: false }
  }

  if (lower.includes('credit balance') || lower.includes('anthropic api')) {
    return { category: 'user-action', retryable: false }
  }
  if (
    lower.includes('rate limit') ||
    lower.includes('too many requests') ||
    lower.includes('too many api requests') ||
    lower.includes('worker invocation')
  ) {
    return { category: 'transient', retryable: true }
  }
  if (
    lower.includes('network') ||
    lower.includes('connection') ||
    lower.includes('timeout') ||
    lower.includes('overloaded') ||
    lower.includes('529')
  ) {
    return { category: 'transient', retryable: true }
  }
  return { category: 'persistent', retryable: false }
}

/** Parse a potentially JSON-wrapped error string into a clean message. */
export function parseErrorMessage(raw: unknown): string {
  if (typeof raw !== 'string') return 'An error occurred'

  if (raw.startsWith('{')) {
    try {
      const parsed = JSON.parse(raw)
      return parsed.data?.message || parsed.message || parsed.error?.message || raw
    } catch {
      // Not valid JSON
    }
  }

  return raw
}
