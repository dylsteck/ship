'use client'

import { useEffect, useState, useMemo } from 'react'
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
  sessionTitle?: string
  className?: string
}

interface Todo {
  id: string
  content: string
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled'
}

interface DiffSummary {
  filename: string
  additions: number
  deletions: number
}

const statusLabels: Record<AgentStatus, string> = {
  idle: 'idle',
  planning: 'planning',
  coding: 'coding',
  testing: 'testing',
  executing: 'running',
  stuck: 'stuck',
  waiting: 'waiting',
  error: 'error',
}

const statusColors: Record<AgentStatus, string> = {
  idle: 'text-muted-foreground',
  planning: 'text-blue-500',
  coding: 'text-green-500',
  testing: 'text-yellow-500',
  executing: 'text-orange-500',
  stuck: 'text-red-500',
  waiting: 'text-muted-foreground',
  error: 'text-red-500',
}

export function SessionSidebar({
  sessionId,
  sessionInfo,
  agentStatus,
  currentTool,
  sandboxId,
  sandboxStatus,
  opencodeUrl,
  opencodeSessionId,
  sessionTitle,
  className,
}: SessionSidebarProps) {
  const [todos, setTodos] = useState<Todo[]>([])
  const [diffs, setDiffs] = useState<DiffSummary[]>([])

  const totalChanges = useMemo(() => {
    return diffs.reduce(
      (acc, d) => ({ add: acc.add + d.additions, del: acc.del + d.deletions }),
      { add: 0, del: 0 },
    )
  }, [diffs])

  const activeTodos = useMemo(() => todos.filter((t) => t.status !== 'completed' && t.status !== 'cancelled'), [todos])

  return (
    <aside className={cn('w-60 border-l border-border/40 bg-background flex flex-col text-xs font-mono overflow-y-auto', className)}>
      {/* Status */}
      <div className="px-3 py-2 border-b border-border/30">
        <div className="flex items-center gap-1.5">
          <span className={cn('relative flex h-1.5 w-1.5', statusColors[agentStatus])}>
            {agentStatus !== 'idle' && agentStatus !== 'error' && (
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-current opacity-75" />
            )}
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-current" />
          </span>
          <span className={cn('uppercase tracking-wider', statusColors[agentStatus])}>
            {statusLabels[agentStatus]}
          </span>
        </div>
        {currentTool && (
          <div className="text-muted-foreground truncate mt-0.5">{currentTool}</div>
        )}
      </div>

      {/* Session title */}
      {sessionTitle && (
        <div className="px-3 py-2 border-b border-border/30">
          <div className="text-muted-foreground">title</div>
          <div className="text-foreground truncate" title={sessionTitle}>{sessionTitle}</div>
        </div>
      )}

      {/* Repo */}
      {sessionInfo.repoOwner && sessionInfo.repoName && (
        <div className="px-3 py-2 border-b border-border/30">
          <div className="text-muted-foreground">repo</div>
          <div className="text-foreground">
            {sessionInfo.repoOwner}/{sessionInfo.repoName}
          </div>
          {sessionInfo.branch && (
            <div className="text-muted-foreground mt-0.5">{sessionInfo.branch}</div>
          )}
        </div>
      )}

      {/* Model */}
      {sessionInfo.model && (
        <div className="px-3 py-2 border-b border-border/30">
          <div className="text-muted-foreground">model</div>
          <div className="text-foreground">{sessionInfo.model}</div>
        </div>
      )}

      {/* Sandbox */}
      {sandboxStatus !== 'none' && (
        <div className="px-3 py-2 border-b border-border/30">
          <div className="text-muted-foreground">sandbox</div>
          <div className={cn(
            'text-foreground',
            sandboxStatus === 'ready' && 'text-green-500',
            sandboxStatus === 'error' && 'text-red-500',
            sandboxStatus === 'provisioning' && 'text-yellow-500',
          )}>
            {sandboxStatus}
          </div>
        </div>
      )}

      {/* OpenCode URL */}
      {opencodeUrl && (
        <div className="px-3 py-2 border-b border-border/30">
          <div className="text-muted-foreground">opencode</div>
          <a
            href={opencodeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 hover:text-blue-400 hover:underline break-all"
          >
            open in browser
          </a>
        </div>
      )}

      {/* Session ID */}
      {opencodeSessionId && (
        <div className="px-3 py-2 border-b border-border/30">
          <div className="text-muted-foreground">session</div>
          <div className="text-foreground truncate" title={opencodeSessionId}>
            {opencodeSessionId.replace('ses_', '').slice(0, 12)}...
          </div>
        </div>
      )}

      {/* Changes */}
      {diffs.length > 0 && (
        <div className="px-3 py-2 border-b border-border/30">
          <div className="text-muted-foreground">changes</div>
          <div className="flex gap-2">
            <span className="text-green-500">+{totalChanges.add}</span>
            <span className="text-red-500">-{totalChanges.del}</span>
            <span className="text-muted-foreground">{diffs.length} files</span>
          </div>
          <div className="mt-1 space-y-0.5">
            {diffs.slice(0, 8).map((d, i) => (
              <div key={i} className="flex justify-between text-muted-foreground">
                <span className="truncate flex-1 mr-1">{(d.filename || '').split('/').pop() || 'unknown'}</span>
                <span className="shrink-0">
                  <span className="text-green-500">+{d.additions}</span>
                  {' '}
                  <span className="text-red-500">-{d.deletions}</span>
                </span>
              </div>
            ))}
            {diffs.length > 8 && (
              <div className="text-muted-foreground">...{diffs.length - 8} more</div>
            )}
          </div>
        </div>
      )}

      {/* Todos */}
      {activeTodos.length > 0 && (
        <div className="px-3 py-2 border-b border-border/30">
          <div className="text-muted-foreground">todos ({activeTodos.length})</div>
          <div className="mt-1 space-y-0.5">
            {activeTodos.slice(0, 5).map((t) => (
              <div key={t.id} className="flex items-start gap-1">
                <span className={t.status === 'in_progress' ? 'text-blue-500' : 'text-muted-foreground'}>
                  {t.status === 'in_progress' ? '>' : '-'}
                </span>
                <span className={t.status === 'in_progress' ? 'text-foreground' : 'text-muted-foreground'}>
                  {t.content.slice(0, 40)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!opencodeUrl && sandboxStatus === 'none' && !sessionInfo.repoOwner && (
        <div className="px-3 py-4 text-muted-foreground text-center">
          waiting for session...
        </div>
      )}
    </aside>
  )
}
