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
  onClick?: () => void
  isSubagent?: boolean
}

// ============ Tool Icons ============

function ToolIcon({ name }: { name: string }) {
  const lowerName = name.toLowerCase()
  const iconClass = 'w-3.5 h-3.5 shrink-0 text-muted-foreground/70'

  if (lowerName.includes('read')) {
    return (
      <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="6.5" cy="11" r="4.5" /><circle cx="17.5" cy="11" r="4.5" /><path d="M11 11h2" /><path d="M2 11h0" /><path d="M22 11h0" />
      </svg>
    )
  }

  if (lowerName.includes('glob') || lowerName.includes('search')) {
    return (
      <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="7" /><path d="m21 21-4.35-4.35" />
      </svg>
    )
  }

  if (lowerName.includes('grep')) {
    return (
      <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="10" cy="10" r="6" /><path d="m20 20-3.5-3.5" /><path d="M7 10h6" /><path d="M7 8h3" />
      </svg>
    )
  }

  if (lowerName.includes('bash') || lowerName.includes('shell') || lowerName.includes('run') || lowerName.includes('command')) {
    return (
      <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="4 17 10 11 4 5" /><line x1="12" y1="19" x2="20" y2="19" />
      </svg>
    )
  }

  if (lowerName.includes('write')) {
    return (
      <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
      </svg>
    )
  }

  if (lowerName.includes('edit')) {
    return (
      <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
      </svg>
    )
  }

  if (lowerName.includes('task') || lowerName.includes('agent')) {
    return (
      <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    )
  }

  if (lowerName.includes('web') || lowerName.includes('fetch') || lowerName.includes('url')) {
    return (
      <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
      </svg>
    )
  }

  return (
    <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
    </svg>
  )
}

function getInputSummary(name: string, input: Record<string, unknown>): string | null {
  if (input.file_path || input.path || input.filePath) {
    const path = String(input.file_path || input.path || input.filePath || '')
    const segments = path.split('/')
    return segments.length > 3 ? '.../' + segments.slice(-3).join('/') : path
  }
  if (input.command) {
    const cmd = String(input.command)
    return cmd.length > 80 ? cmd.slice(0, 77) + '...' : cmd
  }
  if (input.pattern || input.query) {
    const q = String(input.pattern || input.query)
    return q.length > 60 ? q.slice(0, 57) + '...' : q
  }
  if (input.glob) return String(input.glob)
  if (input.content) {
    const c = String(input.content)
    return c.length > 60 ? c.slice(0, 57) + '...' : c
  }
  if (input.description) {
    const d = String(input.description)
    return d.length > 60 ? d.slice(0, 57) + '...' : d
  }
  if (input.prompt) {
    const p = String(input.prompt)
    return p.length > 60 ? p.slice(0, 57) + '...' : p
  }
  const keys = Object.keys(input)
  if (keys.length === 1) {
    const val = String(input[keys[0]])
    return val.length > 60 ? val.slice(0, 57) + '...' : val
  }
  return null
}

function formatOutput(output: unknown): [string, boolean] {
  const text = typeof output === 'string' ? output : JSON.stringify(output, null, 2)
  const MAX_LINES = 20
  const lines = text.split('\n')
  if (lines.length > MAX_LINES) {
    return [lines.slice(0, MAX_LINES).join('\n'), true]
  }
  return [text, false]
}

function StatusIndicator({ status }: { status: ToolProps['status'] }) {
  if (status === 'in_progress') {
    return (
      <span className="relative flex h-2 w-2 shrink-0">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary/40 opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
      </span>
    )
  }
  if (status === 'completed') {
    return <span className="flex h-2 w-2 shrink-0 rounded-full bg-green-500" />
  }
  if (status === 'failed') {
    return <span className="flex h-2 w-2 shrink-0 rounded-full bg-red-500" />
  }
  return null
}

export function Tool({
  name,
  status,
  input,
  output,
  duration,
  className,
  onClick,
  isSubagent,
}: ToolProps) {
  const [isOpen, setIsOpen] = React.useState(false)
  const [showFullOutput, setShowFullOutput] = React.useState(false)

  const inputSummary = input && Object.keys(input).length > 0 ? getInputSummary(name, input) : null
  const hasDetails = (input && Object.keys(input).length > 0) || output !== undefined

  const [truncatedOutput, isOutputTruncated] = output !== undefined ? formatOutput(output) : ['', false]
  const fullOutputText =
    output !== undefined ? (typeof output === 'string' ? output : JSON.stringify(output, null, 2)) : ''

  const durationLabel = duration !== undefined
    ? (duration >= 60000 ? `${Math.floor(duration / 60000)}m ${((duration % 60000) / 1000).toFixed(0)}s` : duration >= 1000 ? `${(duration / 1000).toFixed(1)}s` : `${duration}ms`)
    : null

  return (
    <CollapsiblePrimitive.Root open={isOpen} onOpenChange={isSubagent ? undefined : setIsOpen}>
      <div
        className={cn('group/tool', isSubagent && 'cursor-pointer', className)}
        onClick={isSubagent ? onClick : undefined}
      >
        <CollapsiblePrimitive.Trigger
          className={cn(
            'w-full flex items-center gap-2 py-1 -mx-1 px-1 rounded hover:bg-muted/40 transition-colors text-left',
            isSubagent && 'pointer-events-none',
          )}
        >
          <ToolIcon name={name} />
          <span className="text-sm font-medium text-foreground/90 shrink-0">{name}</span>
          {inputSummary && (
            <span className="text-xs text-muted-foreground/50 truncate font-mono">{inputSummary}</span>
          )}
          <div className="flex items-center gap-2 ml-auto shrink-0">
            {durationLabel && (
              <span className="text-xs text-muted-foreground/60">{durationLabel}</span>
            )}
            <StatusIndicator status={status} />
            {isSubagent ? (
              <svg
                className="w-4 h-4 text-muted-foreground/40"
                fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            ) : hasDetails ? (
              <svg
                className={cn('w-3.5 h-3.5 text-muted-foreground/40 transition-transform', isOpen && 'rotate-180')}
                fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            ) : null}
          </div>
        </CollapsiblePrimitive.Trigger>
        {hasDetails && !isSubagent && (
          <CollapsiblePrimitive.Panel>
            <div className="pl-5 pr-2 py-2 border-l border-border/30 ml-1.5 space-y-3 text-[11px]">
              {input && Object.keys(input).length > 0 && (
                <div>
                  <p className="font-medium mb-1.5 text-muted-foreground/40 text-[10px] uppercase tracking-wider">
                    Input
                  </p>
                  <pre className="bg-muted/30 rounded-md px-3 py-2 overflow-x-auto text-foreground/70 leading-relaxed font-mono text-[11px]">
                    {JSON.stringify(input, null, 2)}
                  </pre>
                </div>
              )}
              {output !== undefined && (
                <div>
                  <p className="font-medium mb-1.5 text-muted-foreground/40 text-[10px] uppercase tracking-wider">
                    Output
                  </p>
                  <pre className="bg-muted/30 rounded-md px-3 py-2 overflow-x-auto text-foreground/70 leading-relaxed font-mono text-[11px] max-h-[400px] overflow-y-auto">
                    {showFullOutput ? fullOutputText : truncatedOutput}
                  </pre>
                  {isOutputTruncated && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setShowFullOutput(!showFullOutput)
                      }}
                      className="text-[10px] text-primary/70 hover:text-primary mt-1.5 transition-colors"
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
