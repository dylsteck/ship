'use client'

import * as React from 'react'
import { cn } from '../utils'
import { Shimmer } from './shimmer'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../collapsible'

interface ThinkingBlockProps {
  reasoning?: string | string[]
  children?: React.ReactNode
  isStreaming?: boolean
  /** Duration in seconds when done (e.g. elapsed ms / 1000). Shows "Thought for X seconds" instead of "Thinking". */
  duration?: number
  className?: string
}

function BrainIcon() {
  return (
    <svg
      className="w-4 h-4 shrink-0 text-muted-foreground/70"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z" />
      <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z" />
    </svg>
  )
}

function formatThoughtDuration(secs: number): string {
  if (secs < 60) {
    return secs === 1 ? 'Thought for 1 second' : `Thought for ${secs} seconds`
  }
  const mins = Math.floor(secs / 60)
  const remainder = secs % 60
  if (mins >= 60) {
    const hours = Math.floor(mins / 60)
    const minRem = mins % 60
    if (minRem === 0) {
      return hours === 1 ? 'Thought for 1 hour' : `Thought for ${hours} hours`
    }
    return `Thought for ${hours}h ${minRem}m`
  }
  if (remainder === 0) {
    return mins === 1 ? 'Thought for 1 minute' : `Thought for ${mins} minutes`
  }
  return `Thought for ${mins}m ${remainder}s`
}

function getThinkingLabel(isStreaming: boolean, duration?: number): React.ReactNode {
  if (isStreaming) {
    return <Shimmer>Thinking</Shimmer>
  }
  if (duration !== undefined && duration > 0) {
    return formatThoughtDuration(Math.ceil(duration))
  }
  return 'Thought'
}

/**
 * Unified collapsible block for reasoning + tool calls.
 * Opens while streaming, auto-collapses when done.
 * Header shows Cursor-style "Thought for X seconds" label.
 */
export function ThinkingBlock({
  reasoning,
  children,
  isStreaming = false,
  duration,
  className,
}: ThinkingBlockProps) {
  const [open, setOpen] = React.useState(isStreaming)
  const prevStreamingRef = React.useRef(isStreaming)

  React.useEffect(() => {
    if (isStreaming) {
      setOpen(true)
    } else if (prevStreamingRef.current) {
      setOpen(false)
    }
    prevStreamingRef.current = isStreaming
  }, [isStreaming])

  const reasoningText = React.useMemo(() => {
    if (!reasoning) return null
    if (Array.isArray(reasoning)) {
      // Parts are cumulative; show only the latest (full) text, not history
      const filtered = reasoning.filter(Boolean)
      return filtered.length > 0 ? filtered[filtered.length - 1]! : null
    }
    return String(reasoning)
  }, [reasoning])

  const hasReasoning = !!reasoningText
  const hasChildren = React.Children.count(children) > 0
  if (!hasReasoning && !hasChildren) return null

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className={cn('overflow-hidden', className)}
    >
      <CollapsibleTrigger className="w-full flex items-center gap-2 py-1.5 -mx-1 px-1 rounded text-left group/trigger">
        <span
          className={cn(
            'text-sm text-muted-foreground shrink-0',
            isStreaming && 'animate-pulse',
          )}
        >
          {getThinkingLabel(isStreaming, duration)}
        </span>
        <svg
          className={cn('w-4 h-4 shrink-0 text-muted-foreground/80 transition-transform', !open && '-rotate-90')}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="pl-5 pr-1 py-2 space-y-1.5">
          {hasReasoning && (
            <div className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
              {reasoningText}
            </div>
          )}
          {hasChildren && (
            <div className={hasReasoning ? 'pt-1' : undefined}>
              {children}
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
