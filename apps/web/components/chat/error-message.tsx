'use client'

import { HugeiconsIcon } from '@hugeicons/react'
import { Alert01Icon } from '@hugeicons/core-free-icons'

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
  onOpenVSCode?: () => void
  onOpenTerminal?: () => void
}

/**
 * Get error title based on category
 */
function getErrorTitle(category: ErrorCategory): string {
  switch (category) {
    case 'transient':
      return 'Temporary Error'
    case 'user-action':
      return 'Action Required'
    case 'persistent':
      return 'Error'
    case 'fatal':
      return 'Critical Error'
    default:
      return 'Error'
  }
}

/**
 * Get error styling based on category
 */
function getErrorStyles(category: ErrorCategory): {
  container: string
  icon: string
  title: string
} {
  switch (category) {
    case 'transient':
      // Yellow/amber warning style
      return {
        container: 'border-yellow-500/50 bg-yellow-50 dark:bg-yellow-900/10',
        icon: 'text-yellow-600 dark:text-yellow-500',
        title: 'text-yellow-900 dark:text-yellow-200',
      }
    case 'user-action':
      // Blue info style
      return {
        container: 'border-blue-500/50 bg-blue-50 dark:bg-blue-900/10',
        icon: 'text-blue-600 dark:text-blue-500',
        title: 'text-blue-900 dark:text-blue-200',
      }
    case 'persistent':
      // Red destructive style
      return {
        container: 'border-red-500/50 bg-red-50 dark:bg-red-900/10',
        icon: 'text-red-600 dark:text-red-500',
        title: 'text-red-900 dark:text-red-200',
      }
    case 'fatal':
      // Red with stronger emphasis
      return {
        container: 'border-red-600 bg-red-100 dark:bg-red-900/20',
        icon: 'text-red-700 dark:text-red-400',
        title: 'text-red-900 dark:text-red-100 font-semibold',
      }
    default:
      return {
        container: 'border-gray-500/50 bg-gray-50 dark:bg-gray-900/10',
        icon: 'text-gray-600 dark:text-gray-500',
        title: 'text-gray-900 dark:text-gray-200',
      }
  }
}

/**
 * ErrorMessage component
 *
 * Displays error inline in chat with category-based styling and action buttons.
 * Provides retry, open VS Code, and open terminal actions.
 *
 * Pattern: Inline in chat (not modal) to keep context
 */
export function ErrorMessage({
  message,
  category,
  retryable,
  onRetry,
  onOpenVSCode,
  onOpenTerminal,
}: ErrorMessageProps) {
  const styles = getErrorStyles(category)
  const title = getErrorTitle(category)

  return (
    <div className={`rounded-lg border p-4 ${styles.container}`}>
      <div className="flex items-start gap-3">
        <HugeiconsIcon icon={Alert01Icon} strokeWidth={2} className={`size-5 mt-0.5 flex-shrink-0 ${styles.icon}`} />
        <div className="flex-1 min-w-0">
          <p className={`font-medium ${styles.title}`}>{title}</p>
          <p className="text-sm text-gray-700 dark:text-gray-300 mt-1 whitespace-pre-wrap">{message}</p>

          {/* Action buttons */}
          {(retryable || onOpenVSCode || onOpenTerminal) && (
            <div className="flex flex-wrap gap-2 mt-3">
              {retryable && onRetry && (
                <button
                  onClick={onRetry}
                  className="text-xs px-3 py-1.5 rounded bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Retry
                </button>
              )}
              {onOpenVSCode && (
                <button
                  onClick={onOpenVSCode}
                  className="text-xs px-3 py-1.5 rounded bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Open VS Code
                </button>
              )}
              {onOpenTerminal && (
                <button
                  onClick={onOpenTerminal}
                  className="text-xs px-3 py-1.5 rounded bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Open Terminal
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
