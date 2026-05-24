'use client'

import * as React from 'react'
import { Collapsible as CollapsiblePrimitive } from '@base-ui/react/collapsible'
import { ScrollArea } from '../scroll-area'
import { cn } from '../utils'
import { ToolIcon } from './tool-icon'
import { renderToolOutput } from './tool-output-renderers'
import type { ToolProps } from './tool-types'
import { formatStatusLabel } from './tool-utils'

type ToolStatus = ToolProps['status']
type ToolLayout = NonNullable<ToolProps['layout']>

interface ToolTriggerProps {
  name: string
  status: ToolStatus
  inputSummary: string | null
  durationLabel: string | null
  layout: ToolLayout
  compact: boolean
  isSubagent?: boolean
  hasDetails: boolean
  isOpen: boolean
}

/** Collapsible trigger row for a tool invocation. */
export function ToolTrigger({
  name,
  status,
  inputSummary,
  durationLabel,
  layout,
  compact,
  isSubagent,
  hasDetails,
  isOpen,
}: ToolTriggerProps) {
  const statusLabel = formatStatusLabel(status)

  return (
    <CollapsiblePrimitive.Trigger
      className={cn(
        'w-full flex py-1 -mx-1 px-1 rounded transition-colors text-left',
        layout === 'stacked' ? 'flex-col items-stretch gap-0.5' : 'items-center gap-2',
        compact ? 'hover:bg-muted/20' : 'hover:bg-muted/40',
        isSubagent && 'pointer-events-none',
      )}
    >
      <div className={cn('flex min-w-0 items-center gap-2', layout === 'stacked' && 'w-full')}>
        <ToolIcon name={name} />
        <span className="text-sm font-medium text-foreground/90 shrink-0">{name}</span>
        {inputSummary && (
          <span className="text-xs text-muted-foreground/50 truncate font-mono min-w-0">{inputSummary}</span>
        )}
      </div>
      <div
        className={cn(
          'flex items-center gap-2 shrink-0',
          layout === 'default' && 'ml-auto',
          layout === 'stacked' && 'w-full justify-between pl-6',
        )}
      >
        {layout === 'stacked' && (
          <span
            className={cn(
              'text-[10px] font-medium uppercase tracking-wide',
              status === 'failed' && 'text-destructive',
              status === 'in_progress' && 'text-blue-500',
              status === 'completed' && 'text-muted-foreground/70',
              status === 'pending' && 'text-muted-foreground/50',
            )}
          >
            {statusLabel}
          </span>
        )}
        {durationLabel && (
          <span className="text-xs text-muted-foreground/60">{durationLabel}</span>
        )}
        {isSubagent ? (
          <svg
            className="w-4 h-4 text-muted-foreground/80"
            fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        ) : hasDetails ? (
          <svg
            className={cn('w-4 h-4 text-muted-foreground/80 transition-transform', !isOpen && '-rotate-90')}
            fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        ) : null}
      </div>
    </CollapsiblePrimitive.Trigger>
  )
}

interface ToolPanelProps {
  name: string
  input?: Record<string, unknown>
  output?: unknown
  compact: boolean
  isReadTool: boolean
  hasOutput: boolean
  showFullOutput: boolean
  onToggleFullOutput: () => void
  truncatedOutput: string
  isOutputTruncated: boolean
  fullOutputText: string
}

/** Collapsible panel with tool input/output details. */
export function ToolPanel({
  name,
  input,
  output,
  compact,
  isReadTool,
  hasOutput,
  showFullOutput,
  onToggleFullOutput,
  truncatedOutput,
  isOutputTruncated,
  fullOutputText,
}: ToolPanelProps) {
  return (
    <CollapsiblePrimitive.Panel>
      <div
        className={cn(
          'pl-5 pr-2 py-2 ml-1.5 space-y-4 text-[11px]',
          !compact && 'border-l border-border/30',
        )}
      >
        {input && Object.keys(input).length > 0 && !isReadTool && (
          <div className="space-y-1.5">
            <p className="font-medium text-muted-foreground/60 text-[10px] uppercase tracking-wider">
              Input
            </p>
            <ScrollArea
              className={cn(
                'rounded-lg',
                compact ? 'border border-border/20 bg-muted/10' : 'border border-border/40 bg-muted/20',
              )}
            >
              <pre className="p-3.5 text-foreground/80 leading-relaxed font-mono text-[11px] whitespace-pre-wrap wrap-break-word">
                {JSON.stringify(input, null, 2)}
              </pre>
            </ScrollArea>
          </div>
        )}
        {hasOutput && (
          <div className={cn('space-y-1.5', isReadTool && 'space-y-0')}>
            {!isReadTool && (
              <p className="font-medium text-muted-foreground/60 text-[10px] uppercase tracking-wider">
                Output
              </p>
            )}
            {renderToolOutput(name, input, output) ?? (
              <>
                <ScrollArea
                  className={cn(
                    'rounded-lg max-h-[400px]',
                    compact ? 'border border-border/20 bg-muted/10' : 'border border-border/40 bg-muted/20',
                  )}
                >
                  <pre className="p-3.5 text-foreground/80 leading-relaxed font-mono text-[11px] whitespace-pre-wrap wrap-break-word">
                    {showFullOutput ? fullOutputText : truncatedOutput}
                  </pre>
                </ScrollArea>
                {isOutputTruncated && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onToggleFullOutput()
                    }}
                    className="text-[10px] text-primary/70 hover:text-primary transition-colors"
                  >
                    {showFullOutput ? 'Show less' : 'Show more'}
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </CollapsiblePrimitive.Panel>
  )
}
