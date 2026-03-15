'use client'

import { useState } from 'react'
import { Button } from '@ship/ui'

/**
 * Error category for styling and behavior
 */
export type ErrorCategory = 'transient' | 'persistent' | 'user-action' | 'fatal'

/**
 * ErrorMessage component props
 */
export interface ErrorMessageProps {
  message: string
  category: ErrorCategory
  retryable: boolean
  onRetry?: () => void
  /** Raw error before formatting; shown in Details when formatted would mask it */
  rawMessage?: string
}

/**
 * Format raw error messages for better readability.
 * Narrow rate-limit mapping to avoid false positives (e.g. E2B "too many sandboxes").
 */
function formatErrorMessage(message: string): string {
  // Check if it's a JSON error from API
  try {
    const parsed = JSON.parse(message)
    if (parsed.message || parsed.error) {
      message = parsed.message || parsed.error
    }
  } catch {
    // Not JSON
  }

  let formatted = message

  // Remove technical prefixes
  formatted = formatted.replace(/^APIError\s*-\s*/, '')
  formatted = formatted.replace(/^Error:\s*/, '')

  const lower = formatted.toLowerCase()

  if (lower.includes('credit balance') || lower.includes('anthropic api')) {
    return 'Your Anthropic API credit balance is too low. Please add credits to continue.'
  }

  // Narrow rate-limit: only map when clearly a rate limit (avoid E2B "too many sandboxes", etc.)
  if (
    lower.includes('429') ||
    lower.includes('rate limit exceeded') ||
    (lower.includes('rate limit') && !lower.includes('rate limit headers'))
  ) {
    return 'Rate limited. Please try sending your message again.'
  }
  if (lower.includes('too many requests') && (lower.includes('api') || lower.includes('429'))) {
    return 'Rate limited. Please try sending your message again.'
  }
  if (lower.includes('worker invocation')) {
    return 'Service limit reached. Please try again shortly.'
  }

  if (lower.includes('overloaded') || lower.includes('529')) {
    return 'The API is temporarily overloaded. Please try again shortly.'
  }

  if (lower.includes('network') || lower.includes('connection') || lower.includes('timeout')) {
    return 'Network error. Please check your connection.'
  }

  if (formatted.length > 300) {
    formatted = formatted.slice(0, 300) + '...'
  }

  return formatted
}

/**
 * ErrorMessage component
 *
 * Displays error inline in chat with category-based styling.
 * Transient errors are compact/subtle. Persistent/fatal are more prominent.
 */
export function ErrorMessage({
  message,
  category,
  retryable,
  onRetry,
  rawMessage,
}: ErrorMessageProps) {
  const formattedMessage = formatErrorMessage(message)
  const wouldMask = rawMessage && formattedMessage !== rawMessage && formattedMessage.length < 100

  // Transient errors: compact, subtle inline notice
  if (category === 'transient') {
    return (
      <div className="flex flex-col gap-1.5 py-1.5 px-3 rounded-md bg-muted/40 border border-border/20 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <svg className="w-3.5 h-3.5 shrink-0 text-yellow-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <span>{formattedMessage}</span>
          {retryable && onRetry && (
            <button onClick={onRetry} className="text-primary hover:text-primary/80 font-medium ml-1">
              Retry
            </button>
          )}
        </div>
        {wouldMask && rawMessage && <ErrorDetails rawMessage={rawMessage} />}
      </div>
    )
  }

  // User-action: blue info style
  if (category === 'user-action') {
    return (
      <div className="rounded-lg border border-blue-500/50 bg-blue-50 dark:bg-blue-900/10 p-3">
        <div className="flex items-start gap-2.5">
          <svg className="w-4 h-4 mt-0.5 shrink-0 text-blue-600 dark:text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-blue-900 dark:text-blue-200">Action Required</p>
            <p className="text-sm text-foreground mt-1">{formattedMessage}</p>
            {wouldMask && rawMessage && <ErrorDetails rawMessage={rawMessage} />}
          </div>
        </div>
      </div>
    )
  }

  // Persistent / fatal: red error card
  const isFatal = category === 'fatal'
  return (
    <div className={`rounded-lg border p-3 ${isFatal ? 'border-red-600 bg-red-100 dark:bg-red-900/20' : 'border-red-500/50 bg-red-50 dark:bg-red-900/10'}`}>
      <div className="flex items-start gap-2.5">
        <svg className={`w-4 h-4 mt-0.5 shrink-0 ${isFatal ? 'text-red-700 dark:text-red-400' : 'text-red-600 dark:text-red-500'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium ${isFatal ? 'text-red-900 dark:text-red-100' : 'text-red-900 dark:text-red-200'}`}>Error</p>
          <p className="text-sm text-foreground mt-1">{formattedMessage}</p>
          {wouldMask && rawMessage && <ErrorDetails rawMessage={rawMessage} />}
          {retryable && onRetry && (
            <div className="mt-2">
              <Button variant="outline" size="sm" onClick={onRetry}>
                Retry
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function ErrorDetails({ rawMessage }: { rawMessage: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="text-xs text-muted-foreground hover:text-foreground underline"
      >
        {open ? 'Hide details' : 'Show details'}
      </button>
      {open && (
        <pre className="mt-1.5 p-2 rounded bg-muted/50 text-[11px] overflow-x-auto whitespace-pre-wrap break-words max-h-32 overflow-y-auto">
          {rawMessage}
        </pre>
      )}
    </div>
  )
}
