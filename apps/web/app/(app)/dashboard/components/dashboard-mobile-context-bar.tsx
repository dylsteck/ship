'use client'

import { cn } from '@ship/ui'
import type { FileDiff } from '../types'

interface DashboardMobileContextBarProps {
  fileDiffs: FileDiff[]
  onOpenPanel: () => void
  className?: string
}

function diffSummaryLabel(fileDiffs: FileDiff[]): string {
  if (fileDiffs.length === 0) return 'Git & diff'
  const files = fileDiffs.length
  const adds = fileDiffs.reduce((sum, d) => sum + d.additions, 0)
  const dels = fileDiffs.reduce((sum, d) => sum + d.deletions, 0)
  const fileLabel = files === 1 ? '1 file' : `${files} files`
  if (adds === 0 && dels === 0) return fileLabel
  return `${fileLabel} · +${adds} −${dels}`
}

/**
 * Mobile-only affordance to open the right session drawer (Git / diff lives there, not in chat).
 */
export function DashboardMobileContextBar({
  fileDiffs,
  onOpenPanel,
  className,
}: DashboardMobileContextBarProps) {
  return (
    <div
      className={cn(
        'flex shrink-0 items-center gap-2 border-b border-border/40 bg-muted/15 px-3 py-2 md:hidden',
        className,
      )}
    >
      <button
        type="button"
        onClick={onOpenPanel}
        className={cn(
          'inline-flex min-h-8 max-w-full items-center gap-2 rounded-full border border-border/50 bg-card/80 px-3 py-1.5',
          'text-[11px] font-medium text-foreground/90 transition-colors',
          'hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50',
        )}
        aria-label="Open session panel for git diff and tools"
      >
        <svg
          className="size-3.5 shrink-0 text-muted-foreground"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <path d="M15 3v18" />
        </svg>
        <span className="truncate">{diffSummaryLabel(fileDiffs)}</span>
      </button>
      <span className="text-[10px] text-muted-foreground/60">Terminal & desktop in panel</span>
    </div>
  )
}
