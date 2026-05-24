'use client'

import { memo, useCallback } from 'react'
import { cn } from '@ship/ui'
import type { ChatSession } from '@/lib/api/server'
import type { ModelInfo } from '@/lib/api/types'
import { getSessionDisplayTitle, getSessionRepoLabel } from '@/lib/session-display'
import { useSessionStatus } from '../hooks/use-session-status-store'
import { formatRelativeTime, getSessionModelLabel, groupSessionsByTime } from './homepage-session-list-helpers'
import { SessionPreviewPanel, sessionIsStreaming } from './homepage-session-preview'

export interface HomepageSessionListProps {
  sessions: ChatSession[]
  activeSessionId: string | null
  isStreaming: boolean
  streamingSessionIds?: Set<string>
  streamingStatus: string
  streamingStatusSteps: string[]
  agentLabel?: string
  models: ModelInfo[]
  onSessionClick: (session: ChatSession) => void
  onDeleteSession: (sessionId: string) => Promise<void>
  /** Stable timestamp for SSR-safe grouping/formatting */
  serverTimestamp?: number
}

export function HomepageSessionList({
  sessions,
  activeSessionId,
  isStreaming,
  streamingSessionIds,
  streamingStatus,
  streamingStatusSteps,
  agentLabel = 'Ship',
  models,
  onSessionClick,
  onDeleteSession,
  serverTimestamp = Math.floor(Date.now() / 1000),
}: HomepageSessionListProps) {
  const now = serverTimestamp
  const activeSessions = sessions.filter((s) => !s.archivedAt)
  if (activeSessions.length === 0) return null

  return (
    <div className="px-3 sm:px-6 pb-6 pt-6">
      <div className="max-w-2xl mx-auto">
        {groupSessionsByTime(activeSessions, now).map((group) => (
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
                  streamingSessionIds={streamingSessionIds}
                  streamingStatus={streamingStatus}
                  streamingStatusSteps={streamingStatusSteps}
                  agentLabel={agentLabel}
                  models={models}
                  onSessionClick={onSessionClick}
                  now={now}
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
  streamingSessionIds?: Set<string>
  streamingStatus: string
  streamingStatusSteps: string[]
  agentLabel: string
  models: ModelInfo[]
  onSessionClick: (session: ChatSession) => void
  now: number
}

const HomepageSessionCard = memo(function HomepageSessionCard({
  session,
  isActive,
  isStreaming,
  streamingSessionIds,
  streamingStatus,
  streamingStatusSteps,
  agentLabel,
  models,
  onSessionClick,
  now,
}: HomepageSessionCardProps) {
  const handleClick = useCallback(() => onSessionClick(session), [onSessionClick, session])
  const liveStatus = useSessionStatus(session.id)

  const title = liveStatus?.title || getSessionDisplayTitle(session) || (liveStatus?.isRunning ? 'New Agent' : session.repoName)
  const repoPath = getSessionRepoLabel(session) || session.repoName
  const modelLabel = getSessionModelLabel(session, models, agentLabel)

  const isStreamingNow = sessionIsStreaming(session.id, liveStatus, streamingSessionIds, isStreaming, isActive)
  const isStreamingInBackground = streamingSessionIds?.has(session.id) ?? false

  const currentStatus =
    liveStatus?.status ||
    (isStreaming && isActive
      ? streamingStatus || streamingStatusSteps[streamingStatusSteps.length - 1] || 'Running...'
      : isStreamingInBackground
        ? 'Starting...'
        : '')
  const steps = liveStatus?.steps || (isStreaming && isActive ? streamingStatusSteps : [])
  const contentPreview = liveStatus?.contentPreview || ''

  const timeLabel = isStreamingNow ? 'now' : formatRelativeTime(session.lastActivity, now)

  return (
    <button
      type="button"
      onClick={handleClick}
      className="w-full flex items-stretch text-left transition-colors hover:opacity-80"
    >
      <div
        className={cn(
          'shrink-0 w-[160px] min-h-[100px] rounded-xl border flex flex-col justify-end gap-1 p-3 overflow-hidden',
          isStreamingNow
            ? 'border-primary/30 bg-primary/5'
            : 'border-border/50 bg-muted/20',
        )}
      >
        <SessionPreviewPanel
          liveStatus={liveStatus}
          isStreamingNow={isStreamingNow}
          currentStatus={currentStatus}
          steps={steps}
          contentPreview={contentPreview}
        />
      </div>

      <div className="flex-1 min-w-0 px-4 flex flex-col justify-center">
        <div className="text-base font-medium text-foreground truncate leading-tight">{title}</div>
        <div className="flex items-center gap-2 mt-1.5 text-xs text-muted-foreground">
          <span className="truncate">{modelLabel}</span>
          <span className="shrink-0 truncate">{repoPath}</span>
          <span className="shrink-0">{timeLabel}</span>
        </div>
      </div>
    </button>
  )
})
