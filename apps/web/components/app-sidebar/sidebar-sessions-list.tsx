'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { ChatSession } from '@/lib/api'
import { cn } from '@ship/ui/utils'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuCheckboxItem,
} from '@ship/ui'
import { ClientOnly } from '../client-only'
import { getSessionDisplayTitle } from '@/lib/session-display'
import { formatRelativeTime } from './utils'
import { FolderIcon, ListFilterIcon, ChevronIcon } from './icons'
import { SessionItem } from './sidebar-session-item'

interface SidebarSessionsListProps {
  sessions: ChatSession[]
  currentSessionId?: string
  currentSessionTitle?: string
  isStreaming: boolean
  streamingSessionIds?: Set<string>
  deletingSessionId: string | null
  onDeleteSession: (session: ChatSession) => void
}

export function SidebarSessionsList({
  sessions,
  currentSessionId,
  currentSessionTitle,
  isStreaming,
  streamingSessionIds,
  deletingSessionId,
  onDeleteSession,
}: SidebarSessionsListProps) {
  const [collapsedRepos, setCollapsedRepos] = useState<Set<string>>(new Set())
  const [archiveExpanded, setArchiveExpanded] = useState(false)
  const [groupBy, setGroupBy] = useState<'none' | 'project' | 'date' | 'status'>('none')
  const [compact, setCompact] = useState(true)

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
      {/* Sessions header with filter dropdown */}
      <div className="px-3 py-2 flex items-center justify-between group-data-[collapsible=icon]:hidden">
        <span className="text-[11px] font-medium text-muted-foreground/60">Agents</span>
        <ClientOnly
          fallback={
            <button
              type="button"
              className="p-1 rounded text-muted-foreground/40"
              aria-label="Filter"
            >
              <ListFilterIcon className="size-3.5 text-muted-foreground" />
            </button>
          }
        >
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button
                type="button"
                className={cn(
                  'p-1 rounded transition-colors cursor-pointer',
                  groupByRepo
                    ? 'bg-sidebar-accent text-foreground'
                    : 'text-muted-foreground/40 hover:text-muted-foreground hover:bg-sidebar-accent/50',
                )}
                title="Filter"
                aria-label="Filter and group options"
              >
                <ListFilterIcon className="size-3.5 text-muted-foreground" />
              </button>
            }
          />
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuGroup>
              <DropdownMenuLabel>Group</DropdownMenuLabel>
              <DropdownMenuRadioGroup value={groupBy} onValueChange={(v) => setGroupBy(v as typeof groupBy)}>
              <DropdownMenuRadioItem value="project" className="cursor-pointer">
                Project
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="date" className="cursor-pointer">
                Date
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="status" className="cursor-pointer">
                Status
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="none" className="cursor-pointer">
                None
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuCheckboxItem
              checked={compact}
              onCheckedChange={(v) => setCompact(v === true)}
              className="cursor-pointer"
            >
              Compact
            </DropdownMenuCheckboxItem>
          </DropdownMenuContent>
        </DropdownMenu>
        </ClientOnly>
      </div>

      {/* Sessions list */}
      <div className="px-2 group-data-[collapsible=icon]:hidden">
        {groupByRepo ? (
          /* Grouped by repo view */
          repoEntries.map(([repoKey, repoSessions]) => {
            const isExpanded = !collapsedRepos.has(repoKey)
            const repoName = repoKey.split('/')[1] ?? repoKey

            return (
              <div key={repoKey} className="mb-2">
                <button
                  type="button"
                  onClick={() => toggleRepo(repoKey)}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left hover:bg-sidebar-accent transition-colors group/repo"
                >
                  <FolderIcon className="size-4 shrink-0 text-muted-foreground/60 group-hover/repo:text-muted-foreground transition-colors" />
                  <span className="text-xs font-medium text-muted-foreground flex-1 truncate">{repoName}</span>
                  <span className="text-[10px] text-muted-foreground/40">{repoSessions.length}</span>
                  <ChevronIcon
                    className={cn(
                      'size-3.5 shrink-0 text-muted-foreground/40 transition-transform duration-150',
                      isExpanded ? 'rotate-0' : '-rotate-90',
                    )}
                  />
                </button>

                {isExpanded && (
                  <div className="mt-0.5 ml-3 pl-3 border-l border-sidebar-border/60 space-y-0.5">
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
