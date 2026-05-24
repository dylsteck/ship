'use client'

import { useMemo } from 'react'
import { cn } from '@ship/ui/utils'
import type { AgentStatus } from '@/components/session/status-indicator'
import {
  SessionSidebarStatus,
  SessionSidebarMeta,
  SessionSidebarChanges,
  SessionSidebarTodos,
} from './session-sidebar-sections'

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

const EMPTY_TODOS: { id: string; content: string; status: 'pending' | 'in_progress' | 'completed' | 'cancelled' }[] = []
const EMPTY_DIFFS: { filename: string; additions: number; deletions: number }[] = []

function SessionSidebarSandbox({
  sandboxStatus,
  opencodeUrl,
  opencodeSessionId,
}: {
  sandboxStatus: SessionSidebarProps['sandboxStatus']
  opencodeUrl: string | null
  opencodeSessionId: string | null
}) {
  return (
    <>
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
      {opencodeSessionId && (
        <div className="px-3 py-2 border-b border-border/30">
          <div className="text-muted-foreground">session</div>
          <div className="text-foreground truncate" title={opencodeSessionId}>
            {opencodeSessionId.replace('ses_', '').slice(0, 12)}...
          </div>
        </div>
      )}
    </>
  )
}

export function SessionSidebar({
  sessionInfo,
  agentStatus,
  currentTool,
  sandboxStatus,
  opencodeUrl,
  opencodeSessionId,
  sessionTitle,
  className,
}: SessionSidebarProps) {
  const totalChanges = useMemo(
    () => EMPTY_DIFFS.reduce((acc, d) => ({ add: acc.add + d.additions, del: acc.del + d.deletions }), { add: 0, del: 0 }),
    [],
  )
  const activeTodos = useMemo(
    () => EMPTY_TODOS.filter((t) => t.status !== 'completed' && t.status !== 'cancelled'),
    [],
  )

  return (
    <aside className={cn('w-60 border-l border-border/40 bg-background flex flex-col text-xs font-mono overflow-y-auto', className)}>
      <SessionSidebarStatus agentStatus={agentStatus} currentTool={currentTool} />
      <SessionSidebarMeta
        sessionTitle={sessionTitle}
        repoOwner={sessionInfo.repoOwner}
        repoName={sessionInfo.repoName}
        branch={sessionInfo.branch}
        model={sessionInfo.model}
      />
      <SessionSidebarSandbox
        sandboxStatus={sandboxStatus}
        opencodeUrl={opencodeUrl}
        opencodeSessionId={opencodeSessionId}
      />
      <SessionSidebarChanges diffs={EMPTY_DIFFS} totalChanges={totalChanges} />
      <SessionSidebarTodos todos={activeTodos} />
      {!opencodeUrl && sandboxStatus === 'none' && !sessionInfo.repoOwner && (
        <div className="px-3 py-4 text-muted-foreground text-center">waiting for session...</div>
      )}
    </aside>
  )
}
