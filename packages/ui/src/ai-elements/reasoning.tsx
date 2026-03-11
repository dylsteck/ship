'use client'

import * as React from 'react'
import { cn } from '../utils'
import { Shimmer } from './shimmer'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../collapsible'

interface ReasoningProps {
  children: React.ReactNode
  isStreaming?: boolean
  /** Duration in seconds (e.g. from elapsed ms / 1000). Shown as "Thought for X seconds" when not streaming. */
  duration?: number
  className?: string
}

function getThinkingLabel(isStreaming: boolean, duration?: number): React.ReactNode {
  if (isStreaming) {
    return <Shimmer>Thinking...</Shimmer>
  }
  if (duration !== undefined && duration > 0) {
    const secs = Math.ceil(duration)
    return secs === 1 ? 'Thought for 1 second' : `Thought for ${secs} seconds`
  }
  return 'Thought for a few seconds'
}

export function Reasoning({ children, isStreaming = false, duration, className }: ReasoningProps) {
  if (!children) return null

  return (
    <div className={cn('rounded-lg border border-border/30 bg-muted/40 overflow-hidden', className)}>
      {/* Header — always visible, no collapse */}
      <div className="flex items-center gap-2.5 px-3.5 py-2.5">
        {/* Brain icon */}
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
        <span className="text-sm font-medium text-foreground/90 shrink-0">
          {getThinkingLabel(isStreaming, duration)}
        </span>
      </div>
      {/* Content — always shown */}
      <div className="border-t border-border/30 px-4 py-3">
        <div className="text-sm text-muted-foreground leading-relaxed">{children}</div>
      </div>
    </div>
  )
}

/** Collapsible reasoning block — opens during streaming, closes when done. Supports multi-chunk "Thought briefly" pattern. */
interface ReasoningCollapsibleProps {
  /** Reasoning content. string[] = multiple chunks (each as "Thought briefly" block); string = split on \n\n for chunks. */
  children?: React.ReactNode
  reasoning?: string | string[]
  isStreaming?: boolean
  duration?: number
  className?: string
}

function ThoughtBrieflyBlock({ content }: { content: string }) {
  if (!content.trim()) return null
  return (
    <div className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{content.trim()}</div>
  )
}

export function ReasoningCollapsible({
  children,
  reasoning,
  isStreaming = false,
  duration,
  className,
}: ReasoningCollapsibleProps) {
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

  const chunks: string[] = React.useMemo(() => {
    if (reasoning !== undefined) {
      if (Array.isArray(reasoning)) {
        // Parts are cumulative; show only the latest (full) text, not history
        const filtered = reasoning.filter(Boolean).map(String)
        const last = filtered[filtered.length - 1]
        return last ? [last] : []
      }
      return String(reasoning)
        .split(/\n\n+/)
        .map((s) => s.trim())
        .filter(Boolean)
    }
    if (children && typeof children === 'string') {
      return children
        .split(/\n\n+/)
        .map((s) => s.trim())
        .filter(Boolean)
    }
    return []
  }, [reasoning, children])

  const hasContent = chunks.length > 0 || (children && typeof children !== 'string')
  if (!hasContent) return null

  const contentNode =
    chunks.length > 0 ? (
      <div className="space-y-2">
        {chunks.map((chunk, i) => (
          <ThoughtBrieflyBlock key={i} content={chunk} />
        ))}
      </div>
    ) : (
      <div className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{children}</div>
    )

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className={cn('rounded-lg border border-border/30 bg-muted/40 overflow-hidden', className)}
    >
      <CollapsibleTrigger className="w-full flex items-center gap-2.5 px-3.5 py-2.5 hover:bg-muted/60 transition-colors text-left">
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
        <span className="text-sm font-medium text-foreground/90 shrink-0 flex-1">
          {getThinkingLabel(isStreaming, duration)}
        </span>
        <svg
          className={cn('w-4 h-4 shrink-0 text-muted-foreground transition-transform', !open && '-rotate-90')}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="border-t border-border/30 px-4 py-3">{contentNode}</div>
      </CollapsibleContent>
    </Collapsible>
  )
}
