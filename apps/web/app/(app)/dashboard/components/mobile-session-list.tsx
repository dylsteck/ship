'use client'

import { useState, useCallback } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import { Cancel01Icon } from '@hugeicons/core-free-icons'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@ship/ui'
import type { ChatSession } from '@/lib/api/server'

function formatRelativeTime(timestamp: number): string {
  const seconds = Math.floor(Date.now() / 1000 - timestamp)
  if (seconds < 60) return 'now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`
  const days = Math.floor(seconds / 86400)
  if (days < 14) return `${days}d`
  if (days < 60) return `${Math.floor(days / 7)}w`
  return `${Math.floor(days / 30)}mo`
}

function groupSessionsByTime(sessions: ChatSession[]): { label: string; sessions: ChatSession[] }[] {
  const now = Math.floor(Date.now() / 1000)
  const oneDay = 24 * 60 * 60
  const todayStart = now - oneDay
  const yesterdayStart = now - 2 * oneDay
  const weekStart = now - 7 * oneDay
  const monthStart = now - 30 * oneDay

  const today: ChatSession[] = []
  const yesterday: ChatSession[] = []
  const thisWeek: ChatSession[] = []
  const thisMonth: ChatSession[] = []
  const older: ChatSession[] = []

  for (const s of sessions) {
    const t = s.lastActivity
    if (t >= todayStart) today.push(s)
    else if (t >= yesterdayStart) yesterday.push(s)
    else if (t >= weekStart) thisWeek.push(s)
    else if (t >= monthStart) thisMonth.push(s)
    else older.push(s)
  }

  const sortByActivity = (a: ChatSession, b: ChatSession) => b.lastActivity - a.lastActivity
  const groups: { label: string; sessions: ChatSession[] }[] = []
  if (today.length) groups.push({ label: 'Today', sessions: today.sort(sortByActivity) })
  if (yesterday.length) groups.push({ label: 'Yesterday', sessions: yesterday.sort(sortByActivity) })
  if (thisWeek.length) groups.push({ label: 'This Week', sessions: thisWeek.sort(sortByActivity) })
  if (thisMonth.length) groups.push({ label: 'This Month', sessions: thisMonth.sort(sortByActivity) })
  if (older.length) groups.push({ label: 'Older', sessions: older.sort(sortByActivity) })
  return groups
}

interface MobileSessionListProps {
  sessions: ChatSession[]
  isMobile: boolean
  onSessionClick: (session: ChatSession) => void
  onDeleteSession: (sessionId: string) => void
}

export function MobileSessionList({ sessions, isMobile, onSessionClick, onDeleteSession }: MobileSessionListProps) {
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const handleDelete = useCallback(
    async (session: ChatSession, confirmed = false) => {
      if (!confirmed) {
        setConfirmDeleteId(session.id)
        return
      }
      setDeletingSessionId(session.id)
      try {
        await onDeleteSession(session.id)
      } finally {
        setDeletingSessionId(null)
        setConfirmDeleteId(null)
      }
    },
    [onDeleteSession],
  )

  const activeSessions = sessions.filter((s) => !s.archivedAt)
  if (activeSessions.length === 0) return null

  return (
    <div className="flex-1 overflow-y-auto px-3 pb-3 pt-2 min-h-0">
      {groupSessionsByTime(activeSessions).map((group) => (
        <div key={group.label} className="mb-6">
          <h3 className="text-xs font-medium text-muted-foreground mb-2 sticky top-0 bg-background py-1">
            {group.label}
          </h3>
          <div className="space-y-1">
            {group.sessions.map((session) => (
              <SessionRow
                key={session.id}
                session={session}
                isMobile={isMobile}
                isDeleting={deletingSessionId === session.id}
                isConfirming={confirmDeleteId === session.id}
                onSessionClick={onSessionClick}
                onDelete={handleDelete}
                onCancelDelete={() => setConfirmDeleteId(null)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

interface SessionRowProps {
  session: ChatSession
  isMobile: boolean
  isDeleting: boolean
  isConfirming: boolean
  onSessionClick: (session: ChatSession) => void
  onDelete: (session: ChatSession, confirmed?: boolean) => void
  onCancelDelete: () => void
}

function SessionRow({
  session,
  isMobile,
  isDeleting,
  isConfirming,
  onSessionClick,
  onDelete,
  onCancelDelete,
}: SessionRowProps) {
  const sessionName = session.title || session.repoName
  const repoPath = `${session.repoOwner}/${session.repoName}`

  return (
    <div className="group/item relative flex items-stretch gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-muted/40">
      <button
        onClick={() => onSessionClick(session)}
        className="flex-1 min-w-0 text-left py-0.5"
      >
        <div className="text-sm font-medium text-foreground truncate leading-tight">
          {sessionName}
        </div>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-[11px] text-muted-foreground/80 truncate">{repoPath}</span>
          <span className="text-[11px] text-muted-foreground/50 shrink-0">
            {formatRelativeTime(session.lastActivity)}
          </span>
        </div>
      </button>
      {isMobile && (
        <button
          type="button"
          title="Delete chat"
          disabled={isDeleting}
          onClick={(e) => {
            e.stopPropagation()
            onDelete(session, true)
          }}
          className="shrink-0 self-center p-1.5 rounded-md text-muted-foreground/50 hover:text-foreground hover:bg-muted/60 transition-colors disabled:opacity-30"
        >
          <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} className="size-3.5" />
        </button>
      )}
      {!isMobile && (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button
                type="button"
                title="Delete chat"
                disabled={isDeleting}
                onClick={(e) => e.stopPropagation()}
                className="shrink-0 self-center p-1.5 rounded-md text-muted-foreground/50 hover:text-foreground hover:bg-muted/60 transition-colors disabled:opacity-30 opacity-0 group-hover/item:opacity-100"
              >
                <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} className="size-3.5" />
              </button>
            }
          />
          <DropdownMenuContent align="end" className="w-48">
            {isConfirming ? (
              <>
                <DropdownMenuItem
                  onClick={() => onDelete(session, true)}
                  className="cursor-pointer text-red-600 dark:text-red-400"
                >
                  Yes, delete
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onCancelDelete} className="cursor-pointer">
                  Cancel
                </DropdownMenuItem>
              </>
            ) : (
              <DropdownMenuItem onClick={() => onDelete(session)} className="cursor-pointer">
                Delete
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  )
}
