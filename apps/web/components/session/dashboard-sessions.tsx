'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { SessionList } from './session-list'
import { CreateSessionDialog } from './create-session-dialog'
import { Button } from '@/components/ui/button'
import type { ChatSession } from '@/lib/api'

interface DashboardSessionsProps {
  initialSessions: ChatSession[]
  userId: string
}

/**
 * Client component for session management on dashboard
 * Handles dialog state, create/delete actions, and list refresh
 */
export function DashboardSessions({ initialSessions, userId }: DashboardSessionsProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const router = useRouter()

  const handleCreate = async (data: { repoOwner: string; repoName: string }) => {
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8787'

    const res = await fetch(`${API_URL}/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        repoOwner: data.repoOwner,
        repoName: data.repoName,
      }),
    })

    if (!res.ok) {
      throw new Error('Failed to create session')
    }

    // Refresh the page to show new session
    router.refresh()
  }

  const handleDelete = async (id: string) => {
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8787'

    const res = await fetch(`${API_URL}/sessions/${id}`, {
      method: 'DELETE',
    })

    if (!res.ok) {
      throw new Error('Failed to delete session')
    }

    // Refresh the page to update list
    router.refresh()
  }

  return (
    <div>
      {/* Header with title and new session button */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-50">Your Sessions</h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Manage your AI agent sessions and continue where you left off
          </p>
        </div>
        <Button
          onClick={() => setIsDialogOpen(true)}
          className="shadow-sm hover:shadow-md transition-shadow"
        >
          <svg
            className="-ml-1 mr-2 h-4 w-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 4v16m8-8H4"
            />
          </svg>
          New Session
        </Button>
      </div>

      {/* Session list */}
      <SessionList sessions={initialSessions} onDelete={handleDelete} />

      {/* Create session dialog */}
      <CreateSessionDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        onCreate={handleCreate}
      />
    </div>
  )
}
