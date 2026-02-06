'use client'

import { useMemo, useState } from 'react'
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
    <div className={cn('px-4 py-3', className)}>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground/60 font-medium mb-2">
        {label}
      </div>
      {children}
    </div>
  )
}

function SectionDivider() {
  return <div className="mx-4 border-t border-border/20" />
}

// ============ Helpers ============

function formatTokenCount(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}

function TokenPill({ label, value, color }: { label: string; value: number; color?: string }) {
  if (value === 0) return null
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-mono bg-muted/60',
        color || 'text-muted-foreground',
      )}
    >
      <span className="text-muted-foreground/50">{label}</span>
      {formatTokenCount(value)}
    </span>
  )
}

function DiffBar({ additions, deletions }: { additions: number; deletions: number }) {
  const total = additions + deletions
  if (total === 0) return null
  const addPercent = (additions / total) * 100
  return (
    <div className="flex h-1 rounded-full overflow-hidden bg-muted/40 w-12">
      <div className="bg-green-500/70 h-full" style={{ width: `${addPercent}%` }} />
      <div className="bg-red-500/70 h-full" style={{ width: `${100 - addPercent}%` }} />
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
  const [copied, setCopied] = useState(false)

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

  const cacheTotal = tokens ? tokens.cache.read + tokens.cache.write : 0
  const cacheHitPercent = tokens && cacheTotal > 0
    ? Math.round((tokens.cache.read / (tokens.input + tokens.cache.read)) * 100)
    : null

  const handleCopy = () => {
    if (!openCodeUrl) return
    navigator.clipboard.writeText(openCodeUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className={cn('flex flex-col text-xs overflow-y-auto', className)}>
      {/* Session title */}
      {sessionInfo?.title && (
        <>
          <PanelSection label="Session">
            <div className="text-foreground font-medium text-[12px] leading-snug" title={sessionInfo.title}>
              {sessionInfo.title}
            </div>
            <div className="text-muted-foreground/50 font-mono text-[9px] mt-1">
              {sessionInfo.id.slice(0, 8)}
            </div>
          </PanelSection>
          <SectionDivider />
        </>
      )}

      {/* Repo */}
      {repo && (
        <>
          <PanelSection label="Repository">
            <div className="text-foreground font-mono text-[11px]">
              {repo.owner}/{repo.name}
            </div>
            {repo.branch && (
              <div className="text-muted-foreground/60 mt-0.5 font-mono text-[10px]">{repo.branch}</div>
            )}
          </PanelSection>
          <SectionDivider />
        </>
      )}

      {/* Model */}
      {model && (
        <>
          <PanelSection label="Model">
            <div className="text-foreground text-[11px]">{model.name || model.id}</div>
            {model.mode && (
              <div className="mt-1.5">
                <span
                  className={cn(
                    'inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium',
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
          <SectionDivider />
        </>
      )}

      {/* Context usage */}
      {tokens && (
        <>
          <PanelSection label="Context">
            <div className="flex items-baseline justify-between mb-2">
              <span className="text-foreground text-[12px] font-medium">{usagePercent.toFixed(0)}%</span>
              <span className="text-muted-foreground/50 text-[10px]">
                {formatTokenCount(totalTokens)} / {formatTokenCount(contextLimit)}
              </span>
            </div>
            <div className="h-2 w-full bg-muted/40 rounded-full overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full transition-all duration-500',
                  usagePercent > 80 ? 'bg-red-500' : usagePercent > 60 ? 'bg-yellow-500' : 'bg-green-500',
                )}
                style={{ width: `${usagePercent}%` }}
              />
            </div>
            <div className="flex flex-wrap gap-1 mt-2">
              <TokenPill label="in" value={tokens.input} />
              <TokenPill label="out" value={tokens.output} />
              {tokens.reasoning > 0 && <TokenPill label="think" value={tokens.reasoning} />}
            </div>
            {(tokens.cache.read > 0 || tokens.cache.write > 0) && (
              <div className="flex items-center gap-2 mt-1.5">
                <div className="flex gap-1">
                  {tokens.cache.read > 0 && <TokenPill label="cache-r" value={tokens.cache.read} color="text-green-500" />}
                  {tokens.cache.write > 0 && <TokenPill label="cache-w" value={tokens.cache.write} color="text-blue-500" />}
                </div>
                {cacheHitPercent !== null && (
                  <span className="text-[10px] text-muted-foreground/50">{cacheHitPercent}% hit</span>
                )}
              </div>
            )}
          </PanelSection>
          <SectionDivider />
        </>
      )}

      {/* Cost */}
      {cost !== undefined && cost > 0 && (
        <>
          <PanelSection label="Cost">
            <div className="text-foreground font-mono text-[14px] font-medium">${cost.toFixed(4)}</div>
          </PanelSection>
          <SectionDivider />
        </>
      )}

      {/* OpenCode URL */}
      {openCodeUrl && (
        <>
          <PanelSection label="OpenCode">
            <div className="flex items-center gap-1.5">
              <a
                href={openCodeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary/70 hover:text-primary hover:underline truncate flex-1 min-w-0 text-[11px] font-mono"
                title={openCodeUrl}
              >
                {(() => {
                  try {
                    const url = new URL(openCodeUrl)
                    const path = url.pathname.length > 20 ? url.pathname.slice(0, 17) + '...' : url.pathname
                    return url.host + path
                  } catch {
                    return openCodeUrl.replace(/^https?:\/\//, '').slice(0, 30)
                  }
                })()}
              </a>
              <button
                onClick={handleCopy}
                className={cn(
                  'text-[10px] px-1.5 py-0.5 rounded-md transition-all shrink-0',
                  copied
                    ? 'text-green-500 bg-green-500/10'
                    : 'text-muted-foreground/50 hover:text-foreground hover:bg-muted/60',
                )}
                title="Copy URL"
              >
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
          </PanelSection>
          <SectionDivider />
        </>
      )}

      {/* Changes */}
      {diffs && diffs.length > 0 && totalChanges && (
        <>
          <PanelSection label="Changes">
            <div className="flex items-center gap-3 text-[11px] mb-2">
              <span className="text-green-500 font-medium">+{totalChanges.add}</span>
              <span className="text-red-500 font-medium">-{totalChanges.del}</span>
              <span className="text-muted-foreground/50">{diffs.length} file{diffs.length !== 1 ? 's' : ''}</span>
              <DiffBar additions={totalChanges.add} deletions={totalChanges.del} />
            </div>
            <div className="space-y-1">
              {diffs.slice(0, 8).map((d, i) => (
                <div key={i} className="flex items-center justify-between text-[10px] text-muted-foreground font-mono gap-2">
                  <span className="truncate flex-1">{d.filename.split('/').pop()}</span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <DiffBar additions={d.additions} deletions={d.deletions} />
                    <span className="w-8 text-right">
                      <span className="text-green-500">+{d.additions}</span>
                    </span>
                    <span className="w-8 text-right">
                      <span className="text-red-500">-{d.deletions}</span>
                    </span>
                  </div>
                </div>
              ))}
              {diffs.length > 8 && (
                <div className="text-[10px] text-muted-foreground/50 mt-1">...{diffs.length - 8} more</div>
              )}
            </div>
          </PanelSection>
          <SectionDivider />
        </>
      )}

      {/* Todos */}
      {activeTodos.length > 0 && (
        <>
          <PanelSection label={`Todos (${activeTodos.length})`}>
            <div className="space-y-1.5">
              {activeTodos.slice(0, 5).map((t) => (
                <div key={t.id} className="flex items-start gap-2 text-[11px]">
                  <span
                    className={cn(
                      'mt-1 w-1.5 h-1.5 rounded-full shrink-0',
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
          <SectionDivider />
        </>
      )}

      {/* Session info (only if no title section above) */}
      {sessionInfo && !sessionInfo.title && (
        <>
          <PanelSection label="Session">
            <div className="text-foreground font-mono text-[10px] truncate" title={sessionInfo.id}>
              {sessionInfo.id.slice(0, 12)}...
            </div>
            {sessionInfo.summary && (sessionInfo.summary.files > 0 || sessionInfo.summary.additions > 0) && (
              <div className="flex gap-3 mt-1 text-[10px] font-mono text-muted-foreground">
                <span>{sessionInfo.summary.files} files</span>
                <span className="text-green-500">+{sessionInfo.summary.additions}</span>
                <span className="text-red-500">-{sessionInfo.summary.deletions}</span>
              </div>
            )}
          </PanelSection>
        </>
      )}

      {/* Empty state */}
      {!repo && !model && !tokens && !activeTodos.length && !diffs?.length && !sessionInfo && !openCodeUrl && (
        <div className="px-4 py-8 text-muted-foreground/50 text-center text-[11px]">
          Waiting for session data...
        </div>
      )}
    </div>
  )
}

// ============ Exports ============

export type { SessionPanelProps, RepoInfo, ModelInfo, TokenInfo, DiffSummary, Todo }
