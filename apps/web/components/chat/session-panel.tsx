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
      <CollapsiblePrimitive.Trigger className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-muted/20 transition-colors">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground/60 font-medium">
          Messages ({messages.length})
        </span>
        <svg className="w-3 h-3 text-muted-foreground/40" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </CollapsiblePrimitive.Trigger>
      <CollapsiblePrimitive.Panel>
        <div className="px-3 pb-3 space-y-px max-h-80 overflow-y-auto">
          {messages.map((msg) => {
            const isExpanded = expandedId === msg.id
            const toolCount = msg.toolInvocations?.length || 0
            const hasReasoning = (msg.reasoning?.length || 0) > 0
            const contentPreview = msg.content
              ? msg.content.slice(0, 80).replace(/\n/g, ' ') + (msg.content.length > 80 ? '...' : '')
              : null

            return (
              <div key={msg.id} className={cn('rounded-md transition-colors', isExpanded && 'bg-muted/20')}>
                <button
                  onClick={() => setExpandedId(isExpanded ? null : msg.id)}
                  className="w-full flex items-start justify-between px-2 py-1.5 rounded-md hover:bg-muted/30 transition-colors text-left gap-2"
                >
                  <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={cn(
                          'text-[9px] font-mono px-1.5 py-0.5 rounded font-medium shrink-0',
                          msg.role === 'user'
                            ? 'bg-green-500/10 text-green-600 dark:text-green-400'
                            : msg.role === 'assistant'
                              ? 'bg-violet-500/10 text-violet-600 dark:text-violet-400'
                              : 'bg-muted text-muted-foreground',
                        )}
                      >
                        {msg.role}
                      </span>
                      {msg.type && msg.type !== 'error' && (
                        <span className="text-[8px] text-muted-foreground/40 font-mono">{msg.type}</span>
                      )}
                      {msg.type === 'error' && (
                        <span className="text-[8px] text-red-500/70 font-mono">error</span>
                      )}
                      {msg.createdAt && (
                        <span className="text-[9px] text-muted-foreground/30 ml-auto shrink-0">
                          {msg.createdAt.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                    </div>
                    {contentPreview && (
                      <span className="text-[9px] text-muted-foreground/40 truncate leading-tight">
                        {contentPreview}
                      </span>
                    )}
                  </div>
                  <svg
                    className={cn('w-3 h-3 text-muted-foreground/30 transition-transform shrink-0 mt-0.5', isExpanded && 'rotate-180')}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {isExpanded && (
                  <div className="px-2 pb-2 space-y-1.5">
                    {/* Summary badges */}
                    <div className="flex flex-wrap gap-1">
                      <span className="text-[8px] font-mono px-1.5 py-0.5 rounded bg-muted/40 text-muted-foreground/50">
                        id: {msg.id.slice(0, 12)}
                      </span>
                      {toolCount > 0 && (
                        <span className="text-[8px] font-mono px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-500/70">
                          {toolCount} tool{toolCount !== 1 ? 's' : ''}
                        </span>
                      )}
                      {hasReasoning && (
                        <span className="text-[8px] font-mono px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-500/70">
                          reasoning
                        </span>
                      )}
                      {msg.elapsed && (
                        <span className="text-[8px] font-mono px-1.5 py-0.5 rounded bg-muted/40 text-muted-foreground/50">
                          {msg.elapsed >= 1000 ? `${(msg.elapsed / 1000).toFixed(1)}s` : `${msg.elapsed}ms`}
                        </span>
                      )}
                    </div>

                    {/* Content preview */}
                    {msg.content && (
                      <div>
                        <div className="text-[8px] text-muted-foreground/40 uppercase tracking-wide mb-0.5">Content</div>
                        <pre className="text-[9px] font-mono text-muted-foreground/60 bg-muted/30 rounded p-1.5 overflow-x-auto max-h-24 overflow-y-auto whitespace-pre-wrap break-all leading-relaxed">
                          {msg.content.slice(0, 1000)}{msg.content.length > 1000 ? '\n...' : ''}
                        </pre>
                      </div>
                    )}

                    {/* Tool invocations */}
                    {toolCount > 0 && (
                      <div>
                        <div className="text-[8px] text-muted-foreground/40 uppercase tracking-wide mb-0.5">Tools</div>
                        <div className="space-y-0.5">
                          {msg.toolInvocations!.map((t) => (
                            <div key={t.toolCallId} className="flex items-center gap-1.5 text-[9px] font-mono text-muted-foreground/50 bg-muted/30 rounded px-1.5 py-1">
                              <span className={cn(
                                'w-1 h-1 rounded-full shrink-0',
                                t.state === 'result' ? 'bg-green-500/70' : t.state === 'error' ? 'bg-red-500/70' : 'bg-muted-foreground/30',
                              )} />
                              <span className="text-foreground/70 font-medium">{t.toolName}</span>
                              {t.duration !== undefined && (
                                <span className="text-muted-foreground/30 ml-auto">
                                  {t.duration >= 1000 ? `${(t.duration / 1000).toFixed(1)}s` : `${t.duration}ms`}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Reasoning preview */}
                    {hasReasoning && (
                      <div>
                        <div className="text-[8px] text-muted-foreground/40 uppercase tracking-wide mb-0.5">Reasoning</div>
                        <pre className="text-[9px] font-mono text-muted-foreground/60 bg-muted/30 rounded p-1.5 overflow-x-auto max-h-20 overflow-y-auto whitespace-pre-wrap break-all leading-relaxed">
                          {msg.reasoning!.join('\n').slice(0, 500)}{msg.reasoning!.join('\n').length > 500 ? '\n...' : ''}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
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
