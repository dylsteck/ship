'use client'

import * as React from 'react'
import { cn } from '../utils'
import { Collapsible as CollapsiblePrimitive } from '@base-ui/react/collapsible'

interface StepsProps {
  children: React.ReactNode
  isStreaming?: boolean
  /** Total elapsed time in ms */
  elapsed?: number
  /** Number of tool calls */
  toolCount?: number
  className?: string
}

function formatElapsed(ms: number): string {
  if (ms >= 60000) {
    const mins = Math.floor(ms / 60000)
    const secs = ((ms % 60000) / 1000).toFixed(0)
    return `${mins}m ${secs}s`
  }
  return `${(ms / 1000).toFixed(1)}s`
}

/** List/steps icon (like Tool component) */
function StepsIcon() {
  return (
    <svg
      className="w-3.5 h-3.5 shrink-0 text-muted-foreground/70"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M8 6h13" />
      <path d="M8 12h13" />
      <path d="M8 18h13" />
      <path d="M3 6h.01" />
      <path d="M3 12h.01" />
      <path d="M3 18h.01" />
    </svg>
  )
}

export function Steps({ children, isStreaming = false, elapsed, toolCount, className }: StepsProps) {
  const [isOpen, setIsOpen] = React.useState(isStreaming)

  // Auto-open when streaming starts, never auto-close
  React.useEffect(() => {
    if (isStreaming) {
      setIsOpen(true)
    }
  }, [isStreaming])

  const label =
    toolCount && toolCount > 0
      ? `${toolCount} step${toolCount !== 1 ? 's' : ''}`
      : 'Steps'
  const durationLabel =
    elapsed && elapsed > 0 ? formatElapsed(elapsed) : null

  return (
    <CollapsiblePrimitive.Root open={isOpen} onOpenChange={setIsOpen}>
      <div
        className={cn(
          'rounded-lg border border-border/30 bg-muted/40 overflow-hidden',
          className,
        )}
      >
        <CollapsiblePrimitive.Trigger
          className="w-full flex items-center gap-2.5 px-3.5 py-2 hover:bg-muted/60 transition-colors min-h-[36px]"
        >
          <StepsIcon />
          <span className="text-sm font-medium text-foreground/90 shrink-0">{label}</span>
          <div className="flex items-center gap-2 ml-auto shrink-0">
            {durationLabel && (
              <span className="text-xs text-muted-foreground/60">{durationLabel}</span>
            )}
            {isStreaming && (
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary/50 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary/60" />
              </span>
            )}
            <svg
              className={cn('w-3.5 h-3.5 text-muted-foreground/40 transition-transform', isOpen && 'rotate-180')}
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </CollapsiblePrimitive.Trigger>
        <CollapsiblePrimitive.Panel>
          <div className="border-t border-border/30 px-4 py-3 space-y-2">
            {children}
          </div>
        </CollapsiblePrimitive.Panel>
      </div>
    </CollapsiblePrimitive.Root>
  )
}
