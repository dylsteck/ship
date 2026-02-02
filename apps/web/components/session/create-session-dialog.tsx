'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'

interface CreateSessionDialogProps {
  isOpen: boolean
  onClose: () => void
  onCreate: (data: { repoOwner: string; repoName: string }) => Promise<void>
}

/**
 * Dialog for creating a new session
 *
 * TODO (Phase 3): Replace text inputs with repo selector dropdown
 * populated from user's connected GitHub repos.
 * Per CONTEXT.md: "User selects repo from connected repos when creating session"
 */
export function CreateSessionDialog({ isOpen, onClose, onCreate }: CreateSessionDialogProps) {
  const [repoOwner, setRepoOwner] = useState('')
  const [repoName, setRepoName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!repoOwner.trim() || !repoName.trim()) {
      setError('Please fill in both fields')
      return
    }

    startTransition(async () => {
      try {
        await onCreate({ repoOwner: repoOwner.trim(), repoName: repoName.trim() })
        // Reset form on success
        setRepoOwner('')
        setRepoName('')
        onClose()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to create session')
      }
    })
  }

  const handleClose = () => {
    if (!isPending) {
      setRepoOwner('')
      setRepoName('')
      setError(null)
      onClose()
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* Dialog */}
      <div className="relative w-full max-w-md rounded-lg bg-white p-6 shadow-xl dark:bg-gray-900">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          Create New Session
        </h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Enter the repository details to start a new coding session.
        </p>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label
              htmlFor="repoOwner"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Repository Owner
            </label>
            <input
              type="text"
              id="repoOwner"
              value={repoOwner}
              onChange={(e) => setRepoOwner(e.target.value)}
              placeholder="e.g., vercel"
              disabled={isPending}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm placeholder-gray-400 shadow-sm focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500"
            />
          </div>

          <div>
            <label
              htmlFor="repoName"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Repository Name
            </label>
            <input
              type="text"
              id="repoName"
              value={repoName}
              onChange={(e) => setRepoName(e.target.value)}
              placeholder="e.g., next.js"
              disabled={isPending}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm placeholder-gray-400 shadow-sm focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? (
                <>
                  <svg
                    className="-ml-1 mr-2 h-4 w-4 animate-spin"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Creating...
                </>
              ) : (
                'Create Session'
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
