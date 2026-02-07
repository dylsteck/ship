'use client'

import * as React from 'react'
import { cn } from '../utils'
import { Collapsible as CollapsiblePrimitive } from '@base-ui/react/collapsible'

interface ToolProps {
  name: string
  status: 'pending' | 'in_progress' | 'completed' | 'failed'
  input?: Record<string, unknown>
  output?: unknown
  duration?: number
  className?: string

  // Subagent support
  sessionId?: string
  onViewSubagent?: (sessionId: string) => void
  subagentLabel?: string
}

// ============ Tool Icons (inline SVGs for zero-dependency) ============

function ToolIcon({ name }: { name: string }) {
  const lowerName = name.toLowerCase()
  const iconClass = 'w-3.5 h-3.5 shrink-0 text-muted-foreground/60'

  // Read → glasses
  if (lowerName.includes('read')) {
    return (
      <svg
        className={iconClass}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="6.5" cy="11" r="4.5" />
        <circle cx="17.5" cy="11" r="4.5" />
        <path d="M11 11h2" />
        <path d="M2 11h0" />
        <path d="M22 11h0" />
      </svg>
    )
  }

  // Glob/Search → magnifying glass
  if (lowerName.includes('glob') || lowerName.includes('search')) {
    return (
      <svg
        className={iconClass}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="11" cy="11" r="7" />
        <path d="m21 21-4.35-4.35" />
      </svg>
    )
  }

  // Grep → magnifying glass with lines
  if (lowerName.includes('grep')) {
    return (
      <svg
        className={iconClass}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="10" cy="10" r="6" />
        <path d="m20 20-3.5-3.5" />
        <path d="M7 10h6" />
        <path d="M7 8h3" />
      </svg>
    )
  }

  // Bash/Shell → terminal
  if (
    lowerName.includes('bash') ||
    lowerName.includes('shell') ||
    lowerName.includes('run') ||
    lowerName.includes('command')
  ) {
    return (
      <svg
        className={iconClass}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polyline points="4 17 10 11 4 5" />
        <line x1="12" y1="19" x2="20" y2="19" />
      </svg>
    )
  }

  // Write → pencil
  if (lowerName.includes('write')) {
    return (
      <svg
        className={iconClass}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
      </svg>
    )
  }

  // Edit → pencil-square
  if (lowerName.includes('edit')) {
    return (
      <svg
        className={iconClass}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
      </svg>
    )
  }

  // Task/Agent → boxes
  if (lowerName.includes('task') || lowerName.includes('agent')) {
    return (
      <svg
        className={iconClass}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    )
  }

  // WebFetch/WebSearch → globe
  if (lowerName.includes('web') || lowerName.includes('fetch') || lowerName.includes('url')) {
    return (
      <svg
        className={iconClass}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="10" />
        <line x1="2" y1="12" x2="22" y2="12" />
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
      </svg>
    )
  }

  // Default → wrench
  return (
    <svg
      className={iconClass}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
    </svg>
  )
}

/**
 * Get a smart one-line summary for common tool inputs instead of raw JSON.
 */
function getInputSummary(name: string, input: Record<string, unknown>): string | null {
  // File read/write/edit tools
  if (input.file_path || input.path || input.filePath) {
    const path = String(input.file_path || input.path || input.filePath || '')
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

export function Tool({
  name,
  status,
  input,
  output,
  duration,
  className,
  sessionId,
  onViewSubagent,
  subagentLabel = 'View subagent',
}: ToolProps) {
  const [isOpen, setIsOpen] = React.useState(false)
  const [showFullOutput, setShowFullOutput] = React.useState(false)

  const inputSummary = input && Object.keys(input).length > 0 ? getInputSummary(name, input) : null
  const hasDetails = (input && Object.keys(input).length > 0) || output !== undefined
  const isSubagent = Boolean(sessionId) || name.toLowerCase().includes('task') || name.toLowerCase().includes('agent')

  const [truncatedOutput, isOutputTruncated] = output !== undefined ? formatOutput(output) : ['', false]
  const fullOutputText =
    output !== undefined ? (typeof output === 'string' ? output : JSON.stringify(output, null, 2)) : ''

  const handleViewSubagent = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (sessionId && onViewSubagent) {
      onViewSubagent(sessionId)
    }
  }

  return (
    <CollapsiblePrimitive.Root open={isOpen} onOpenChange={setIsOpen}>
      <div className={cn('rounded-md border border-border/30 overflow-hidden my-1 bg-muted/20', className)}>
        <CollapsiblePrimitive.Trigger className="w-full flex items-center justify-between px-2.5 py-1.5 hover:bg-muted/40 transition-colors">
          <div className="flex items-center gap-2 min-w-0">
            <ToolIcon name={name} />
            <span className="text-xs font-semibold text-foreground/90 shrink-0">{name}</span>
            {inputSummary && (
              <span className="text-[11px] text-muted-foreground/60 truncate font-mono">{inputSummary}</span>
            )}
            {status === 'in_progress' && (
              <span className="relative flex h-1.5 w-1.5 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary/40 opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-primary" />
              </span>
            )}
            {duration !== undefined && (
              <span className="text-[10px] text-muted-foreground/50 shrink-0">
                {duration >= 1000 ? `${(duration / 1000).toFixed(1)}s` : `${duration}ms`}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {/* Subagent View Button */}
            {isSubagent && sessionId && onViewSubagent && (
              <button
                onClick={handleViewSubagent}
                className="flex items-center gap-1 text-[10px] text-primary hover:text-primary/80 transition-colors px-1.5 py-0.5 rounded hover:bg-primary/10"
                title={subagentLabel}
              >
                <svg
                  className="w-3 h-3"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                  <polyline points="15 3 21 3 21 9" />
                  <line x1="10" y1="14" x2="21" y2="3" />
                </svg>
                <span className="hidden sm:inline">{subagentLabel}</span>
              </button>
            )}
            {hasDetails && (
              <svg
                className={cn('w-3.5 h-3.5 text-muted-foreground/40 transition-transform', isOpen && 'rotate-180')}
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            )}
          </div>
        </CollapsiblePrimitive.Trigger>
        {hasDetails && (
          <CollapsiblePrimitive.Panel>
            <div className="px-2.5 pb-2 space-y-1.5 text-[11px]">
              {input && Object.keys(input).length > 0 && (
                <div>
                  <p className="font-medium mb-0.5 text-muted-foreground/50 text-[10px] uppercase tracking-wide">
                    Input
                  </p>
                  <pre className="bg-muted/40 rounded px-2 py-1.5 overflow-x-auto text-foreground/80 leading-relaxed">
                    {JSON.stringify(input, null, 2)}
                  </pre>
                </div>
              )}
              {output !== undefined && (
                <div>
                  <p className="font-medium mb-0.5 text-muted-foreground/50 text-[10px] uppercase tracking-wide">
                    Output
                  </p>
                  <pre className="bg-muted/40 rounded px-2 py-1.5 overflow-x-auto text-foreground/80 leading-relaxed">
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
