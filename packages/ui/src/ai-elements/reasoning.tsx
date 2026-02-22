'use client'

import * as React from 'react'
import { cn } from '../utils'
import { Shimmer } from './shimmer'

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
