export {
  classifyErrorFromMessage,
  type ErrorCategory,
  type ErrorCode,
  type ClassifiedError,
} from '@ship/contracts'

import { classifyErrorFromMessage, type ErrorCategory } from '@ship/contracts'

/** Classify an error message for UI treatment and retry behavior. */
export function classifyError(errorMessage: string): {
  category: ErrorCategory
  retryable: boolean
} {
  const { category, retryable } = classifyErrorFromMessage(errorMessage)
  return { category, retryable }
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
