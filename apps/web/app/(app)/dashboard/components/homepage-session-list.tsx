'use client'

import { useCallback } from 'react'
import { cn } from '@ship/ui'
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

export interface HomepageSessionListProps {
  sessions: ChatSession[]
  activeSessionId: string | null
  isStreaming: boolean
  streamingStatus: string
  streamingStatusSteps: string[]
  agentLabel?: string
  onSessionClick: (session: ChatSession) => void
  onDeleteSession: (sessionId: string) => Promise<void>
}

export function HomepageSessionList({
  sessions,
  activeSessionId,
  isStreaming,
  streamingStatus,
  streamingStatusSteps,
  agentLabel = 'Ship',
  onSessionClick,
  onDeleteSession,
}: HomepageSessionListProps) {
  const activeSessions = sessions.filter((s) => !s.archivedAt)
  if (activeSessions.length === 0) return null

  return (
    <div className="flex-1 min-h-0 overflow-y-auto px-3 sm:px-6 pb-6 pt-2">
      <div className="max-w-[540px] mx-auto sm:max-w-3xl">
        {groupSessionsByTime(activeSessions).map((group) => (
          <div key={group.label} className="mb-6">
            <h3 className="text-xs font-medium text-muted-foreground mb-2 sticky top-0 bg-background py-1 z-10">
              {group.label}
            </h3>
            <div className="space-y-2">
              {group.sessions.map((session) => (
                <HomepageSessionCard
                  key={session.id}
                  session={session}
                  isActive={activeSessionId === session.id}
                  isStreaming={activeSessionId === session.id && isStreaming}
                  streamingStatus={streamingStatus}
                  streamingStatusSteps={streamingStatusSteps}
                  agentLabel={agentLabel}
                  onSessionClick={onSessionClick}
                  onDeleteSession={onDeleteSession}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

interface HomepageSessionCardProps {
  session: ChatSession
  isActive: boolean
  isStreaming: boolean
  streamingStatus: string
  streamingStatusSteps: string[]
  agentLabel: string
  onSessionClick: (session: ChatSession) => void
  onDeleteSession: (sessionId: string) => Promise<void>
}

function HomepageSessionCard({
  session,
  isActive,
  isStreaming,
  streamingStatus,
  streamingStatusSteps,
  agentLabel,
  onSessionClick,
}: HomepageSessionCardProps) {
  const handleClick = useCallback(() => onSessionClick(session), [onSessionClick, session])
  const title = session.title || session.repoName
  const repoPath = `${session.repoOwner}/${session.repoName}`

  const statusLabel = isStreaming
    ? streamingStatus || streamingStatusSteps[streamingStatusSteps.length - 1] || 'Running...'
    : 'Branch'
  const timeLabel = isStreaming && isActive ? 'now' : formatRelativeTime(session.lastActivity)

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        'w-full flex items-stretch gap-3 rounded-xl border text-left transition-colors',
        'border-border/50 bg-card hover:bg-muted/30 hover:border-border',
        'px-3 py-2.5',
      )}
    >
      <div className="shrink-0 flex items-center">
        <span
          className={cn(
            'rounded-md px-2 py-0.5 text-[11px] font-medium',
            isStreaming
              ? 'bg-primary/15 text-primary'
              : 'bg-muted/60 text-muted-foreground',
          )}
        >
          {statusLabel}
        </span>
      </div>
      <div className="flex-1 min-w-0 py-0.5">
        <div className="text-sm font-medium text-foreground truncate leading-tight">{title}</div>
        <div className="flex items-center gap-2 mt-0.5 text-[11px] text-muted-foreground">
          <span className="truncate">{agentLabel}</span>
          <span className="shrink-0 truncate">{repoPath}</span>
          <span className="shrink-0">{timeLabel}</span>
        </div>
      </div>
    </button>
  )
}
