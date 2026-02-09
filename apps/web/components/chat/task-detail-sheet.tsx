'use client'

import { useMemo } from 'react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  cn,
} from '@ship/ui'
import type { UIMessage, ToolInvocation } from '@/lib/ai-elements-adapter'

interface TaskTodo {
  id: string
  content: string
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled'
  priority: 'high' | 'medium' | 'low'
}

interface TaskDetailSheetProps {
  isOpen: boolean
  onClose: () => void
  todo: TaskTodo | null
  messages: UIMessage[]
}

// ============ Helpers ============

const statusLabels: Record<string, string> = {
  pending: 'Pending',
  in_progress: 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

const statusColors: Record<string, string> = {
  pending: 'text-muted-foreground bg-muted/50',
  in_progress: 'text-primary bg-primary/10',
  completed: 'text-green-600 bg-green-500/10',
  cancelled: 'text-red-600 bg-red-500/10',
}

const priorityLabels: Record<string, string> = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`
}

/**
 * Try to find tool invocations related to this todo by matching content.
 * In opencode, 'task' tool calls create subagent sessions. We look for
 * tool invocations whose name includes 'task' or 'agent', or whose
 * args contain text similar to the todo content.
 */
function findRelatedTools(todo: TaskTodo, messages: UIMessage[]): ToolInvocation[] {
  const todoLower = todo.content.toLowerCase()
  const related: ToolInvocation[] = []

  for (const msg of messages) {
    if (!msg.toolInvocations) continue
    for (const tool of msg.toolInvocations) {
      const toolNameLower = tool.toolName.toLowerCase()

      // Match 'task' or 'agent' tool calls
      if (toolNameLower.includes('task') || toolNameLower.includes('agent')) {
        // Check if the args description/prompt/content matches the todo
        const argsStr = JSON.stringify(tool.args || {}).toLowerCase()
        if (argsStr.includes(todoLower.slice(0, 30)) || todoLower.includes(toolNameLower)) {
          related.push(tool)
          continue
        }
        // Also just include all task tools if we haven't found specific matches
        related.push(tool)
      }
    }
  }

  return related
}

/**
 * Collect all active tool invocations from messages (currently running tools)
 */
function getActiveTools(messages: UIMessage[]): ToolInvocation[] {
  const tools: ToolInvocation[] = []
  for (const msg of messages) {
    if (!msg.toolInvocations) continue
    for (const tool of msg.toolInvocations) {
      if (tool.state === 'call' || tool.state === 'partial-call') {
        tools.push(tool)
      }
    }
  }
  return tools
}

/**
 * Get recent completed tools from messages
 */
function getRecentTools(messages: UIMessage[], limit = 10): ToolInvocation[] {
  const tools: ToolInvocation[] = []
  // Iterate messages in reverse for most recent
  for (let i = messages.length - 1; i >= 0 && tools.length < limit; i--) {
    const msg = messages[i]
    if (!msg.toolInvocations) continue
    for (let j = msg.toolInvocations.length - 1; j >= 0 && tools.length < limit; j--) {
      tools.push(msg.toolInvocations[j])
    }
  }
  return tools
}

// ============ Sub-Components ============

function ToolStatusDot({ state }: { state: string }) {
  return (
    <span
      className={cn(
        'w-1.5 h-1.5 rounded-full shrink-0',
        state === 'result' && 'bg-green-500',
        state === 'error' && 'bg-red-500',
        state === 'call' && 'bg-primary animate-pulse',
        state === 'partial-call' && 'bg-muted-foreground/40',
      )}
    />
  )
}

function ToolRow({ tool }: { tool: ToolInvocation }) {
  const inputSummary = useMemo(() => {
    if (!tool.args) return null
    const args = tool.args
    if (args.file_path || args.path || args.filePath) {
      const path = String(args.file_path || args.path || args.filePath || '')
      const segments = path.split('/')
      return segments.length > 3 ? '.../' + segments.slice(-3).join('/') : path
    }
    if (args.command) {
      const cmd = String(args.command)
      return cmd.length > 60 ? cmd.slice(0, 57) + '...' : cmd
    }
    if (args.pattern || args.query) {
      return String(args.pattern || args.query).slice(0, 50)
    }
    if (args.description) {
      return String(args.description).slice(0, 60)
    }
    if (args.prompt) {
      return String(args.prompt).slice(0, 60)
    }
    return null
  }, [tool.args])

  return (
    <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-muted/30 text-xs">
      <ToolStatusDot state={tool.state} />
      <span className="font-medium text-foreground/80 shrink-0">{tool.toolName}</span>
      {inputSummary && (
        <span className="text-muted-foreground/60 truncate font-mono text-[10px]">{inputSummary}</span>
      )}
      {tool.duration !== undefined && (
        <span className="text-muted-foreground/40 ml-auto shrink-0 text-[10px]">
          {formatDuration(tool.duration)}
        </span>
      )}
    </div>
  )
}

// ============ Main Component ============

export function TaskDetailSheet({ isOpen, onClose, todo, messages }: TaskDetailSheetProps) {
  const relatedTools = useMemo(
    () => (todo ? findRelatedTools(todo, messages) : []),
    [todo, messages],
  )
  const activeTools = useMemo(() => getActiveTools(messages), [messages])
  const recentTools = useMemo(() => getRecentTools(messages, 8), [messages])

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-[90vw] sm:w-[480px] sm:max-w-[480px] p-0 overflow-y-auto">
        <SheetHeader className="px-5 py-4 border-b border-border/30">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
              <rect x="14" y="14" width="7" height="7" rx="1" />
            </svg>
            <SheetTitle className="text-sm">Task Details</SheetTitle>
          </div>
          <SheetDescription className="text-xs text-muted-foreground/60">
            {todo ? 'View task progress and related tool activity' : 'No task selected'}
          </SheetDescription>
        </SheetHeader>

        <div className="p-5 space-y-5">
          {todo ? (
            <>
              {/* Task Info */}
              <div className="space-y-3">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground/50 font-medium mb-1">Task</p>
                  <p className="text-sm text-foreground leading-relaxed">{todo.content}</p>
                </div>

                <div className="flex items-center gap-2">
                  <span className={cn('text-[10px] font-medium px-2 py-0.5 rounded-full', statusColors[todo.status])}>
                    {statusLabels[todo.status]}
                  </span>
                  {todo.priority !== 'medium' && (
                    <span className="text-[10px] text-muted-foreground/50 px-2 py-0.5 rounded-full bg-muted/40">
                      {priorityLabels[todo.priority]} priority
                    </span>
                  )}
                </div>
              </div>

              {/* Related Task Tool Calls */}
              {relatedTools.length > 0 && (
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground/50 font-medium mb-2">
                    Related Task Calls ({relatedTools.length})
                  </p>
                  <div className="space-y-1">
                    {relatedTools.map((tool) => (
                      <ToolRow key={tool.toolCallId} tool={tool} />
                    ))}
                  </div>
                </div>
              )}

              {/* Active Tools */}
              {activeTools.length > 0 && (
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground/50 font-medium mb-2">
                    Currently Running ({activeTools.length})
                  </p>
                  <div className="space-y-1">
                    {activeTools.map((tool) => (
                      <ToolRow key={tool.toolCallId} tool={tool} />
                    ))}
                  </div>
                </div>
              )}

              {/* Recent Tool Activity */}
              {recentTools.length > 0 && (
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground/50 font-medium mb-2">
                    Recent Activity ({recentTools.length})
                  </p>
                  <div className="space-y-1">
                    {recentTools.map((tool) => (
                      <ToolRow key={tool.toolCallId} tool={tool} />
                    ))}
                  </div>
                </div>
              )}

              {/* Empty state if no tools at all */}
              {relatedTools.length === 0 && activeTools.length === 0 && recentTools.length === 0 && (
                <div className="text-center py-6 text-muted-foreground/50 text-xs">
                  No tool activity recorded yet for this task.
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-8 text-muted-foreground/50 text-sm">
              Select a task to view its details.
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
