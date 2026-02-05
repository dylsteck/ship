'use client'

import { useState, useMemo } from 'react'
import { cn } from '@ship/ui/utils'
import type { SessionInfo as SSESessionInfo, StepFinishPart } from '@/lib/sse-types'

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
    <div className={cn('flex flex-col text-xs font-mono overflow-y-auto', className)}>
      {/* Session title */}
      {sessionInfo?.title && (
        <div className="px-3 py-2 border-b border-border/30">
          <div className="text-muted-foreground">title</div>
          <div className="text-foreground truncate" title={sessionInfo.title}>
            {sessionInfo.title}
          </div>
        </div>
      )}

      {/* Repo */}
      {repo && (
        <div className="px-3 py-2 border-b border-border/30">
          <div className="text-muted-foreground">repo</div>
          <div className="text-foreground">
            {repo.owner}/{repo.name}
          </div>
          {repo.branch && (
            <div className="text-muted-foreground mt-0.5">{repo.branch}</div>
          )}
        </div>
      )}

      {/* Model */}
      {model && (
        <div className="px-3 py-2 border-b border-border/30">
          <div className="text-muted-foreground">model</div>
          <div className="text-foreground">{model.name || model.id}</div>
          {model.mode && (
            <div className="text-muted-foreground mt-0.5">mode: {model.mode}</div>
          )}
        </div>
      )}

      {/* Context usage */}
      {tokens && (
        <div className="px-3 py-2 border-b border-border/30">
          <div className="text-muted-foreground">context</div>
          <div className="text-foreground">
            {usagePercent.toFixed(0)}% ({totalTokens.toLocaleString()} / {contextLimit.toLocaleString()})
          </div>
          <div className="mt-1 h-1 w-full bg-border/50 rounded-full overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all',
                usagePercent > 80 ? 'bg-red-500' : usagePercent > 60 ? 'bg-yellow-500' : 'bg-green-500',
              )}
              style={{ width: `${usagePercent}%` }}
            />
          </div>
          <div className="flex gap-2 mt-1 text-muted-foreground">
            <span>in:{tokens.input.toLocaleString()}</span>
            <span>out:{tokens.output.toLocaleString()}</span>
            {tokens.reasoning > 0 && <span>think:{tokens.reasoning.toLocaleString()}</span>}
          </div>
          {(tokens.cache.read > 0 || tokens.cache.write > 0) && (
            <div className="flex gap-2 mt-0.5 text-muted-foreground">
              {tokens.cache.read > 0 && (
                <span className="text-green-500">cache-r:{tokens.cache.read.toLocaleString()}</span>
              )}
              {tokens.cache.write > 0 && (
                <span className="text-blue-500">cache-w:{tokens.cache.write.toLocaleString()}</span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Cost */}
      {cost !== undefined && cost > 0 && (
        <div className="px-3 py-2 border-b border-border/30">
          <div className="text-muted-foreground">cost</div>
          <div className="text-foreground">${cost.toFixed(4)}</div>
        </div>
      )}

      {/* OpenCode URL */}
      {openCodeUrl && (
        <div className="px-3 py-2 border-b border-border/30">
          <div className="text-muted-foreground">opencode</div>
          <a
            href={openCodeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 hover:text-blue-400 hover:underline break-all"
          >
            open in browser
          </a>
        </div>
      )}

      {/* Changes */}
      {diffs && diffs.length > 0 && totalChanges && (
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
                <span className="truncate flex-1 mr-1">{d.filename.split('/').pop()}</span>
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

      {/* Session summary */}
      {sessionInfo && (
        <div className="px-3 py-2 border-b border-border/30">
          <div className="text-muted-foreground">session</div>
          <div className="text-foreground truncate" title={sessionInfo.id}>
            {sessionInfo.id.slice(0, 12)}...
          </div>
          {sessionInfo.summary && (sessionInfo.summary.files > 0 || sessionInfo.summary.additions > 0) && (
            <div className="flex gap-2 mt-0.5 text-muted-foreground">
              <span>{sessionInfo.summary.files} files</span>
              <span className="text-green-500">+{sessionInfo.summary.additions}</span>
              <span className="text-red-500">-{sessionInfo.summary.deletions}</span>
            </div>
          )}
        </div>
      )}

      {/* Empty state */}
      {!repo && !model && !tokens && !activeTodos.length && !diffs?.length && !sessionInfo && !openCodeUrl && (
        <div className="px-3 py-4 text-muted-foreground text-center">
          waiting for session...
        </div>
      )}
    </div>
  )
}

// ============ Exports ============

export type { SessionPanelProps, RepoInfo, ModelInfo, TokenInfo, DiffSummary, Todo }
