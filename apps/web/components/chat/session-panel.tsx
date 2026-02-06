'use client'

import { useMemo, useState } from 'react'
import { cn } from '@ship/ui/utils'
import { Collapsible as CollapsiblePrimitive } from '@base-ui/react/collapsible'
import type { SessionInfo as SSESessionInfo } from '@/lib/sse-types'
import type { UIMessage } from '@/lib/ai-elements-adapter'

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
  messages?: UIMessage[]
  className?: string
}

// ============ Helpers ============

function formatTokenCount(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}

function formatCost(n: number): string {
  if (n >= 1) return `$${n.toFixed(2)}`
  return `$${n.toFixed(4)}`
}

function formatDate(ts: number): string {
  const d = new Date(ts * 1000)
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatRelative(ts: number): string {
  const now = Date.now() / 1000
  const diff = now - ts
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

// ============ Grid Row ============

function StatRow({ label, value, mono }: { label: string; value: string | number; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between py-0.5">
      <span className="text-[10px] text-muted-foreground/50 uppercase tracking-wide">{label}</span>
      <span className={cn('text-[11px] text-foreground/80', mono && 'font-mono')}>{value}</span>
    </div>
  )
}

// ============ Context Breakdown Bar ============

function ContextBreakdownBar({ tokens }: { tokens: TokenInfo }) {
  const total = tokens.input + tokens.output + tokens.reasoning + tokens.cache.read + tokens.cache.write
  if (total === 0) return null

  const segments = [
    { label: 'Input', value: tokens.input, color: 'bg-green-500/70' },
    { label: 'Output', value: tokens.output, color: 'bg-pink-500/70' },
    { label: 'Reasoning', value: tokens.reasoning, color: 'bg-blue-500/70' },
    { label: 'Cache', value: tokens.cache.read + tokens.cache.write, color: 'bg-yellow-500/70' },
  ].filter((s) => s.value > 0)

  return (
    <div className="space-y-1.5">
      <div className="flex h-2 w-full rounded-full overflow-hidden bg-muted/30">
        {segments.map((seg) => (
          <div
            key={seg.label}
            className={cn('h-full transition-all', seg.color)}
            style={{ width: `${(seg.value / total) * 100}%` }}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-0.5">
        {segments.map((seg) => (
          <div key={seg.label} className="flex items-center gap-1">
            <div className={cn('w-1.5 h-1.5 rounded-full', seg.color)} />
            <span className="text-[9px] text-muted-foreground/50">
              {seg.label} {Math.round((seg.value / total) * 100)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ============ Raw Messages Section ============

function RawMessagesSection({ messages }: { messages: UIMessage[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  if (!messages.length) return null

  return (
    <CollapsiblePrimitive.Root>
      <CollapsiblePrimitive.Trigger className="w-full flex items-center justify-between px-4 py-2 hover:bg-muted/20 transition-colors">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground/60 font-medium">
          Raw Messages ({messages.length})
        </span>
        <svg className="w-3 h-3 text-muted-foreground/40" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </CollapsiblePrimitive.Trigger>
      <CollapsiblePrimitive.Panel>
        <div className="px-3 pb-2 space-y-0.5 max-h-64 overflow-y-auto">
          {messages.map((msg) => (
            <div key={msg.id}>
              <button
                onClick={() => setExpandedId(expandedId === msg.id ? null : msg.id)}
                className="w-full flex items-center justify-between px-1.5 py-1 rounded hover:bg-muted/30 transition-colors text-left"
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <span
                    className={cn(
                      'text-[9px] font-mono px-1 py-0.5 rounded',
                      msg.role === 'user'
                        ? 'bg-green-500/10 text-green-500'
                        : msg.role === 'assistant'
                          ? 'bg-pink-500/10 text-pink-500'
                          : 'bg-muted text-muted-foreground',
                    )}
                  >
                    {msg.role}
                  </span>
                  <span className="text-[9px] text-muted-foreground/40 font-mono truncate">
                    {msg.id.slice(0, 8)}
                  </span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {msg.createdAt && (
                    <span className="text-[9px] text-muted-foreground/30">
                      {msg.createdAt.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                  <svg
                    className={cn('w-2.5 h-2.5 text-muted-foreground/30 transition-transform', expandedId === msg.id && 'rotate-180')}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </button>
              {expandedId === msg.id && (
                <pre className="text-[9px] font-mono text-muted-foreground/60 bg-muted/20 rounded p-2 mx-1 mt-0.5 mb-1 overflow-x-auto max-h-40 overflow-y-auto">
                  {JSON.stringify(
                    {
                      id: msg.id,
                      role: msg.role,
                      content: msg.content.slice(0, 500) + (msg.content.length > 500 ? '...' : ''),
                      toolInvocations: msg.toolInvocations?.length || 0,
                      reasoning: msg.reasoning?.length || 0,
                      type: msg.type,
                    },
                    null,
                    2,
                  )}
                </pre>
              )}
            </div>
          ))}
        </div>
      </CollapsiblePrimitive.Panel>
    </CollapsiblePrimitive.Root>
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
  messages = [],
  className,
}: SessionPanelProps) {
  const totalTokens = tokens ? tokens.input + tokens.output + tokens.reasoning : 0
  const contextLimit = tokens?.contextLimit || 200000
  const usagePercent = tokens ? Math.min((totalTokens / contextLimit) * 100, 100) : 0

  const messageCounts = useMemo(() => {
    const userMessages = messages.filter((m) => m.role === 'user').length
    const assistantMessages = messages.filter((m) => m.role === 'assistant').length
    return { total: messages.length, user: userMessages, assistant: assistantMessages }
  }, [messages])

  const totalChanges = useMemo(() => {
    if (!diffs || diffs.length === 0) return null
    return diffs.reduce(
      (acc, d) => ({ add: acc.add + d.additions, del: acc.del + d.deletions }),
      { add: 0, del: 0 },
    )
  }, [diffs])

  return (
    <div className={cn('flex flex-col text-xs overflow-y-auto', className)}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-border/20">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground/60 font-medium mb-1">Context</div>
        {sessionInfo?.title && (
          <div className="text-foreground font-medium text-[12px] leading-snug" title={sessionInfo.title}>
            {sessionInfo.title}
          </div>
        )}
      </div>

      {/* Stats Grid */}
      <div className="px-4 py-3 space-y-0.5">
        {/* Session & Messages */}
        <StatRow label="Session" value={sessionInfo?.id?.slice(0, 8) || sessionId.slice(0, 8)} mono />
        <StatRow label="Messages" value={messageCounts.total} />

        {/* Provider & Model */}
        {model && (
          <>
            {model.provider && <StatRow label="Provider" value={model.provider} />}
            <StatRow label="Model" value={model.name || model.id} />
            {model.mode && (
              <div className="flex items-baseline justify-between py-0.5">
                <span className="text-[10px] text-muted-foreground/50 uppercase tracking-wide">Mode</span>
                <span
                  className={cn(
                    'text-[10px] font-medium px-1.5 py-0.5 rounded',
                    model.mode === 'build'
                      ? 'bg-green-500/10 text-green-500'
                      : 'bg-blue-500/10 text-blue-500',
                  )}
                >
                  {model.mode}
                </span>
              </div>
            )}
          </>
        )}

        {/* Repo */}
        {repo && (
          <StatRow label="Repo" value={`${repo.owner}/${repo.name}`} mono />
        )}

        {/* Token stats */}
        {tokens && (
          <>
            <div className="pt-1.5 mt-1.5 border-t border-border/10" />
            <StatRow label="Context Limit" value={formatTokenCount(contextLimit)} mono />
            <StatRow label="Total Tokens" value={formatTokenCount(totalTokens)} mono />
            <StatRow label="Usage" value={`${usagePercent.toFixed(0)}%`} />
            <StatRow label="Input" value={formatTokenCount(tokens.input)} mono />
            <StatRow label="Output" value={formatTokenCount(tokens.output)} mono />
            {tokens.reasoning > 0 && <StatRow label="Reasoning" value={formatTokenCount(tokens.reasoning)} mono />}
            {(tokens.cache.read > 0 || tokens.cache.write > 0) && (
              <StatRow label="Cache" value={formatTokenCount(tokens.cache.read + tokens.cache.write)} mono />
            )}
            <StatRow label="User Msgs" value={messageCounts.user} />
            <StatRow label="Asst Msgs" value={messageCounts.assistant} />
          </>
        )}

        {/* Cost */}
        {cost !== undefined && cost > 0 && (
          <StatRow label="Total Cost" value={formatCost(cost)} mono />
        )}

        {/* Timing */}
        {sessionInfo?.time && (
          <>
            <div className="pt-1.5 mt-1.5 border-t border-border/10" />
            <StatRow label="Created" value={formatDate(sessionInfo.time.created)} />
            <StatRow label="Last Activity" value={formatRelative(sessionInfo.time.updated)} />
          </>
        )}
      </div>

      {/* Context Breakdown */}
      {tokens && totalTokens > 0 && (
        <>
          <div className="mx-4 border-t border-border/20" />
          <div className="px-4 py-3">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground/60 font-medium mb-2">
              Context Breakdown
            </div>
            <ContextBreakdownBar tokens={tokens} />
          </div>
        </>
      )}

      {/* Changes */}
      {diffs && diffs.length > 0 && totalChanges && (
        <>
          <div className="mx-4 border-t border-border/20" />
          <div className="px-4 py-3">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground/60 font-medium mb-2">
              Changes
            </div>
            <div className="flex items-center gap-3 text-[11px] mb-2">
              <span className="text-green-500 font-medium">+{totalChanges.add}</span>
              <span className="text-red-500 font-medium">-{totalChanges.del}</span>
              <span className="text-muted-foreground/50">{diffs.length} file{diffs.length !== 1 ? 's' : ''}</span>
            </div>
            <div className="space-y-1">
              {diffs.slice(0, 8).map((d, i) => (
                <div key={i} className="flex items-center justify-between text-[10px] text-muted-foreground font-mono gap-2">
                  <span className="truncate flex-1">{d.filename.split('/').pop()}</span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-green-500">+{d.additions}</span>
                    <span className="text-red-500">-{d.deletions}</span>
                  </div>
                </div>
              ))}
              {diffs.length > 8 && (
                <div className="text-[10px] text-muted-foreground/50 mt-1">...{diffs.length - 8} more</div>
              )}
            </div>
          </div>
        </>
      )}

      {/* OpenCode URL */}
      {openCodeUrl && (
        <>
          <div className="mx-4 border-t border-border/20" />
          <div className="px-4 py-3">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground/60 font-medium mb-1">
              OpenCode
            </div>
            <a
              href={openCodeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary/70 hover:text-primary hover:underline truncate text-[11px] font-mono block"
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
          </div>
        </>
      )}

      {/* Raw Messages */}
      {messages.length > 0 && (
        <>
          <div className="mx-4 border-t border-border/20" />
          <RawMessagesSection messages={messages} />
        </>
      )}

      {/* Empty state */}
      {!repo && !model && !tokens && !sessionInfo && !openCodeUrl && messages.length === 0 && (
        <div className="px-4 py-8 text-muted-foreground/50 text-center text-[11px]">
          Waiting for session data...
        </div>
      )}
    </div>
  )
}

// ============ Exports ============

export type { SessionPanelProps, RepoInfo, ModelInfo, TokenInfo, DiffSummary, Todo }
