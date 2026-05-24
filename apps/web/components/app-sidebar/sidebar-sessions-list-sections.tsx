'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { ChatSession } from '@/lib/api/server'
import { cn } from '@ship/ui/utils'
import { getSessionDisplayTitle } from '@/lib/session-display'
import { formatRelativeTime } from './utils'
import { ChevronIcon } from './icons'
import { SessionItem } from './sidebar-session-item'

export function groupSessionsByRepo(sessions: ChatSession[]) {
  const nonArchived = sessions.filter((s) => !s.archivedAt)
  const archived = sessions.filter((s) => !!s.archivedAt)
  const byRepo: Record<string, ChatSession[]> = {}
  for (const session of nonArchived) {
    const key = `${session.repoOwner}/${session.repoName}`
    if (!byRepo[key]) byRepo[key] = []
    byRepo[key].push(session)
  }
  const repoEntries = Object.entries(byRepo).sort(
    ([, a], [, b]) => Math.max(...b.map((s) => s.lastActivity)) - Math.max(...a.map((s) => s.lastActivity)),
  )
  return { nonArchived, archived, repoEntries }
}

export function SidebarFlatSessionList({
  sessions,
  currentSessionId,
  currentSessionTitle,
  isStreaming,
  streamingSessionIds,
  deletingSessionId,
  onDeleteSession,
}: {
  sessions: ChatSession[]
  currentSessionId?: string
  currentSessionTitle?: string
  isStreaming: boolean
  streamingSessionIds?: Set<string>
  deletingSessionId: string | null
  onDeleteSession: (session: ChatSession) => void
}) {
  return (
    <div className="space-y-0.5">
      {sessions
        .sort((a, b) => b.lastActivity - a.lastActivity)
        .map((session) => (
          <SessionItem
            key={session.id}
            session={session}
            currentSessionId={currentSessionId}
            currentSessionTitle={currentSessionTitle}
            isStreamingForSession={streamingSessionIds?.has(session.id) ?? (isStreaming && currentSessionId === session.id)}
            deletingSessionId={deletingSessionId}
            onDelete={onDeleteSession}
          />
        ))}
    </div>
  )
}

export function SidebarRepoGroupList({
  repoEntries,
  collapsedRepos,
  onToggleRepo,
  currentSessionId,
  currentSessionTitle,
  isStreaming,
  streamingSessionIds,
  deletingSessionId,
  onDeleteSession,
}: {
  repoEntries: [string, ChatSession[]][]
  collapsedRepos: Set<string>
  onToggleRepo: (key: string) => void
  currentSessionId?: string
  currentSessionTitle?: string
  isStreaming: boolean
  streamingSessionIds?: Set<string>
  deletingSessionId: string | null
  onDeleteSession: (session: ChatSession) => void
}) {
  return (
    <>
      {repoEntries.map(([repoKey, repoSessions]) => {
        const isExpanded = !collapsedRepos.has(repoKey)
        return (
          <div key={repoKey} className="mb-3">
            <button
              type="button"
              onClick={() => onToggleRepo(repoKey)}
              className="w-full flex items-center gap-1 px-2 py-1 text-left group/repo"
            >
              <span className="text-xs text-muted-foreground/60 flex-1 truncate">{repoKey}</span>
              <ChevronIcon
                className={cn(
                  'size-3 shrink-0 text-muted-foreground/30 transition-transform duration-150',
                  isExpanded ? 'rotate-0' : '-rotate-90',
                )}
              />
            </button>
            {isExpanded && (
              <div className="mt-0.5 space-y-0.5">
                {repoSessions
                  .sort((a, b) => b.lastActivity - a.lastActivity)
                  .map((session) => (
                    <SessionItem
                      key={session.id}
                      session={session}
                      currentSessionId={currentSessionId}
                      currentSessionTitle={currentSessionTitle}
                      isStreamingForSession={streamingSessionIds?.has(session.id) ?? (isStreaming && currentSessionId === session.id)}
                      deletingSessionId={deletingSessionId}
                      onDelete={onDeleteSession}
                    />
                  ))}
              </div>
            )}
          </div>
        )
      })}
    </>
  )
}

export function SidebarArchivedSection({ archived }: { archived: ChatSession[] }) {
  const [archiveExpanded, setArchiveExpanded] = useState(false)

  if (archived.length === 0) return null

  return (
    <div className="px-2 py-1 group-data-[collapsible=icon]:hidden">
      <div className="mt-2 pt-2 border-t border-sidebar-border/40">
        <button
          type="button"
          onClick={() => setArchiveExpanded((v) => !v)}
          className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left hover:bg-sidebar-accent transition-colors"
        >
          <span className="text-[10px] uppercase tracking-widest font-medium text-muted-foreground/50 flex-1">
            Archived
          </span>
          <ChevronIcon
            className={cn(
              'size-3 text-muted-foreground/30 transition-transform duration-150',
              archiveExpanded ? 'rotate-0' : '-rotate-90',
            )}
          />
        </button>

        {archiveExpanded && (
          <div className="mt-1 space-y-0.5">
            {archived
              .sort((a, b) => (b.archivedAt ?? 0) - (a.archivedAt ?? 0))
              .map((session) => (
                <Link
                  key={session.id}
                  href={`/session/${session.id}`}
                  className="flex items-baseline justify-between gap-2 px-2 py-1.5 rounded-md text-muted-foreground/50 hover:bg-sidebar-accent hover:text-muted-foreground transition-colors"
                >
                  <span className="text-xs truncate">
                    {getSessionDisplayTitle(session, {
                      fallbackTitle: `${session.repoOwner}/${session.repoName}`,
                    })}
                  </span>
                  <span className="text-[10px] text-muted-foreground/30 shrink-0">
                    {formatRelativeTime(session.archivedAt ?? session.lastActivity)}
                  </span>
                </Link>
              ))}
          </div>
        )}
      </div>
    </div>
  )
}
