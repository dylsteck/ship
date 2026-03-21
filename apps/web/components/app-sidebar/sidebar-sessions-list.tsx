'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { ChatSession } from '@/lib/api'
import { cn } from '@ship/ui/utils'
import { getSessionDisplayTitle } from '@/lib/session-display'
import { formatRelativeTime } from './utils'
import { FolderIcon, ChevronIcon } from './icons'
import { SessionItem } from './sidebar-session-item'

interface SidebarSessionsListProps {
  sessions: ChatSession[]
  currentSessionId?: string
  currentSessionTitle?: string
  isStreaming: boolean
  streamingSessionIds?: Set<string>
  deletingSessionId: string | null
  onDeleteSession: (session: ChatSession) => void
  groupBy: 'none' | 'project' | 'date' | 'status'
  compact: boolean
}

export function SidebarSessionsList({
  sessions,
  currentSessionId,
  currentSessionTitle,
  isStreaming,
  streamingSessionIds,
  deletingSessionId,
  onDeleteSession,
  groupBy,
  compact,
}: SidebarSessionsListProps) {
  const [collapsedRepos, setCollapsedRepos] = useState<Set<string>>(new Set())
  const [archiveExpanded, setArchiveExpanded] = useState(false)

  const groupByRepo = groupBy === 'project'

  const toggleRepo = (key: string) => {
    setCollapsedRepos((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  // Split into non-archived and archived
  const nonArchived = sessions.filter((s) => !s.archivedAt)
  const archived = sessions.filter((s) => !!s.archivedAt)

  // Group non-archived by repo, sorted by most recent activity
  const byRepo: Record<string, ChatSession[]> = {}
  for (const session of nonArchived) {
    const key = `${session.repoOwner}/${session.repoName}`
    if (!byRepo[key]) byRepo[key] = []
    byRepo[key].push(session)
  }
  const repoEntries = Object.entries(byRepo).sort(
    ([, a], [, b]) => Math.max(...b.map((s) => s.lastActivity)) - Math.max(...a.map((s) => s.lastActivity)),
  )

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Sessions list */}
      <div className="px-2 pt-6 group-data-[collapsible=icon]:hidden">
        {groupByRepo ? (
          /* Grouped by repo view */
          repoEntries.map(([repoKey, repoSessions]) => {
            const isExpanded = !collapsedRepos.has(repoKey)

            return (
              <div key={repoKey} className="mb-3">
                <button
                  type="button"
                  onClick={() => toggleRepo(repoKey)}
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
          })
        ) : (
          /* Flat list view */
          <div className="space-y-0.5">
            {nonArchived
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

      {/* Archive section */}
      {archived.length > 0 && (
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
      )}
    </div>
  )
}
