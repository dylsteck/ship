'use client'

import { useState, useEffect, useRef } from 'react'
import { cn } from '@ship/ui'
import { HugeiconsIcon } from '@hugeicons/react'
import { ArrowDown01Icon, ArrowUp01Icon } from '@hugeicons/core-free-icons'

// Tool part type matching OpenCode SDK structure
export interface ToolPart {
  type: 'tool'
  callID: string
  tool: string
  state?: {
    title?: string
    status?: 'pending' | 'running' | 'complete' | 'error'
  }
  input?: unknown
  output?: unknown
}

interface ThinkingIndicatorProps {
  isThinking: boolean
  parts: ToolPart[]
  reasoning?: string
  expanded?: boolean
  onToggle?: () => void
  statusLabel?: string
}

// Map tool names to icons and display names
function getToolInfo(toolName: string): { icon: string; label: string } {
  const name = toolName.toLowerCase()

  if (name.includes('task') || name.includes('agent')) {
    return { icon: '📋', label: 'Agent' }
  }
  if (name.includes('read')) {
    return { icon: '👁', label: 'Read' }
  }
  if (name.includes('glob')) {
    return { icon: '🔍', label: 'Glob' }
  }
  if (name.includes('grep')) {
    return { icon: '🔍', label: 'Grep' }
  }
  if (name.includes('bash') || name.includes('shell') || name.includes('run')) {
    return { icon: '⚡', label: 'Bash' }
  }
  if (name.includes('write')) {
    return { icon: '✏️', label: 'Write' }
  }
  if (name.includes('edit')) {
    return { icon: '✏️', label: 'Edit' }
  }
  if (name.includes('web') || name.includes('fetch')) {
    return { icon: '🌐', label: 'WebFetch' }
  }

  return { icon: '🔧', label: formatToolName(toolName) }
}

// Format tool name for display
function formatToolName(toolName: string): string {
  // Handle MCP-style tool names like "mcp__server__tool"
  if (toolName.includes('__')) {
    const parts = toolName.split('__')
    return parts[parts.length - 1]
  }
  // Capitalize first letter
  return toolName.charAt(0).toUpperCase() + toolName.slice(1)
}

// Format elapsed time
function formatElapsedTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  if (mins > 0) {
    return `${mins}m, ${secs}s`
  }
  return `${secs}s`
}

export function ThinkingIndicator({
  isThinking,
  parts,
  reasoning,
  expanded: controlledExpanded,
  onToggle,
  statusLabel = 'Considering next steps',
}: ThinkingIndicatorProps) {
  const [internalExpanded, setInternalExpanded] = useState(true) // Start expanded by default
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [visibleParts, setVisibleParts] = useState<ToolPart[]>([])
  const startTimeRef = useRef<number | null>(null)

  // Track elapsed time when thinking
  useEffect(() => {
    if (isThinking) {
      if (!startTimeRef.current) {
        startTimeRef.current = Date.now()
      }

      const interval = setInterval(() => {
        if (startTimeRef.current) {
          setElapsedSeconds(Math.floor((Date.now() - startTimeRef.current) / 1000))
        }
      }, 1000)

      return () => clearInterval(interval)
    } else {
      // Keep the final elapsed time visible
      if (startTimeRef.current) {
        setElapsedSeconds(Math.floor((Date.now() - startTimeRef.current) / 1000))
      }
    }
  }, [isThinking])

  // Reset timer when new thinking session starts
  useEffect(() => {
    if (isThinking && parts.length === 0) {
      startTimeRef.current = Date.now()
      setElapsedSeconds(0)
      setVisibleParts([])
    }
  }, [isThinking, parts.length])

  // Animate parts appearing
  useEffect(() => {
    if (parts.length > visibleParts.length) {
      // New parts added - show them with a slight delay for animation
      const newParts = parts.slice(visibleParts.length)
      let delay = 0

      newParts.forEach((part, index) => {
        setTimeout(() => {
          setVisibleParts((prev) => [...prev, part])
        }, delay)
        delay += 150 // Stagger animations
      })
    }
  }, [parts, visibleParts.length])

  // Use controlled or internal state
  const expanded = controlledExpanded !== undefined ? controlledExpanded : internalExpanded
  const handleToggle = onToggle || (() => setInternalExpanded(!internalExpanded))

  if (!isThinking && parts.length === 0 && !reasoning) {
    return null
  }

  const hasContent = parts.length > 0 || reasoning

  // Get the most recent active part
  const activePart = parts.find((p) => p.state?.status === 'running')
  const activeToolInfo = activePart ? getToolInfo(activePart.tool) : null

  return (
    <div className="flex justify-start mb-4">
      <div className="w-full max-w-[600px]">
        {/* Header row */}
        <button
          onClick={handleToggle}
          className={cn(
            'flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm transition-colors w-full text-left',
            'hover:bg-muted/50 bg-muted/20 border border-border/30',
            expanded && hasContent && 'rounded-b-none border-b-0',
          )}
        >
          {/* Animated sparkles */}
          <span className="relative flex h-3 w-3 mr-1">
            <span
              className={cn(
                'animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75',
                !isThinking && 'hidden',
              )}
            />
            <span
              className={cn(
                'relative inline-flex rounded-full h-3 w-3',
                isThinking ? 'bg-blue-500' : 'bg-muted-foreground/50',
              )}
            />
          </span>

          {/* Status label */}
          <span className="font-medium text-foreground/90">
            {activeToolInfo ? `${activeToolInfo.label}...` : statusLabel}
          </span>

          {/* Active tool name */}
          {activePart?.state?.title && (
            <span className="text-muted-foreground truncate max-w-[200px]">{activePart.state.title}</span>
          )}

          {/* Elapsed time */}
          {(isThinking || elapsedSeconds > 0) && (
            <>
              <span className="text-muted-foreground/50">·</span>
              <span className="text-muted-foreground/70 text-xs tabular-nums">{formatElapsedTime(elapsedSeconds)}</span>
            </>
          )}

          {/* Expand/collapse arrow */}
          {hasContent && (
            <HugeiconsIcon
              icon={expanded ? ArrowUp01Icon : ArrowDown01Icon}
              strokeWidth={2}
              className="size-4 text-muted-foreground ml-auto"
            />
          )}
        </button>

        {/* Expanded content - Always show activity feed */}
        {expanded && (
          <div className="bg-muted/10 border border-t-0 border-border/30 rounded-b-xl px-3 py-3">
            {/* Live activity feed */}
            <div className="space-y-2">
              {visibleParts.length === 0 && isThinking && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground animate-pulse">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                  Initializing...
                </div>
              )}

              {visibleParts.map((part, index) => {
                const toolInfo = getToolInfo(part.tool)
                const title = part.state?.title || ''
                const isRunning = part.state?.status === 'running'
                const isComplete = part.state?.status === 'complete'
                const isError = part.state?.status === 'error'

                return (
                  <div
                    key={part.callID}
                    className={cn(
                      'flex items-center gap-2.5 text-sm p-2 rounded-lg transition-all duration-300',
                      isRunning && 'bg-blue-500/10 border border-blue-500/20',
                      isComplete && 'bg-green-500/5 border border-green-500/10 opacity-70',
                      isError && 'bg-red-500/10 border border-red-500/20',
                      !isRunning && !isComplete && !isError && 'bg-muted/30',
                    )}
                    style={{
                      animation: 'slideIn 0.3s ease-out forwards',
                      animationDelay: `${index * 50}ms`,
                    }}
                  >
                    {/* Status indicator */}
                    <span className="relative flex h-2 w-2">
                      {isRunning && (
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                      )}
                      <span
                        className={cn(
                          'relative inline-flex rounded-full h-2 w-2',
                          isRunning && 'bg-blue-500',
                          isComplete && 'bg-green-500',
                          isError && 'bg-red-500',
                          !isRunning && !isComplete && !isError && 'bg-muted-foreground/30',
                        )}
                      />
                    </span>

                    {/* Tool icon */}
                    <span className="text-base">{toolInfo.icon}</span>

                    {/* Tool info */}
                    <div className="flex-1 min-w-0">
                      <span
                        className={cn(
                          'font-medium',
                          isRunning ? 'text-blue-600 dark:text-blue-400' : 'text-foreground/80',
                        )}
                      >
                        {toolInfo.label}
                      </span>
                      {title && <span className="text-muted-foreground ml-2 truncate block text-xs">{title}</span>}
                    </div>

                    {/* Status text */}
                    <span
                      className={cn(
                        'text-xs font-medium',
                        isRunning && 'text-blue-500',
                        isComplete && 'text-green-500',
                        isError && 'text-red-500',
                      )}
                    >
                      {isRunning && 'Running'}
                      {isComplete && 'Done'}
                      {isError && 'Error'}
                    </span>
                  </div>
                )
              })}
            </div>

            {/* Reasoning text */}
            {reasoning && (
              <div className="mt-3 pt-3 border-t border-border/30">
                <p className="text-sm text-foreground/70 leading-relaxed">{reasoning}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
