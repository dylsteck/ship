'use client'

import { cn } from '@ship/ui'
import type { SessionLiveStatus } from '../hooks/use-session-status-store'

export function isTerminalStatus(status: string | undefined): boolean {
  return status === 'Done' || status === 'Error' || status === 'Stopped'
}

export function sessionIsStreaming(
  sessionId: string,
  liveStatus: SessionLiveStatus | undefined,
  streamingSessionIds: Set<string> | undefined,
  isStreaming: boolean,
  isActive: boolean,
): boolean {
  return (
    liveStatus?.isRunning === true ||
    streamingSessionIds?.has(sessionId) === true ||
    (isStreaming && isActive)
  )
}

function shouldShowBranchBadge(
  liveStatus: SessionLiveStatus | undefined,
  isStreamingNow: boolean,
): boolean {
  if (isStreamingNow) return false
  if (liveStatus?.status === 'Done') return true
  if (liveStatus?.status === 'Error') return false
  return !liveStatus?.status && !liveStatus?.contentPreview && (liveStatus?.steps?.length ?? 0) === 0
}

function BranchBadge() {
  return (
    <div className="flex-1 min-h-0 flex items-center justify-center">
      <div className="inline-flex items-center rounded-full font-medium px-2 py-0.5 text-sm gap-1.5 bg-muted text-muted-foreground">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-3 w-3 shrink-0"
          aria-hidden
        >
          <line x1="6" x2="6" y1="3" y2="15" />
          <circle cx="18" cy="6" r="3" />
          <circle cx="6" cy="18" r="3" />
          <path d="M18 9a9 9 0 0 1-9 9" />
        </svg>
        <span>Branch</span>
      </div>
    </div>
  )
}

export function SessionPreviewPanel({
  liveStatus,
  isStreamingNow,
  currentStatus,
  steps,
  contentPreview,
}: {
  liveStatus: SessionLiveStatus | undefined
  isStreamingNow: boolean
  currentStatus: string
  steps: string[]
  contentPreview: string
}) {
  if (shouldShowBranchBadge(liveStatus, isStreamingNow)) {
    return <BranchBadge />
  }

  if (liveStatus?.status === 'Error') {
    return (
      <div className="flex items-center gap-1.5">
        <svg className="h-3.5 w-3.5 text-destructive" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
        <span className="text-[11px] font-medium text-destructive">Error</span>
      </div>
    )
  }

  if (isStreamingNow && contentPreview) {
    return (
      <div className="w-full">
        <p className="text-[10px] leading-tight text-foreground/70 line-clamp-5 whitespace-pre-wrap">
          {contentPreview.slice(0, 200)}
        </p>
      </div>
    )
  }

  if (isStreamingNow && steps.length > 0) {
    const visibleSteps = steps.slice(-4)
    const lastStep = visibleSteps[visibleSteps.length - 1]
    const reasoningText = lastStep === 'Reasoning...' ? liveStatus?.reasoningPreview : undefined
    return (
      <div className="w-full space-y-0.5">
        {visibleSteps.map((step, i) => (
          <div
            key={i}
            className={cn(
              'text-[10px] leading-tight truncate',
              i === visibleSteps.length - 1 ? 'text-foreground/80 font-medium' : 'text-muted-foreground/50',
            )}
          >
            {step}
          </div>
        ))}
        {reasoningText && (
          <p className="text-[10px] leading-tight text-muted-foreground/60 line-clamp-2 mt-0.5">
            {reasoningText}
          </p>
        )}
      </div>
    )
  }

  if (isStreamingNow || (liveStatus?.status && !isTerminalStatus(liveStatus.status))) {
    return (
      <div className="flex items-center gap-1.5">
        {isStreamingNow ? (
          <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse shrink-0" aria-hidden />
        ) : null}
        <span
          className={cn(
            'text-[11px] font-medium truncate',
            isStreamingNow ? 'text-primary' : 'text-foreground/80',
          )}
        >
          {currentStatus || steps[steps.length - 1] || 'Starting...'}
        </span>
      </div>
    )
  }

  return <BranchBadge />
}
