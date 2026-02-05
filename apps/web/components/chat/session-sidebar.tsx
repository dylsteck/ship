'use client'

import * as React from 'react'
import { useEffect, useState, useMemo } from 'react'
import {
  Badge,
  ScrollArea,
  Separator,
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  Task,
  Loader,
} from '@ship/ui'
import { cn } from '@ship/ui/utils'
import type { AgentStatus } from '@/components/session/status-indicator'

interface SessionSidebarProps {
  sessionId: string
  sessionInfo: {
    repoOwner: string
    repoName: string
    branch?: string
    model?: string
  }
  agentStatus: AgentStatus
  currentTool?: string
  sandboxId: string | null
  sandboxStatus: 'provisioning' | 'ready' | 'error' | 'none'
  opencodeUrl: string | null
  opencodeSessionId: string | null
  className?: string
}

interface Todo {
  id: string
  content: string
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled'
  priority: 'high' | 'medium' | 'low'
}

interface DiffSummary {
  filename: string
  additions: number
  deletions: number
}

export function SessionSidebar({
  sessionId,
  sessionInfo,
  agentStatus,
  currentTool,
  sandboxId,
  sandboxStatus,
  opencodeUrl,
  className,
}: SessionSidebarProps) {
  const [todos, setTodos] = useState<Todo[]>([])
  const [diffs, setDiffs] = useState<DiffSummary[]>([])

  // Fetch session data (todos, diffs) via WebSocket or API
  useEffect(() => {
    // TODO: Connect to WebSocket for real-time updates
    // For now, use empty arrays
  }, [sessionId])

  // Compute total changes
  const totalChanges = useMemo(() => {
    return diffs.reduce(
      (acc, diff) => ({
        additions: acc.additions + diff.additions,
        deletions: acc.deletions + diff.deletions,
        files: acc.files + 1,
      }),
      { additions: 0, deletions: 0, files: 0 },
    )
  }, [diffs])

  // Group todos by status
  const groupedTodos = useMemo(() => {
    const pending = todos.filter((t) => t.status === 'pending' || t.status === 'in_progress')
    const completed = todos.filter((t) => t.status === 'completed')
    return { pending, completed }
  }, [todos])

  // Map agent status to display
  const getStatusDisplay = () => {
    switch (agentStatus) {
      case 'planning':
        return { label: 'Planning', color: 'text-blue-500' }
      case 'coding':
        return { label: 'Coding', color: 'text-green-500' }
      case 'executing':
        return { label: 'Executing', color: 'text-yellow-500' }
      case 'error':
        return { label: 'Error', color: 'text-red-500' }
      default:
        return { label: 'Idle', color: 'text-muted-foreground' }
    }
  }

  const statusDisplay = getStatusDisplay()

  return (
    <Sidebar side="right" className={cn('w-72 border-l', className)}>
      <SidebarHeader className="p-4 border-b">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm">Session Info</h3>
          <div className={cn('text-xs flex items-center gap-1.5', statusDisplay.color)}>
            <span className="relative flex h-2 w-2">
              {agentStatus !== 'idle' && agentStatus !== 'error' && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-current opacity-75"></span>
              )}
              <span className="relative inline-flex rounded-full h-2 w-2 bg-current"></span>
            </span>
            {statusDisplay.label}
          </div>
        </div>
        {currentTool && <p className="text-xs text-muted-foreground truncate">{currentTool}</p>}
      </SidebarHeader>

      <SidebarContent className="p-4 space-y-4">
        {/* Repository Info */}
        {sessionInfo.repoOwner && sessionInfo.repoName && (
          <SidebarGroup>
            <SidebarGroupLabel>Repository</SidebarGroupLabel>
            <SidebarGroupContent>
              <div className="text-sm font-medium">
                {sessionInfo.repoOwner}/{sessionInfo.repoName}
              </div>
              {sessionInfo.branch && (
                <Badge variant="outline" className="mt-1 text-xs">
                  {sessionInfo.branch}
                </Badge>
              )}
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* Model Info */}
        {sessionInfo.model && (
          <SidebarGroup>
            <SidebarGroupLabel>Model</SidebarGroupLabel>
            <SidebarGroupContent>
              <div className="text-sm">{sessionInfo.model}</div>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* Sandbox Status */}
        {sandboxStatus !== 'none' && (
          <SidebarGroup>
            <SidebarGroupLabel>Sandbox</SidebarGroupLabel>
            <SidebarGroupContent>
              {sandboxStatus === 'provisioning' && <Loader message="Provisioning sandbox..." />}
              {sandboxStatus === 'ready' && sandboxId && <div className="text-sm text-green-600">Ready</div>}
              {sandboxStatus === 'error' && <div className="text-sm text-red-600">Error</div>}
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* OpenCode URL */}
        {opencodeUrl && (
          <SidebarGroup>
            <SidebarGroupLabel>OpenCode</SidebarGroupLabel>
            <SidebarGroupContent>
              <a
                href={opencodeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-600 hover:underline break-all"
              >
                {opencodeUrl}
              </a>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* Tasks */}
        {todos.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>Tasks ({groupedTodos.pending.length} active)</SidebarGroupLabel>
            <SidebarGroupContent>
              <ScrollArea className="max-h-[200px]">
                <div className="space-y-1">
                  {groupedTodos.pending.map((todo) => (
                    <Task
                      key={todo.id}
                      title={todo.content}
                      status={todo.status === 'in_progress' ? 'in_progress' : 'pending'}
                    />
                  ))}
                  {groupedTodos.completed.length > 0 && (
                    <>
                      <Separator className="my-2" />
                      <div className="text-xs text-muted-foreground mb-1">
                        Completed ({groupedTodos.completed.length})
                      </div>
                      {groupedTodos.completed.slice(-3).map((todo) => (
                        <Task key={todo.id} title={todo.content} status="completed" />
                      ))}
                    </>
                  )}
                </div>
              </ScrollArea>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* File Changes */}
        {diffs.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel className="flex items-center justify-between">
              <span>Changes</span>
              <div className="flex items-center gap-1.5 text-xs font-normal">
                <span className="text-green-600">+{totalChanges.additions}</span>
                <span className="text-red-600">-{totalChanges.deletions}</span>
              </div>
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <ScrollArea className="max-h-[200px]">
                <div className="space-y-1">
                  {diffs.map((diff, idx) => (
                    <div key={idx} className="flex items-center justify-between text-xs py-0.5">
                      <span className="font-mono truncate flex-1" title={diff.filename}>
                        {diff.filename.split('/').pop()}
                      </span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-green-600">+{diff.additions}</span>
                        <span className="text-red-600">-{diff.deletions}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* Empty state */}
        {!todos.length && !diffs.length && sandboxStatus === 'none' && !opencodeUrl && (
          <div className="text-center py-8 text-muted-foreground text-sm">
            <p>No session data yet</p>
          </div>
        )}
      </SidebarContent>
    </Sidebar>
  )
}
