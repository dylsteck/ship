'use client'

import { useMemo } from 'react'
import { cn, Badge, Separator, Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@ship/ui'
import type { UIMessage } from '@/lib/ai-elements-adapter'
import type { SessionPanelProps, TokenInfo } from './types'
import { formatTokenCount, formatCost } from './helpers'
import { ContextBreakdownBar } from './context-breakdown'

function StatRow({
  label,
  value,
  badge,
}: {
  label: string
  value?: React.ReactNode
  badge?: { text: string; variant: 'default' | 'secondary' | 'outline'; className?: string }
}) {
  if (!value && !badge) return null
  return (
    <div className="flex items-center justify-between py-2 px-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      {badge ? (
        <Badge variant={badge.variant} className={cn('text-[10px] font-medium', badge.className)}>
          {badge.text}
        </Badge>
      ) : (
        <span className="text-xs text-foreground font-mono truncate ml-3 max-w-[55%] text-right">
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
  agentUrl,
}: Pick<SessionPanelProps, 'sessionId' | 'agent' | 'model' | 'repo' | 'tokens' | 'cost' | 'sessionInfo' | 'agentUrl'> & { messages: UIMessage[] }) {
  const messageCounts = useMemo(() => {
    const user = messages.filter((m) => m.role === 'user').length
    const assistant = messages.filter((m) => m.role === 'assistant').length
    return { total: messages.length, user, assistant }
  }, [messages])

  const totalTokens = tokens ? tokens.input + tokens.output + tokens.reasoning : 0
  const contextLimit = tokens?.contextLimit || 200000
  const usagePercent = tokens ? Math.min((totalTokens / contextLimit) * 100, 100) : 0

  const hasInfo = agent || model || repo || agentUrl
  const hasTokens = tokens && totalTokens > 0

  if (!hasInfo && !hasTokens && messageCounts.total === 0) return null

  return (
    <div className="px-3 py-2 space-y-3">
      {hasInfo && (
        <div className="rounded-lg border border-border/30 bg-card/50 divide-y divide-border/20">
          <div className="px-3">
            {agent && <StatRow label="Agent" value={agent.name} />}
          </div>
          {model && (
            <div className="px-3">
              <StatRow label="Model" value={model.name || model.id} />
            </div>
          )}
          {model?.mode && (
            <div className="px-3">
              <StatRow
                label="Mode"
                badge={{
                  text: model.mode,
                  variant: 'secondary',
                  className:
                    model.mode === 'build' || model.mode === 'agent' || model.mode === 'auto' || model.mode === 'default'
                      ? 'bg-green-500/10 text-green-500 border-green-500/20'
                      : 'bg-blue-500/10 text-blue-500 border-blue-500/20',
                }}
              />
            </div>
          )}
          {repo && (
            <div className="px-3">
              <StatRow label="Repo" value={`${repo.owner}/${repo.name}`} />
            </div>
          )}
          {messageCounts.total > 0 && (
            <div className="px-3">
              <StatRow label="Messages" value={`${messageCounts.total}`} />
            </div>
          )}
          {agentUrl && (
            <div className="px-3">
              <StatRow
                label="URL"
                value={
                  <a
                    href={agentUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-primary transition-colors truncate"
                  >
                    {agentUrl.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                  </a>
                }
              />
            </div>
          )}
          {cost !== undefined && cost > 0 && (
            <div className="px-3">
              <StatRow label="Cost" value={formatCost(cost)} />
            </div>
          )}
        </div>
      )}

      {hasTokens && (
        <div className="rounded-lg border border-border/30 bg-card/50 px-3 py-3 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Context</span>
            <span className="text-xs text-foreground/80 font-mono">
              {formatTokenCount(totalTokens)} / {formatTokenCount(contextLimit)}
            </span>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="flex-1 h-1.5 bg-muted/30 rounded-full overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full transition-all duration-500',
                  usagePercent >= 80 ? 'bg-red-500' : usagePercent >= 60 ? 'bg-yellow-500' : 'bg-primary/60',
                )}
                style={{ width: `${usagePercent}%` }}
              />
            </div>
            <span className="text-[10px] text-muted-foreground/60 font-mono w-8 text-right tabular-nums">
              {usagePercent.toFixed(0)}%
            </span>
          </div>
          <ContextBreakdownBar tokens={tokens} />
        </div>
      )}
    </div>
  )
}
