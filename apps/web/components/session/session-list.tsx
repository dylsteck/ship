'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import type { ChatSession } from '@/lib/api'
import { Button } from '@/components/ui/button'

interface SessionListProps {
  sessions: ChatSession[]
  onDelete?: (id: string) => Promise<void>
}

/**
 * Format a Unix timestamp to relative time
 */
function formatRelativeTime(timestamp: number): string {
  const seconds = Math.floor(Date.now() / 1000 - timestamp)

  if (seconds < 60) return 'Just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`

  return new Date(timestamp * 1000).toLocaleDateString()
}

/**
 * Status indicator component
 */
function StatusBadge({ status }: { status: string }) {
  const statusStyles: Record<string, string> = {
    active: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    idle: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    archived: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  }

  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusStyles[status] || statusStyles.active}`}
    >
      {status}
    </span>
  )
}

/**
 * Session list component
 * Displays user's sessions as cards with repo info and actions
 */
export function SessionList({ sessions, onDelete }: SessionListProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.preventDefault()
    e.stopPropagation()

    if (!onDelete) return
    if (!confirm('Are you sure you want to delete this session?')) return

    setDeletingId(id)
    startTransition(async () => {
      try {
        await onDelete(id)
      } catch (error) {
        console.error('Failed to delete session:', error)
        alert('Failed to delete session')
      } finally {
        setDeletingId(null)
      }
    })
  }

  if (sessions.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-8 text-center dark:border-gray-700 dark:bg-gray-900">
        <svg
          className="mx-auto h-12 w-12 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
          />
        </svg>
        <h3 className="mt-4 text-sm font-medium text-gray-900 dark:text-gray-100">
          No sessions yet
        </h3>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Create your first session to start building with AI.
        </p>
      </div>
    )
  }

  return (
    <ul className="space-y-4">
      {sessions.map((session) => (
        <li key={session.id}>
          <Link
            href={`/session/${session.id}`}
            className="block rounded-lg border border-gray-200 bg-white p-5 shadow-sm transition-all hover:border-gray-300 hover:shadow-md dark:border-gray-800 dark:bg-gray-900 dark:hover:border-gray-700 dark:hover:bg-gray-800"
          >
            <div className="flex items-start justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-3">
                  <h3 className="truncate text-base font-semibold text-gray-900 dark:text-gray-100">
                    {session.repoOwner}/{session.repoName}
                  </h3>
                  <StatusBadge status={session.status} />
                </div>
                <div className="mt-2 space-y-1">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Last active {formatRelativeTime(session.lastActivity)}
                  </p>
                  {session.messageCount !== undefined && (
                    <p className="text-xs text-gray-500 dark:text-gray-500">
                      {session.messageCount} message{session.messageCount !== 1 ? 's' : ''}
                    </p>
                  )}
                </div>
              </div>
              <div className="ml-4 flex items-center gap-2">
                {onDelete && (
                  <Button
                    variant="ghost"
                    onClick={(e) => handleDelete(e, session.id)}
                    disabled={deletingId === session.id || isPending}
                    className="h-8 w-8 p-0 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:text-red-400 dark:hover:bg-red-900/20 transition-colors"
                  >
                    {deletingId === session.id ? (
                      <svg
                        className="h-4 w-4 animate-spin"
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
                    ) : (
                      <svg
                        className="h-4 w-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                    )}
                  </Button>
                )}
                <svg
                  className="h-5 w-5 text-gray-400 dark:text-gray-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </div>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  )
}
