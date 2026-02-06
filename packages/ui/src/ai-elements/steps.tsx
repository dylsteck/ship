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

export function Steps({ children, isStreaming = false, elapsed, toolCount, className }: StepsProps) {
  const [isOpen, setIsOpen] = React.useState(isStreaming)

  // Auto-open when streaming starts, auto-close when it ends
  React.useEffect(() => {
    if (isStreaming) {
      setIsOpen(true)
    } else {
      // Collapse after streaming ends with a brief delay
      const timer = setTimeout(() => setIsOpen(false), 300)
      return () => clearTimeout(timer)
    }
  }, [isStreaming])

  const summaryParts: string[] = []
  if (toolCount && toolCount > 0) {
    summaryParts.push(`${toolCount} step${toolCount !== 1 ? 's' : ''}`)
  }
  if (elapsed && elapsed > 0) {
    summaryParts.push(formatElapsed(elapsed))
  }
  const summaryText = summaryParts.length > 0 ? ` · ${summaryParts.join(' · ')}` : ''

  return (
    <CollapsiblePrimitive.Root open={isOpen} onOpenChange={setIsOpen}>
      <CollapsiblePrimitive.Trigger
        className={cn(
          'flex items-center gap-1.5 text-[13px] text-muted-foreground/70 hover:text-muted-foreground transition-colors py-1 group',
          className,
        )}
      >
        {/* Triangle caret icon */}
        <svg
          className={cn(
            'w-3 h-3 transition-transform duration-150 text-muted-foreground/50',
            isOpen && 'rotate-90',
          )}
          fill="currentColor"
          viewBox="0 0 16 16"
        >
          <path d="M6 3l6 5-6 5V3z" />
        </svg>
        {isStreaming ? (
          <span className="flex items-center gap-2">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary/50 opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-primary/60" />
            </span>
            Working...
            {summaryText && <span className="text-muted-foreground/40">{summaryText}</span>}
          </span>
        ) : (
          <span>
            {isOpen ? 'Hide steps' : 'Show steps'}
            {summaryText && (
              <span className="text-muted-foreground/40">{summaryText}</span>
            )}
          </span>
        )}
      </CollapsiblePrimitive.Trigger>
      <CollapsiblePrimitive.Panel>
        <div className="pl-5 pb-1 pt-1">
          {children}
        </div>
      </CollapsiblePrimitive.Panel>
    </CollapsiblePrimitive.Root>
  )
}
