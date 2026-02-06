'use client'

import * as React from 'react'
import { cn } from '../utils'
import { Collapsible as CollapsiblePrimitive } from '@base-ui/react/collapsible'
import { ChevronDown } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'

interface ToolProps {
  name: string
  status: 'pending' | 'in_progress' | 'completed' | 'failed'
  input?: Record<string, unknown>
  output?: unknown
  duration?: number
  className?: string
}

/**
 * Get a smart one-line summary for common tool inputs instead of raw JSON.
 */
function getInputSummary(name: string, input: Record<string, unknown>): string | null {
  const lowerName = name.toLowerCase()

  // File read/write/edit tools
  if (input.file_path || input.path || input.filePath) {
    const path = (input.file_path || input.path || input.filePath) as string
    // Show just the last 2-3 segments
    const segments = path.split('/')
    const short = segments.length > 3 ? '.../' + segments.slice(-3).join('/') : path
    return short
  }

  // Bash/command tools
  if (input.command) {
    const cmd = String(input.command)
    return cmd.length > 80 ? cmd.slice(0, 77) + '...' : cmd
  }

  // Search/grep tools
  if (input.pattern || input.query) {
    const q = String(input.pattern || input.query)
    return q.length > 60 ? q.slice(0, 57) + '...' : q
  }

  // Glob tools
  if (input.glob) {
    return String(input.glob)
  }

  // Content/text tools
  if (input.content) {
    const c = String(input.content)
    return c.length > 60 ? c.slice(0, 57) + '...' : c
  }

  // If there's only one key, show it compactly
  const keys = Object.keys(input)
  if (keys.length === 1) {
    const val = String(input[keys[0]])
    return val.length > 60 ? val.slice(0, 57) + '...' : val
  }

  return null
}

/**
 * Truncate output for display, returning [displayText, isTruncated]
 */
function formatOutput(output: unknown): [string, boolean] {
  const text = typeof output === 'string' ? output : JSON.stringify(output, null, 2)
  const MAX_LINES = 12
  const lines = text.split('\n')
  if (lines.length > MAX_LINES) {
    return [lines.slice(0, MAX_LINES).join('\n'), true]
  }
  return [text, false]
}

export function Tool({ name, status, input, output, duration, className }: ToolProps) {
  const [isOpen, setIsOpen] = React.useState(false)
  const [showFullOutput, setShowFullOutput] = React.useState(false)

  const statusColors = {
    pending: 'bg-muted text-muted-foreground border-border/50',
    in_progress: 'bg-primary/5 text-primary border-primary/20',
    completed: 'bg-muted/50 text-muted-foreground border-border/40',
    failed: 'bg-red-500/5 text-red-600 border-red-500/20',
  }

  const statusIcons = {
    pending: <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40" />,
    in_progress: (
      <span className="relative flex h-1.5 w-1.5">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary/40 opacity-75"></span>
        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-primary"></span>
      </span>
    ),
    completed: <span className="w-1.5 h-1.5 rounded-full bg-green-500/70" />,
    failed: <span className="w-1.5 h-1.5 rounded-full bg-red-500" />,
  }

  const inputSummary = input && Object.keys(input).length > 0 ? getInputSummary(name, input) : null
  const hasDetails = (input && Object.keys(input).length > 0) || output !== undefined

  const [truncatedOutput, isOutputTruncated] = output !== undefined ? formatOutput(output) : ['', false]
  const fullOutputText = output !== undefined ? (typeof output === 'string' ? output : JSON.stringify(output, null, 2)) : ''

  return (
    <CollapsiblePrimitive.Root open={isOpen} onOpenChange={setIsOpen}>
      <div className={cn('rounded-md border overflow-hidden my-1', statusColors[status], className)}>
        <CollapsiblePrimitive.Trigger className="w-full flex items-center justify-between px-2.5 py-1.5 hover:bg-muted/50 dark:hover:bg-muted/30 transition-colors">
          <div className="flex items-center gap-2 min-w-0">
            {statusIcons[status]}
            <span className="text-xs font-medium shrink-0">{name}</span>
            {inputSummary && (
              <span className="text-[11px] text-muted-foreground truncate font-mono">{inputSummary}</span>
            )}
            {duration !== undefined && (
              <span className="text-[10px] text-muted-foreground/60 shrink-0">
                {duration >= 1000 ? `${(duration / 1000).toFixed(1)}s` : `${duration}ms`}
              </span>
            )}
          </div>
          {hasDetails && (
            <HugeiconsIcon
              icon={ChevronDown}
              className={cn('w-3.5 h-3.5 text-muted-foreground/50 transition-transform shrink-0 ml-2', isOpen && 'rotate-180')}
            />
          )}
        </CollapsiblePrimitive.Trigger>
        {hasDetails && (
          <CollapsiblePrimitive.Panel>
            <div className="px-2.5 pb-2 space-y-1.5 text-[11px]">
              {input && Object.keys(input).length > 0 && (
                <div>
                  <p className="font-medium mb-0.5 text-muted-foreground/60 text-[10px] uppercase tracking-wide">Input</p>
                  <pre className="bg-muted/60 dark:bg-muted/30 rounded px-2 py-1.5 overflow-x-auto text-foreground/80 leading-relaxed">
                    {JSON.stringify(input, null, 2)}
                  </pre>
                </div>
              )}
              {output !== undefined && (
                <div>
                  <p className="font-medium mb-0.5 text-muted-foreground/60 text-[10px] uppercase tracking-wide">Output</p>
                  <pre className="bg-muted/60 dark:bg-muted/30 rounded px-2 py-1.5 overflow-x-auto text-foreground/80 leading-relaxed">
                    {showFullOutput ? fullOutputText : truncatedOutput}
                  </pre>
                  {isOutputTruncated && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setShowFullOutput(!showFullOutput)
                      }}
                      className="text-[10px] text-primary/70 hover:text-primary mt-0.5 transition-colors"
                    >
                      {showFullOutput ? 'Show less' : 'Show more'}
                    </button>
                  )}
                </div>
              )}
            </div>
          </CollapsiblePrimitive.Panel>
        )}
      </div>
    </CollapsiblePrimitive.Root>
  )
}
