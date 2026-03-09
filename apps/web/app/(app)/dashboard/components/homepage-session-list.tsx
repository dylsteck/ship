'use client'

import { useCallback } from 'react'
import { cn } from '@ship/ui'
import type { ChatSession } from '@/lib/api/server'
import { useSessionStatusStore, type SessionLiveStatus } from '../hooks/use-session-status-store'

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
    <div className="px-3 sm:px-6 pb-6 pt-2">
      <div className="max-w-2xl mx-auto">
        {groupSessionsByTime(activeSessions).map((group) => (
          <div key={group.label} className="mb-6">
            <h3 className="text-xs font-medium text-muted-foreground mb-3 sticky top-0 bg-background py-1 z-10">
              {group.label}
            </h3>
            <div className="space-y-3">
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
  const { getStatus } = useSessionStatusStore()
  const liveStatus = getStatus(session.id)

  const title = session.title || session.repoName
  const repoPath = `${session.repoOwner}/${session.repoName}`

  // Determine if this session is actively running
  const isLive = liveStatus?.isRunning || (isStreaming && isActive)
  const currentStatus = liveStatus?.status
    || (isStreaming && isActive ? (streamingStatus || streamingStatusSteps[streamingStatusSteps.length - 1] || 'Running...') : '')
  const steps = liveStatus?.steps || (isStreaming && isActive ? streamingStatusSteps : [])

  const timeLabel = isLive ? 'now' : formatRelativeTime(session.lastActivity)

  return (
    <button
      type="button"
      onClick={handleClick}
      className="w-full flex items-stretch text-left transition-colors hover:opacity-80"
    >
      {/* Left preview panel — only this area has border/bg */}
      <div
        className={cn(
          'shrink-0 w-[160px] min-h-[100px] rounded-xl border flex flex-col justify-end gap-1 p-3 overflow-hidden',
          isLive
            ? 'border-primary/30 bg-primary/5'
            : liveStatus?.status === 'Done'
              ? 'border-emerald-500/30 bg-emerald-500/5'
              : 'border-border/50 bg-muted/20',
        )}
      >
        {isLive && steps.length > 0 ? (
          <div className="w-full space-y-0.5">
            {steps.slice(-4).map((step, i) => (
              <div
                key={i}
                className={cn(
                  'text-[10px] leading-tight truncate',
                  i === steps.slice(-4).length - 1
                    ? 'text-foreground/80 font-medium'
                    : 'text-muted-foreground/50',
                )}
              >
                {step}
              </div>
            ))}
          </div>
        ) : isLive ? (
          <span className="text-[11px] font-medium text-primary truncate">
            {currentStatus || 'Starting...'}
          </span>
        ) : liveStatus?.status === 'Done' ? (
          <div className="flex items-center gap-1.5">
            <svg className="h-3.5 w-3.5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span className="text-[11px] font-medium text-emerald-500">Done</span>
          </div>
        ) : liveStatus?.status === 'Error' ? (
          <div className="flex items-center gap-1.5">
            <svg className="h-3.5 w-3.5 text-destructive" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            <span className="text-[11px] font-medium text-destructive">Error</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            <svg className="h-3.5 w-3.5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <span className="text-[11px] font-medium text-muted-foreground">Branch</span>
          </div>
        )}
      </div>

      {/* Right content — no border/bg */}
      <div className="flex-1 min-w-0 px-4 flex flex-col justify-center">
        <div className="text-base font-medium text-foreground truncate leading-tight">{title}</div>
        <div className="flex items-center gap-2 mt-1.5 text-xs text-muted-foreground">
          <span className="truncate">{agentLabel}</span>
          <span className="shrink-0 truncate">{repoPath}</span>
          <span className="shrink-0">{timeLabel}</span>
        </div>
      </div>
    </button>
  )
}
