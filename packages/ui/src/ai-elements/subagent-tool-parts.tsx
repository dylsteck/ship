'use client'

import * as React from 'react'
import { Collapsible as CollapsiblePrimitive } from '@base-ui/react/collapsible'
import { cn } from '../utils'
import { AgentIcon, ChildToolIcon } from './subagent-tool-icons'

export interface SubagentToolProps {
  toolCallId: string
  agentType: string
  description: string
  status: 'pending' | 'in_progress' | 'completed' | 'failed'
  duration?: number
  result?: React.ReactNode
  childTools?: { name: string; status: string; title?: string }[]
  onNavigate?: (toolCallId: string) => void
  className?: string
}

interface SubagentToolTriggerProps {
  toolCallId: string
  formattedType: string
  description: string
  status: SubagentToolProps['status']
  durationLabel: string | null
  hasExpandContent: boolean
  isOpen: boolean
  onNavigate?: (toolCallId: string) => void
}

/** Header row for a subagent tool invocation. */
export function SubagentToolTrigger({
  toolCallId,
  formattedType,
  description,
  status,
  durationLabel,
  hasExpandContent,
  isOpen,
  onNavigate,
}: SubagentToolTriggerProps) {
  return (
    <CollapsiblePrimitive.Trigger
      className={cn(
        'w-full flex items-center gap-2 py-1 -mx-1 px-1 rounded text-left min-w-0',
      )}
    >
      {status === 'in_progress' ? (
        <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center">
          <span className="h-3 w-3 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
        </span>
      ) : (
        <AgentIcon />
      )}
      <span className="text-sm font-medium text-foreground/90 shrink-0">{formattedType}</span>
      <span className="text-xs text-muted-foreground/50 truncate font-mono min-w-0">{description}</span>
      <div className="flex items-center gap-2 ml-auto shrink-0">
        {durationLabel && (
          <span className="text-xs text-muted-foreground/60">{durationLabel}</span>
        )}
        {onNavigate && (
          <span
            role="button"
            tabIndex={0}
            className="text-xs text-muted-foreground/60 hover:text-foreground/80 transition-colors cursor-pointer"
            onClick={(e) => {
              e.stopPropagation()
              e.preventDefault()
              onNavigate(toolCallId)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.stopPropagation()
                e.preventDefault()
                onNavigate(toolCallId)
              }
            }}
            title="View subagent session"
          >
            View →
          </span>
        )}
        {hasExpandContent && (
          <svg
            className={cn('w-4 h-4 text-muted-foreground/80 transition-transform', !isOpen && '-rotate-90')}
            fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        )}
      </div>
    </CollapsiblePrimitive.Trigger>
  )
}

interface SubagentToolPanelProps {
  toolCallId: string
  childTools?: SubagentToolProps['childTools']
  result?: React.ReactNode
  onNavigate?: (toolCallId: string) => void
}

/** Expanded panel listing child tools and subagent result. */
export function SubagentToolPanel({
  toolCallId,
  childTools,
  result,
  onNavigate,
}: SubagentToolPanelProps) {
  return (
    <CollapsiblePrimitive.Panel>
      <div className="pl-5 pr-2 py-2 border-l border-border/30 ml-1.5 space-y-3 text-[11px]">
        {childTools && childTools.length > 0 && (
          <div className="space-y-1">
            {childTools.map((tool, i) => (
              <div key={i} className="flex items-center gap-2 py-0.5">
                <ChildToolIcon name={tool.name} />
                <span className="text-xs font-medium text-muted-foreground/70">{tool.name}</span>
                {tool.title && (
                  <span className="text-xs text-muted-foreground/40 truncate">{tool.title}</span>
                )}
              </div>
            ))}
          </div>
        )}
        {result && (
          <div className={cn(childTools && childTools.length > 0 && 'border-t border-border/30 pt-3')}>
            <div className="text-sm text-foreground/80">{result}</div>
          </div>
        )}
        {onNavigate && (
          <button
            type="button"
            className="text-xs text-muted-foreground/60 hover:text-foreground/80 transition-colors"
            onClick={(e) => {
              e.stopPropagation()
              onNavigate(toolCallId)
            }}
          >
            View full session →
          </button>
        )}
      </div>
    </CollapsiblePrimitive.Panel>
  )
}