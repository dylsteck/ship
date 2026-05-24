'use client'

import { cn } from '@ship/ui/utils'
import type { AgentStatus } from '@/components/session/status-indicator'

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

export function SessionSidebarStatus({
  agentStatus,
  currentTool,
}: {
  agentStatus: AgentStatus
  currentTool?: string
}) {
  return (
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
      {currentTool && <div className="text-muted-foreground truncate mt-0.5">{currentTool}</div>}
    </div>
  )
}

export function SessionSidebarMeta({
  sessionTitle,
  repoOwner,
  repoName,
  branch,
  model,
}: {
  sessionTitle?: string
  repoOwner?: string
  repoName?: string
  branch?: string
  model?: string
}) {
  return (
    <>
      {sessionTitle && (
        <div className="px-3 py-2 border-b border-border/30">
          <div className="text-muted-foreground">title</div>
          <div className="text-foreground truncate" title={sessionTitle}>{sessionTitle}</div>
        </div>
      )}
      {repoOwner && repoName && (
        <div className="px-3 py-2 border-b border-border/30">
          <div className="text-muted-foreground">repo</div>
          <div className="text-foreground">{repoOwner}/{repoName}</div>
          {branch && <div className="text-muted-foreground mt-0.5">{branch}</div>}
        </div>
      )}
      {model && (
        <div className="px-3 py-2 border-b border-border/30">
          <div className="text-muted-foreground">model</div>
          <div className="text-foreground">{model}</div>
        </div>
      )}
    </>
  )
}

export function SessionSidebarChanges({
  diffs,
  totalChanges,
}: {
  diffs: { filename: string; additions: number; deletions: number }[]
  totalChanges: { add: number; del: number }
}) {
  if (diffs.length === 0) return null

  return (
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
              <span className="text-green-500">+{d.additions}</span>{' '}
              <span className="text-red-500">-{d.deletions}</span>
            </span>
          </div>
        ))}
        {diffs.length > 8 && <div className="text-muted-foreground">...{diffs.length - 8} more</div>}
      </div>
    </div>
  )
}

export function SessionSidebarTodos({
  todos,
}: {
  todos: { id: string; content: string; status: string }[]
}) {
  if (todos.length === 0) return null

  return (
    <div className="px-3 py-2 border-b border-border/30">
      <div className="text-muted-foreground">todos ({todos.length})</div>
      <div className="mt-1 space-y-0.5">
        {todos.slice(0, 5).map((t) => (
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
  )
}
