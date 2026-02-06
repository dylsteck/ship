'use client'

import { useMemo } from 'react'
import { cn } from '@ship/ui/utils'
import type { SessionInfo as SSESessionInfo } from '@/lib/sse-types'

// ============ Types ============

interface RepoInfo {
  owner: string
  name: string
  branch?: string
}

interface ModelInfo {
  id: string
  name?: string
  provider?: string
  mode?: 'build' | 'plan'
}

interface TokenInfo {
  input: number
  output: number
  reasoning: number
  cache: { read: number; write: number }
  contextLimit?: number
}

interface DiffSummary {
  filename: string
  additions: number
  deletions: number
}

interface Todo {
  id: string
  content: string
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled'
  priority: 'high' | 'medium' | 'low'
}

interface SessionPanelProps {
  sessionId: string
  repo?: RepoInfo
  model?: ModelInfo
  tokens?: TokenInfo
  cost?: number
  todos?: Todo[]
  diffs?: DiffSummary[]
  sessionInfo?: SSESessionInfo
  openCodeUrl?: string
  className?: string
}

// ============ Section Component ============

function PanelSection({
  label,
  children,
  className,
}: {
  label: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('px-4 py-3 border-b border-border/30', className)}>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-medium mb-1.5">
        {label}
      </div>
      {children}
    </div>
  )
}

// ============ Main Component ============

export function SessionPanel({
  sessionId,
  repo,
  model,
  tokens,
  cost,
  todos,
  diffs,
  sessionInfo,
  openCodeUrl,
  className,
}: SessionPanelProps) {
  const totalChanges = useMemo(() => {
    if (!diffs || diffs.length === 0) return null
    return diffs.reduce(
      (acc, d) => ({ add: acc.add + d.additions, del: acc.del + d.deletions }),
      { add: 0, del: 0 },
    )
  }, [diffs])

  const activeTodos = useMemo(
    () => (todos || []).filter((t) => t.status !== 'completed' && t.status !== 'cancelled'),
    [todos],
  )

  const totalTokens = tokens ? tokens.input + tokens.output + tokens.reasoning : 0
  const contextLimit = tokens?.contextLimit || 200000
  const usagePercent = tokens ? Math.min((totalTokens / contextLimit) * 100, 100) : 0

  return (
    <div className={cn('flex flex-col text-xs overflow-y-auto', className)}>
      {/* Session title */}
      {sessionInfo?.title && (
        <PanelSection label="Title">
          <div className="text-foreground font-medium truncate" title={sessionInfo.title}>
            {sessionInfo.title}
          </div>
        </PanelSection>
      )}

      {/* Repo */}
      {repo && (
        <PanelSection label="Repository">
          <div className="text-foreground font-mono text-[11px]">
            {repo.owner}/{repo.name}
          </div>
          {repo.branch && (
            <div className="text-muted-foreground mt-0.5 font-mono text-[10px]">{repo.branch}</div>
          )}
        </PanelSection>
      )}

      {/* Model */}
      {model && (
        <PanelSection label="Model">
          <div className="text-foreground text-[11px]">{model.name || model.id}</div>
          {model.mode && (
            <div className="mt-1">
              <span
                className={cn(
                  'inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium',
                  model.mode === 'build'
                    ? 'bg-green-500/10 text-green-600 dark:text-green-400'
                    : 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
                )}
              >
                {model.mode}
              </span>
            </div>
          )}
        </PanelSection>
      )}

      {/* Context usage */}
      {tokens && (
        <PanelSection label="Context">
          <div className="text-foreground text-[11px] mb-1.5">
            {usagePercent.toFixed(0)}% used
            <span className="text-muted-foreground ml-1">
              ({totalTokens.toLocaleString()} / {contextLimit.toLocaleString()})
            </span>
          </div>
          <div className="h-1.5 w-full bg-border/50 rounded-full overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all duration-500',
                usagePercent > 80 ? 'bg-red-500' : usagePercent > 60 ? 'bg-yellow-500' : 'bg-green-500',
              )}
              style={{ width: `${usagePercent}%` }}
            />
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5 text-[10px] text-muted-foreground font-mono">
            <span>in: {tokens.input.toLocaleString()}</span>
            <span>out: {tokens.output.toLocaleString()}</span>
            {tokens.reasoning > 0 && <span>think: {tokens.reasoning.toLocaleString()}</span>}
          </div>
          {(tokens.cache.read > 0 || tokens.cache.write > 0) && (
            <div className="flex gap-x-3 mt-0.5 text-[10px] font-mono">
              {tokens.cache.read > 0 && (
                <span className="text-green-500">cache-r: {tokens.cache.read.toLocaleString()}</span>
              )}
              {tokens.cache.write > 0 && (
                <span className="text-blue-500">cache-w: {tokens.cache.write.toLocaleString()}</span>
              )}
            </div>
          )}
        </PanelSection>
      )}

      {/* Cost */}
      {cost !== undefined && cost > 0 && (
        <PanelSection label="Cost">
          <div className="text-foreground font-mono text-[11px]">${cost.toFixed(4)}</div>
        </PanelSection>
      )}

      {/* OpenCode URL */}
      {openCodeUrl && (
        <PanelSection label="OpenCode">
          <div className="flex items-center gap-2">
            <a
              href={openCodeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-500 hover:text-blue-400 hover:underline break-all flex-1 min-w-0 text-[11px] font-mono"
            >
              {openCodeUrl.replace(/^https?:\/\//, '').slice(0, 40)}
              {openCodeUrl.length > 40 ? '...' : ''}
            </a>
            <button
              onClick={() => navigator.clipboard.writeText(openCodeUrl)}
              className="text-muted-foreground hover:text-foreground transition-colors text-[10px] px-1.5 py-0.5 rounded hover:bg-muted shrink-0"
              title="Copy URL"
            >
              Copy
            </button>
          </div>
        </PanelSection>
      )}

      {/* Changes */}
      {diffs && diffs.length > 0 && totalChanges && (
        <PanelSection label="Changes">
          <div className="flex gap-3 text-[11px] mb-1.5">
            <span className="text-green-500 font-medium">+{totalChanges.add}</span>
            <span className="text-red-500 font-medium">-{totalChanges.del}</span>
            <span className="text-muted-foreground">{diffs.length} files</span>
          </div>
          <div className="space-y-0.5">
            {diffs.slice(0, 8).map((d, i) => (
              <div key={i} className="flex justify-between text-[10px] text-muted-foreground font-mono">
                <span className="truncate flex-1 mr-2">{d.filename.split('/').pop()}</span>
                <span className="shrink-0">
                  <span className="text-green-500">+{d.additions}</span>
                  {' '}
                  <span className="text-red-500">-{d.deletions}</span>
                </span>
              </div>
            ))}
            {diffs.length > 8 && (
              <div className="text-[10px] text-muted-foreground">...{diffs.length - 8} more</div>
            )}
          </div>
        </PanelSection>
      )}

      {/* Todos */}
      {activeTodos.length > 0 && (
        <PanelSection label={`Todos (${activeTodos.length})`}>
          <div className="space-y-1">
            {activeTodos.slice(0, 5).map((t) => (
              <div key={t.id} className="flex items-start gap-1.5 text-[11px]">
                <span
                  className={cn(
                    'mt-0.5 w-1.5 h-1.5 rounded-full shrink-0',
                    t.status === 'in_progress' ? 'bg-blue-500' : 'bg-muted-foreground/30',
                  )}
                />
                <span className={t.status === 'in_progress' ? 'text-foreground' : 'text-muted-foreground'}>
                  {t.content.slice(0, 50)}
                </span>
              </div>
            ))}
          </div>
        </PanelSection>
      )}

      {/* Session info */}
      {sessionInfo && (
        <PanelSection label="Session">
          <div className="text-foreground font-mono text-[10px] truncate" title={sessionInfo.id}>
            {sessionInfo.id.slice(0, 12)}...
          </div>
          {sessionInfo.summary && (sessionInfo.summary.files > 0 || sessionInfo.summary.additions > 0) && (
            <div className="flex gap-3 mt-0.5 text-[10px] font-mono text-muted-foreground">
              <span>{sessionInfo.summary.files} files</span>
              <span className="text-green-500">+{sessionInfo.summary.additions}</span>
              <span className="text-red-500">-{sessionInfo.summary.deletions}</span>
            </div>
          )}
        </PanelSection>
      )}

      {/* Empty state */}
      {!repo && !model && !tokens && !activeTodos.length && !diffs?.length && !sessionInfo && !openCodeUrl && (
        <div className="px-4 py-8 text-muted-foreground text-center text-[11px]">
          Waiting for session data...
        </div>
      )}
    </div>
  )
}

// ============ Exports ============

export type { SessionPanelProps, RepoInfo, ModelInfo, TokenInfo, DiffSummary, Todo }
