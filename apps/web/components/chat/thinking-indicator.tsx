'use client'

import { useState, useEffect, useRef } from 'react'
import { cn } from '@ship/ui'
import { HugeiconsIcon } from '@hugeicons/react'
import { ArrowDown01Icon, ArrowUp01Icon, Copy01Icon, CheckmarkCircle01Icon } from '@hugeicons/core-free-icons'

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
  startTime?: number
  endTime?: number
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
function getToolInfo(toolName: string): { icon: string; label: string; color: string } {
  const name = toolName.toLowerCase()

  if (name.includes('task') || name.includes('agent')) {
    return { icon: '📋', label: 'Agent Task', color: 'purple' }
  }
  if (name.includes('read')) {
    return { icon: '👁', label: 'Read File', color: 'cyan' }
  }
  if (name.includes('glob')) {
    return { icon: '🔍', label: 'Find Files', color: 'yellow' }
  }
  if (name.includes('grep')) {
    return { icon: '🔎', label: 'Search Code', color: 'yellow' }
  }
  if (name.includes('bash') || name.includes('shell') || name.includes('run')) {
    return { icon: '⚡', label: 'Terminal', color: 'orange' }
  }
  if (name.includes('write')) {
    return { icon: '✏️', label: 'Write File', color: 'green' }
  }
  if (name.includes('edit')) {
    return { icon: '📝', label: 'Edit File', color: 'green' }
  }
  if (name.includes('web') || name.includes('fetch')) {
    return { icon: '🌐', label: 'Web Fetch', color: 'blue' }
  }
  if (name.includes('todo')) {
    return { icon: '📋', label: 'Todo', color: 'purple' }
  }
  if (name.includes('question')) {
    return { icon: '❓', label: 'Question', color: 'blue' }
  }

  return { icon: '🔧', label: formatToolName(toolName), color: 'gray' }
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
    return `${mins}m ${secs}s`
  }
  return `${secs}s`
}

// Format tool input for display
function formatToolInput(tool: string, input: unknown): { label: string; detail?: string; code?: string } {
  if (!input || typeof input !== 'object') {
    return { label: 'Input', code: JSON.stringify(input, null, 2) }
  }

  const inp = input as Record<string, unknown>
  const toolName = tool.toLowerCase()

  // Bash/shell commands
  if (toolName.includes('bash') || toolName.includes('shell') || toolName.includes('run')) {
    const command = inp.command as string
    const description = inp.description as string
    return {
      label: description || 'Command',
      code: `$ ${command}`,
    }
  }

  // Read file
  if (toolName.includes('read')) {
    const filePath = (inp.filePath as string) || (inp.path as string)
    return {
      label: 'Reading file',
      detail: filePath,
    }
  }

  // Glob/find files
  if (toolName.includes('glob')) {
    const pattern = inp.pattern as string
    const path = inp.path as string
    return {
      label: 'Finding files',
      detail: `${pattern}${path ? ` in ${path}` : ''}`,
    }
  }

  // Grep/search
  if (toolName.includes('grep')) {
    const pattern = inp.pattern as string
    const include = inp.include as string
    return {
      label: 'Searching for',
      detail: `"${pattern}"${include ? ` in ${include}` : ''}`,
    }
  }

  // Write file
  if (toolName.includes('write')) {
    const filePath = (inp.filePath as string) || (inp.path as string)
    return {
      label: 'Writing file',
      detail: filePath,
    }
  }

  // Edit file
  if (toolName.includes('edit')) {
    const filePath = (inp.filePath as string) || (inp.path as string)
    const oldString = inp.oldString as string
    const newString = inp.newString as string
    return {
      label: 'Editing file',
      detail: filePath,
      code: oldString && newString ? `- ${oldString.slice(0, 50)}...\n+ ${newString.slice(0, 50)}...` : undefined,
    }
  }

  // Task/agent
  if (toolName.includes('task') || toolName.includes('agent')) {
    const description = (inp.description as string) || (inp.prompt as string)
    return {
      label: 'Delegating task',
      detail: description?.slice(0, 100),
    }
  }

  // Todo write
  if (toolName.includes('todo')) {
    const todos = inp.todos as Array<{ content: string }> | undefined
    if (todos?.length) {
      return {
        label: `Creating ${todos.length} task(s)`,
        detail: todos[0]?.content?.slice(0, 50),
      }
    }
  }

  // Default: show as JSON
  return {
    label: 'Input',
    code: JSON.stringify(input, null, 2),
  }
}

// Format tool output for display
function formatToolOutput(tool: string, output: unknown): { summary?: string; code?: string; isError?: boolean } {
  if (output === undefined || output === null) {
    return {}
  }

  const toolName = tool.toLowerCase()

  // String output
  if (typeof output === 'string') {
    // Truncate very long outputs
    const truncated = output.length > 2000 ? output.slice(0, 2000) + '\n... (truncated)' : output

    // Check if it looks like an error
    const isError = output.toLowerCase().includes('error') || output.toLowerCase().includes('failed')

    return {
      code: truncated,
      isError,
    }
  }

  // Array output (file lists, search results)
  if (Array.isArray(output)) {
    if (output.length === 0) {
      return { summary: 'No results' }
    }

    // File list
    if (typeof output[0] === 'string') {
      return {
        summary: `${output.length} file(s) found`,
        code: output.slice(0, 20).join('\n') + (output.length > 20 ? `\n... and ${output.length - 20} more` : ''),
      }
    }

    return {
      summary: `${output.length} result(s)`,
      code: JSON.stringify(output.slice(0, 10), null, 2),
    }
  }

  // Object output
  if (typeof output === 'object') {
    const out = output as Record<string, unknown>

    // Error object
    if (out.error) {
      return {
        summary: 'Error',
        code: String(out.error),
        isError: true,
      }
    }

    return {
      code: JSON.stringify(output, null, 2).slice(0, 1000),
    }
  }

  return {
    code: String(output),
  }
}

// Collapsible tool detail component
function ToolDetail({ part, isExpanded, onToggle }: { part: ToolPart; isExpanded: boolean; onToggle: () => void }) {
  const [copied, setCopied] = useState(false)
  // Ensure tool name is always a string
  const safeTool = typeof part.tool === 'string' ? part.tool : 'unknown'
  const toolInfo = getToolInfo(safeTool)
  // Ensure title is always a string (never an object)
  const rawTitle = part.state?.title
  const title = typeof rawTitle === 'string' ? rawTitle : ''
  const isRunning = part.state?.status === 'running'
  const isComplete = part.state?.status === 'complete'
  const isError = part.state?.status === 'error'

  const inputInfo = formatToolInput(safeTool, part.input)
  const outputInfo = formatToolOutput(safeTool, part.output)

  const hasDetails = inputInfo.code || inputInfo.detail || outputInfo.code || outputInfo.summary

  const handleCopy = async (text: string) => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div
      className={cn(
        'rounded-lg transition-all duration-200 overflow-hidden',
        isRunning && 'bg-blue-500/10 border border-blue-500/20',
        isComplete && 'bg-green-500/5 border border-green-500/10',
        isError && 'bg-red-500/10 border border-red-500/20',
        !isRunning && !isComplete && !isError && 'bg-muted/30 border border-transparent',
      )}
    >
      {/* Tool header - always visible */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2.5 text-sm p-2.5 text-left hover:bg-white/5 transition-colors"
      >
        {/* Status indicator */}
        <span className="relative flex h-2 w-2 flex-shrink-0">
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
        <span className="text-base flex-shrink-0">{toolInfo.icon}</span>

        {/* Tool info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={cn('font-medium', isRunning ? 'text-blue-600 dark:text-blue-400' : 'text-foreground/80')}>
              {toolInfo.label}
            </span>
            {inputInfo.detail && (
              <span className="text-muted-foreground text-xs truncate max-w-[200px]">{inputInfo.detail}</span>
            )}
          </div>
          {title && title !== inputInfo.detail && (
            <span className="text-muted-foreground truncate block text-xs mt-0.5">{title}</span>
          )}
        </div>

        {/* Status + expand arrow */}
        <div className="flex items-center gap-2 flex-shrink-0">
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
          {hasDetails && (
            <HugeiconsIcon
              icon={isExpanded ? ArrowUp01Icon : ArrowDown01Icon}
              strokeWidth={2}
              className="size-3.5 text-muted-foreground"
            />
          )}
        </div>
      </button>

      {/* Expanded details */}
      {isExpanded && hasDetails && (
        <div className="px-2.5 pb-2.5 space-y-2">
          {/* Input section */}
          {(inputInfo.code || inputInfo.detail) && (
            <div className="rounded-md bg-black/20 dark:bg-black/40 overflow-hidden">
              <div className="flex items-center justify-between px-2 py-1 bg-black/10 text-xs text-muted-foreground">
                <span>{inputInfo.label}</span>
                {inputInfo.code && (
                  <button
                    onClick={() => handleCopy(inputInfo.code!)}
                    className="p-1 hover:bg-white/10 rounded transition-colors"
                  >
                    <HugeiconsIcon
                      icon={copied ? CheckmarkCircle01Icon : Copy01Icon}
                      strokeWidth={2}
                      className="size-3"
                    />
                  </button>
                )}
              </div>
              {inputInfo.code && (
                <pre className="p-2 text-xs font-mono text-foreground/80 overflow-x-auto whitespace-pre-wrap break-all">
                  {inputInfo.code}
                </pre>
              )}
            </div>
          )}

          {/* Output section */}
          {(outputInfo.code || outputInfo.summary) && (
            <div
              className={cn(
                'rounded-md overflow-hidden',
                outputInfo.isError ? 'bg-red-500/10' : 'bg-black/20 dark:bg-black/40',
              )}
            >
              <div className="flex items-center justify-between px-2 py-1 bg-black/10 text-xs text-muted-foreground">
                <span>{outputInfo.summary || 'Output'}</span>
                {outputInfo.code && (
                  <button
                    onClick={() => handleCopy(outputInfo.code!)}
                    className="p-1 hover:bg-white/10 rounded transition-colors"
                  >
                    <HugeiconsIcon
                      icon={copied ? CheckmarkCircle01Icon : Copy01Icon}
                      strokeWidth={2}
                      className="size-3"
                    />
                  </button>
                )}
              </div>
              {outputInfo.code && (
                <pre
                  className={cn(
                    'p-2 text-xs font-mono overflow-x-auto whitespace-pre-wrap break-all max-h-[300px] overflow-y-auto',
                    outputInfo.isError ? 'text-red-400' : 'text-foreground/80',
                  )}
                >
                  {outputInfo.code}
                </pre>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function ThinkingIndicator({
  isThinking,
  parts,
  reasoning,
  expanded: controlledExpanded,
  onToggle,
  statusLabel = 'Considering next steps',
}: ThinkingIndicatorProps) {
  const [internalExpanded, setInternalExpanded] = useState(true)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [visibleParts, setVisibleParts] = useState<ToolPart[]>([])
  const [expandedParts, setExpandedParts] = useState<Set<string>>(new Set())
  const startTimeRef = useRef<number | null>(null)

  // Ensure statusLabel is always a string (safety check)
  const safeStatusLabel = typeof statusLabel === 'string' ? statusLabel : 'Processing...'
  // Ensure reasoning is always a string
  const safeReasoning = typeof reasoning === 'string' ? reasoning : ''

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
      if (startTimeRef.current) {
        setElapsedSeconds(Math.floor((Date.now() - startTimeRef.current) / 1000))
      }
    }
  }, [isThinking])

  // Reset timer when new thinking session starts
  useEffect(() => {
    if (isThinking && parts.length === 0 && !safeStatusLabel.includes('Processing')) {
      startTimeRef.current = Date.now()
      setElapsedSeconds(0)
      setVisibleParts([])
      setExpandedParts(new Set())
    }
  }, [isThinking, parts.length, safeStatusLabel])

  // Sync visible parts with actual parts
  useEffect(() => {
    setVisibleParts(parts)
  }, [parts])

  // Auto-expand running tools
  useEffect(() => {
    const runningPart = parts.find((p) => p.state?.status === 'running')
    if (runningPart) {
      setExpandedParts((prev) => new Set([...prev, runningPart.callID]))
    }
  }, [parts])

  // Use controlled or internal state
  const expanded = controlledExpanded !== undefined ? controlledExpanded : internalExpanded
  const handleToggle = onToggle || (() => setInternalExpanded(!internalExpanded))

  // Don't render if nothing to show
  if (!isThinking && parts.length === 0 && !safeReasoning && !safeStatusLabel) {
    return null
  }

  const hasContent = parts.length > 0 || safeReasoning
  const showHeader = isThinking || hasContent

  // Get the most recent active part
  const activePart = parts.find((p) => p.state?.status === 'running')
  const activeToolInfo = activePart ? getToolInfo(activePart.tool) : null

  const togglePartExpanded = (callID: string) => {
    setExpandedParts((prev) => {
      const next = new Set(prev)
      if (next.has(callID)) {
        next.delete(callID)
      } else {
        next.add(callID)
      }
      return next
    })
  }

  return (
    <div className="flex justify-start mb-4">
      <div className="w-full max-w-[700px]">
        {/* Header row */}
        {showHeader && (
          <button
            onClick={handleToggle}
            className={cn(
              'flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm transition-colors w-full text-left',
              'hover:bg-muted/50 bg-muted/20 border border-border/30',
              expanded && hasContent && 'rounded-b-none border-b-0',
            )}
          >
            {/* Animated indicator */}
            <span className="relative flex h-3 w-3 mr-1">
              <span
                className={cn(
                  'animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75',
                  !isThinking && 'hidden',
                )}
              />
              <span
                className={cn('relative inline-flex rounded-full h-3 w-3', isThinking ? 'bg-blue-500' : 'bg-green-500')}
              />
            </span>

            {/* Status label */}
            <span className="font-medium text-foreground/90 flex-1">
              {activeToolInfo ? `${activeToolInfo.icon} ${activeToolInfo.label}...` : safeStatusLabel}
            </span>

            {/* Active tool title */}
            {activePart?.state?.title && (
              <span className="text-muted-foreground truncate max-w-[200px] text-xs">{activePart.state.title}</span>
            )}

            {/* Elapsed time */}
            {(isThinking || elapsedSeconds > 0) && (
              <>
                <span className="text-muted-foreground/50">·</span>
                <span className="text-muted-foreground/70 text-xs tabular-nums">
                  {formatElapsedTime(elapsedSeconds)}
                </span>
              </>
            )}

            {/* Expand/collapse arrow */}
            {hasContent && (
              <HugeiconsIcon
                icon={expanded ? ArrowUp01Icon : ArrowDown01Icon}
                strokeWidth={2}
                className="size-4 text-muted-foreground ml-2"
              />
            )}
          </button>
        )}

        {/* Expanded content */}
        {expanded && (
          <div
            className={cn(
              'bg-muted/10 border border-border/30 px-3 py-3',
              showHeader && hasContent ? 'border-t-0 rounded-b-xl' : 'rounded-xl',
            )}
          >
            {/* Live activity feed */}
            <div className="space-y-2">
              {visibleParts.length === 0 && isThinking && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                  <span className="animate-pulse">{safeStatusLabel || 'Initializing...'}</span>
                </div>
              )}

              {visibleParts.map((part) => (
                <ToolDetail
                  key={part.callID}
                  part={part}
                  isExpanded={expandedParts.has(part.callID)}
                  onToggle={() => togglePartExpanded(part.callID)}
                />
              ))}
            </div>

            {/* Reasoning text */}
            {safeReasoning && (
              <div className="mt-3 pt-3 border-t border-border/30">
                <div className="text-xs text-muted-foreground mb-1">💭 Reasoning</div>
                <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">{safeReasoning}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
