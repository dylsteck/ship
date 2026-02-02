'use client'

import { ExternalLink, GitPullRequest } from 'lucide-react'
import { useState } from 'react'

/**
 * Pull request information
 */
export interface PRInfo {
  number: number
  url: string
  draft: boolean
}

/**
 * PRPanel props
 */
export interface PRPanelProps {
  prNumber?: number
  prUrl?: string
  isDraft?: boolean
  onMarkReady?: () => Promise<void>
}

/**
 * PR Panel Component
 *
 * Displays PR status in session side panel with:
 * - No PR state: Subtle hint
 * - Draft PR: Show number, link, "Mark Ready" button
 * - Ready PR: Show number, link to GitHub
 *
 * Polls for updates via parent component
 */
export function PRPanel({ prNumber, prUrl, isDraft, onMarkReady }: PRPanelProps) {
  const [isMarkingReady, setIsMarkingReady] = useState(false)

  const handleMarkReady = async () => {
    if (!onMarkReady) return

    setIsMarkingReady(true)
    try {
      await onMarkReady()
    } catch (error) {
      console.error('Failed to mark PR ready:', error)
    } finally {
      setIsMarkingReady(false)
    }
  }

  // No PR state
  if (!prNumber || !prUrl) {
    return (
      <div className="p-4 border-b dark:border-gray-800">
        <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2 dark:text-gray-400">
          Pull Request
        </h3>
        <div className="text-xs text-gray-400 dark:text-gray-500">
          No pull request yet
        </div>
        <div className="text-xs text-gray-400 mt-1 dark:text-gray-500">
          PR will be created on first commit
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 border-b dark:border-gray-800">
      <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2 dark:text-gray-400">
        Pull Request
      </h3>

      <div className="space-y-2">
        {/* PR Number and Status */}
        <div className="flex items-center gap-2">
          <GitPullRequest className="w-4 h-4 text-gray-500 dark:text-gray-400" />
          <span className="text-sm font-medium dark:text-gray-200">
            #{prNumber}
          </span>
          {isDraft ? (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">
              Draft
            </span>
          ) : (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
              Ready
            </span>
          )}
        </div>

        {/* View on GitHub Link */}
        <a
          href={prUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
        >
          <ExternalLink className="w-3 h-3" />
          View on GitHub
        </a>

        {/* Mark Ready for Review Button */}
        {isDraft && (
          <button
            onClick={handleMarkReady}
            disabled={isMarkingReady}
            className="w-full px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-blue-500 dark:hover:bg-blue-600"
          >
            {isMarkingReady ? 'Marking ready...' : 'Mark Ready for Review'}
          </button>
        )}
      </div>
    </div>
  )
}
