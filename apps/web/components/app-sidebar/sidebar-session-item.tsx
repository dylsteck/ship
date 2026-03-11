'use client'

import Link from 'next/link'
import { HugeiconsIcon } from '@hugeicons/react'
import { Cancel01Icon } from '@hugeicons/core-free-icons'
import type { ChatSession } from '@/lib/api'
import { cn } from '@ship/ui/utils'
import { getSessionDisplayTitle } from '@/lib/session-display'
import { formatRelativeTime } from './utils'

interface SessionItemProps {
  session: ChatSession
  currentSessionId?: string
  currentSessionTitle?: string
  isStreamingForSession: boolean
  deletingSessionId: string | null
  onDelete: (session: ChatSession) => void
}

export function SessionItem({
  session,
  currentSessionId,
  currentSessionTitle,
  isStreamingForSession,
  deletingSessionId,
  onDelete,
}: SessionItemProps) {
  const isCurrent = currentSessionId === session.id
  const displayTitle = getSessionDisplayTitle(session, {
    preferredTitle: isCurrent ? currentSessionTitle : undefined,
  }) || session.repoName

  return (
    <div className="relative group/item">
      <Link
        href={`/session/${session.id}`}
        className={cn(
          'flex items-center gap-2 py-1.5 pr-6 pl-2 rounded-md text-left w-full transition-colors',
          isCurrent
            ? 'bg-sidebar-accent text-foreground'
            : 'text-muted-foreground hover:bg-sidebar-accent hover:text-foreground',
        )}
      >
        {isStreamingForSession && (
          <span className="shrink-0 w-2.5 h-2.5 border-[1.5px] border-primary/30 border-t-primary rounded-full animate-spin" />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-2">
            <span className={cn('text-xs truncate', isCurrent ? 'font-medium' : 'font-normal')}>{displayTitle}</span>
            <span className="text-[10px] text-muted-foreground/40 shrink-0">
              {formatRelativeTime(session.lastActivity)}
            </span>
          </div>
        </div>
      </Link>
      <div className="absolute right-1.5 top-1/2 -translate-y-1/2 opacity-0 group-hover/item:opacity-100">
        <button
          type="button"
          title="Delete session"
          disabled={deletingSessionId === session.id}
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            onDelete(session)
          }}
          className="p-0.5 rounded hover:bg-muted transition-colors disabled:opacity-30 text-muted-foreground/60 hover:text-foreground"
        >
          <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} className="size-3" />
        </button>
      </div>
    </div>
  )
}
