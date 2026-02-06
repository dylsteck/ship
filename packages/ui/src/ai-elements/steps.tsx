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

  return (
    <CollapsiblePrimitive.Root open={isOpen} onOpenChange={setIsOpen}>
      <CollapsiblePrimitive.Trigger
        className={cn(
          'flex items-center gap-2 text-[13px] text-muted-foreground/70 hover:text-muted-foreground transition-colors py-1 group',
          className,
        )}
      >
        <svg
          className={cn(
            'w-3 h-3 transition-transform text-muted-foreground/40',
            isOpen && 'rotate-90',
          )}
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path
            fillRule="evenodd"
            d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
            clipRule="evenodd"
          />
        </svg>
        {isStreaming ? (
          <span className="flex items-center gap-2">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary/50 opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-primary/60" />
            </span>
            Working...
          </span>
        ) : (
          <span>
            Show steps
            {summaryParts.length > 0 && (
              <span className="ml-1.5 text-muted-foreground/40">
                {summaryParts.join(' · ')}
              </span>
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
