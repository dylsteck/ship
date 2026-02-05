'use client'

import * as React from 'react'
import { useState, useMemo } from 'react'
import {
  Card,
  CardContent,
  Badge,
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
  ScrollArea,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@ship/ui'
import { cn } from '@ship/ui/utils'
import type { ToolState } from '@/lib/sse-types'

// Tool icon mapping based on tool name - using Lucide-style icons
const TOOL_ICONS: Record<string, string> = {
  read: '▸',
  Read: '▸',
  write: '✎',
  Write: '✎',
  edit: '✎',
  Edit: '✎',
  bash: '$',
  Bash: '$',
  shell: '$',
  glob: '⌘',
  Glob: '⌘',
  grep: '⌘',
  Grep: '⌘',
  webfetch: '↓',
  websearch: '⌘',
  codesearch: '⌘',
  default: '•',
}

// Clean status indicators
const STATUS_CONFIG: Record<ToolState['status'], { color: string; label: string; dot: string }> = {
  pending: { color: 'text-muted-foreground', label: 'Pending', dot: '○' },
  running: { color: 'text-blue-500', label: 'Running', dot: '◐' },
  completed: { color: 'text-green-500', label: 'Done', dot: '✓' },
  error: { color: 'text-red-500', label: 'Error', dot: '✕' },
}

interface ToolCardProps {
  id: string
  tool: string
  state: ToolState
  className?: string
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  return `${(ms / 60000).toFixed(1)}m`
}

function getToolIcon(toolName: string): string {
  if (TOOL_ICONS[toolName]) return TOOL_ICONS[toolName]
  const lowerName = toolName.toLowerCase()
  for (const [key, icon] of Object.entries(TOOL_ICONS)) {
    if (lowerName.includes(key.toLowerCase())) return icon
  }
  return TOOL_ICONS.default
}

// Animated spinner for running state
function LoadingSpinner() {
  return (
    <svg
      className="animate-spin h-3 w-3 text-blue-500"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      ></path>
    </svg>
  )
}

function CopyButton({ content }: { content: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await navigator.clipboard.writeText(content)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  return (
    <Tooltip>
      <TooltipTrigger
        onClick={handleCopy}
        className="h-6 w-6 inline-flex items-center justify-center rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
      >
        {copied ? <span className="text-green-500 text-xs">✓</span> : <span className="text-xs">⎘</span>}
      </TooltipTrigger>
      <TooltipContent>{copied ? 'Copied!' : 'Copy'}</TooltipContent>
    </Tooltip>
  )
}

// Format tool input for display
function formatToolInput(tool: string, input: Record<string, unknown>): string {
  const name = tool.toLowerCase()

  if (name.includes('bash') || name.includes('shell')) {
    return `$ ${input.command || ''}`
  }

  if (name.includes('read')) {
    const path = input.filePath || input.path
    return `Reading: ${path}`
  }

  if (name.includes('write') || name.includes('edit')) {
    const path = input.filePath || input.path
    return `Writing: ${path}`
  }

  if (name.includes('glob')) {
    return `Finding: ${input.pattern}`
  }

  if (name.includes('grep')) {
    return `Searching: "${input.pattern}"`
  }

  return JSON.stringify(input, null, 2)
}

export function ToolCard({ id, tool, state, className }: ToolCardProps) {
  const [isOpen, setIsOpen] = useState(state.status === 'running')

  const statusConfig = STATUS_CONFIG[state.status]
  const icon = getToolIcon(tool)

  // Calculate duration
  const duration = useMemo(() => {
    if (!state.time?.start) return null
    const endTime = state.time.end || Date.now()
    return endTime - state.time.start
  }, [state.time])

  // Format input for display
  const displayInput = useMemo(() => {
    if (!state.input) return null
    return formatToolInput(tool, state.input)
  }, [state.input, tool])

  // Format output
  const displayOutput = useMemo(() => {
    if (!state.output) return null
    return state.output
  }, [state.output])

  const hasContent = displayInput || displayOutput
  const isRunning = state.status === 'running'

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className={cn('border-0 shadow-none bg-transparent overflow-hidden', className)}>
        <CollapsibleTrigger className="w-full group">
          <div
            className={cn(
              'flex items-center gap-3 py-2 px-3 rounded-lg transition-all cursor-pointer',
              'hover:bg-muted/50',
              isRunning && 'bg-blue-500/5',
              state.status === 'error' && 'bg-red-500/5',
            )}
          >
            {/* Status indicator */}
            <div className="flex-shrink-0 w-5 flex justify-center">
              {isRunning ? (
                <LoadingSpinner />
              ) : (
                <span className={cn('text-xs', statusConfig.color)}>{statusConfig.dot}</span>
              )}
            </div>

            {/* Icon */}
            <div className="flex-shrink-0 w-4 text-center text-muted-foreground font-mono text-sm">{icon}</div>

            {/* Title */}
            <div className="flex-1 min-w-0 text-left">
              <span
                className={cn(
                  'text-sm truncate block',
                  isRunning ? 'text-blue-600 dark:text-blue-400' : 'text-foreground',
                )}
              >
                {state.title || tool}
              </span>
            </div>

            {/* Duration */}
            {duration !== null && state.status !== 'pending' && (
              <span className="text-xs text-muted-foreground font-mono tabular-nums">{formatDuration(duration)}</span>
            )}

            {/* Expand indicator */}
            {hasContent && (
              <span className="text-xs text-muted-foreground transition-transform group-data-[state=open]:rotate-90">
                ›
              </span>
            )}
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent>
          {hasContent && (
            <div className="pl-11 pr-3 pb-2">
              <div className="space-y-2">
                {/* Input section */}
                {displayInput && (
                  <div className="relative group/input">
                    <div className="absolute right-1.5 top-1.5 opacity-0 group-hover/input:opacity-100 transition-opacity">
                      <CopyButton content={displayInput} />
                    </div>
                    <ScrollArea className="max-h-[150px]">
                      <pre className="text-xs font-mono text-muted-foreground bg-muted/30 rounded px-3 py-2 whitespace-pre-wrap break-all">
                        {displayInput}
                      </pre>
                    </ScrollArea>
                  </div>
                )}

                {/* Output section */}
                {displayOutput && (
                  <div className="relative group/output">
                    <div className="absolute right-1.5 top-1.5 opacity-0 group-hover/output:opacity-100 transition-opacity">
                      <CopyButton content={displayOutput} />
                    </div>
                    <ScrollArea className="max-h-[200px]">
                      <pre
                        className={cn(
                          'text-xs font-mono rounded px-3 py-2 whitespace-pre-wrap break-all',
                          state.status === 'error'
                            ? 'bg-red-500/10 text-red-600 dark:text-red-400'
                            : 'bg-muted/50 text-foreground',
                        )}
                      >
                        {displayOutput}
                      </pre>
                    </ScrollArea>
                  </div>
                )}
              </div>
            </div>
          )}
        </CollapsibleContent>
      </Card>
    </Collapsible>
  )
}

export type { ToolCardProps }
