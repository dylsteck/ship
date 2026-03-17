'use client'

import { useMemo } from 'react'
import { cn } from '@ship/ui/utils'
import type { UIMessage } from '@/lib/ai-elements-adapter'
import type { SessionPanelProps, TokenInfo } from './types'
import { formatTokenCount, formatCost } from './helpers'
import { ContextBreakdownBar } from './context-breakdown'

function StatRow({ label, value, badge }: { label: string; value?: React.ReactNode; badge?: { text: string; color: string } }) {
  if (!value && !badge) return null
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-[11px] text-muted-foreground/50">{label}</span>
      {badge ? (
        <span className={cn('text-[10px] font-medium px-2 py-0.5 rounded-full', badge.color)}>
          {badge.text}
        </span>
      ) : (
        <span className="text-[11px] text-foreground/80 font-mono truncate ml-3 max-w-[55%] text-right">
          {value}
        </span>
      )}
    </div>
  )
}

export function StatsSection({
  sessionId,
  agent,
  model,
  repo,
  tokens,
  cost,
  messages,
  sessionInfo,
}: Pick<SessionPanelProps, 'sessionId' | 'agent' | 'model' | 'repo' | 'tokens' | 'cost' | 'sessionInfo'> & { messages: UIMessage[] }) {
  const messageCounts = useMemo(() => {
    const user = messages.filter((m) => m.role === 'user').length
    const assistant = messages.filter((m) => m.role === 'assistant').length
    return { total: messages.length, user, assistant }
  }, [messages])

  const totalTokens = tokens ? tokens.input + tokens.output + tokens.reasoning : 0
  const contextLimit = tokens?.contextLimit || 200000
  const usagePercent = tokens ? Math.min((totalTokens / contextLimit) * 100, 100) : 0

  const hasInfo = agent || model || repo
  const hasTokens = tokens && totalTokens > 0

  if (!hasInfo && !hasTokens && messageCounts.total === 0) return null

  return (
    <div className="px-3 py-2 space-y-3">
      {/* Session info card */}
      {hasInfo && (
        <div className="rounded-lg border border-border/20 bg-muted/10 px-3 py-1.5 divide-y divide-border/10">
          {agent && <StatRow label="Agent" value={agent.name} />}
          {model && <StatRow label="Model" value={model.name || model.id} />}
          {model?.mode && (
            <StatRow
              label="Mode"
              badge={{
                text: model.mode,
                color: model.mode === 'build' || model.mode === 'agent' || model.mode === 'auto' || model.mode === 'default'
                  ? 'bg-green-500/15 text-green-500'
                  : 'bg-blue-500/15 text-blue-500',
              }}
            />
          )}
          {repo && <StatRow label="Repo" value={`${repo.owner}/${repo.name}`} />}
          {messageCounts.total > 0 && (
            <StatRow label="Messages" value={`${messageCounts.total}`} />
          )}
          {cost !== undefined && cost > 0 && (
            <StatRow label="Cost" value={formatCost(cost)} />
          )}
        </div>
      )}

      {/* Token usage */}
      {hasTokens && (
        <div className="rounded-lg border border-border/20 bg-muted/10 px-3 py-2.5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-muted-foreground/50">Context</span>
            <span className="text-[11px] text-foreground/70 font-mono">
              {formatTokenCount(totalTokens)} / {formatTokenCount(contextLimit)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-muted/40 rounded-full overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full transition-all',
                  usagePercent >= 80 ? 'bg-red-500' : usagePercent >= 60 ? 'bg-yellow-500' : 'bg-primary/60',
                )}
                style={{ width: `${usagePercent}%` }}
              />
            </div>
            <span className="text-[10px] text-muted-foreground/40 font-mono w-8 text-right">
              {usagePercent.toFixed(0)}%
            </span>
          </div>
          <ContextBreakdownBar tokens={tokens} />
        </div>
      )}
    </div>
  )
}
