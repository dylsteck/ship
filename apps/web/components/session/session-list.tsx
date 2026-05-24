'use client'

import { useState, useTransition } from 'react'
import type { ChatSession } from '@/lib/api/server'
import { SessionListEmptyState, SessionListItem } from './session-list-item'

interface SessionListProps {
  sessions: ChatSession[]
  onDelete?: (id: string) => Promise<void>
}

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
    return <SessionListEmptyState />
  }

  return (
    <ul className="space-y-4">
      {sessions.map((session) => (
        <SessionListItem
          key={session.id}
          session={session}
          onDelete={onDelete ? handleDelete : undefined}
          deletingId={deletingId}
          isPending={isPending}
        />
      ))}
    </ul>
  )
}
