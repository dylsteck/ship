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
  const [internalExpanded, setInternalExpanded] = useState(false)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
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
    }
  }, [isThinking, parts.length])

  // Use controlled or internal state
  const expanded = controlledExpanded !== undefined ? controlledExpanded : internalExpanded
  const handleToggle = onToggle || (() => setInternalExpanded(!internalExpanded))

  if (!isThinking && parts.length === 0 && !reasoning) {
    return null
  }

  const hasContent = parts.length > 0 || reasoning

  return (
    <div className="flex justify-start mb-4">
      <div className="w-full max-w-[600px]">
        {/* Header row */}
        <button
          onClick={handleToggle}
          className={cn(
            'flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors w-full text-left',
            'hover:bg-muted/50',
            expanded && hasContent && 'rounded-b-none bg-muted/30'
          )}
        >
          {/* Sparkle indicator */}
          <span
            className={cn(
              'text-base',
              isThinking && 'animate-pulse'
            )}
          >
            ✦
          </span>

          {/* Status label */}
          <span className="text-muted-foreground">
            {statusLabel}
          </span>

          {/* Elapsed time */}
          {(isThinking || elapsedSeconds > 0) && (
            <>
              <span className="text-muted-foreground/50">·</span>
              <span className="text-muted-foreground/70 text-xs">
                {formatElapsedTime(elapsedSeconds)}
              </span>
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

        {/* Expanded content */}
        {expanded && hasContent && (
          <div className="bg-muted/20 border border-t-0 border-border/40 rounded-b-lg px-4 py-3 space-y-3">
            {/* Reasoning text */}
            {reasoning && (
              <p className="text-sm text-foreground/80 leading-relaxed">
                {reasoning}
              </p>
            )}

            {/* Tool calls list */}
            {parts.length > 0 && (
              <div className="space-y-1.5">
                {parts.map((part) => {
                  const toolInfo = getToolInfo(part.tool)
                  const title = part.state?.title || ''

                  return (
                    <div
                      key={part.callID}
                      className="flex items-start gap-2 text-sm"
                    >
                      {/* Tool icon */}
                      <span className="text-muted-foreground/70 mt-0.5">
                        {toolInfo.icon}
                      </span>

                      {/* Tool name + description */}
                      <div className="flex-1 min-w-0">
                        <span className="font-medium text-foreground/70">
                          {toolInfo.label}
                        </span>
                        {title && (
                          <span className="text-muted-foreground ml-2 truncate">
                            {title}
                          </span>
                        )}
                      </div>

                      {/* Status indicator */}
                      {part.state?.status === 'running' && (
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse mt-2" />
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
