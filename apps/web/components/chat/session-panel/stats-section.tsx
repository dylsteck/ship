'use client'

import { useMemo } from 'react'
import { cn } from '@ship/ui/utils'
import type { UIMessage } from '@/lib/ai-elements-adapter'
import type { SessionPanelProps, TokenInfo } from './types'
import { formatTokenCount, formatCost } from './helpers'
import { ContextBreakdownBar } from './context-breakdown'

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

  return (
    <div className="px-3 py-2 space-y-2.5">
      {/* Agent, Model & Repo row */}
      {(agent || model || repo) && (
        <div className="space-y-1">
          {agent && (
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground/60">Agent</span>
              <span className="text-[11px] text-foreground/70 font-mono truncate ml-2 max-w-[60%] text-right">
                {agent.name}
              </span>
            </div>
          )}
          {model && (
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground/60">Model</span>
              <span className="text-[11px] text-foreground/70 font-mono truncate ml-2 max-w-[60%] text-right">
                {model.name || model.id}
              </span>
            </div>
          )}
          {model?.mode && (
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground/60">Mode</span>
              <span className={cn(
                'text-[9px] font-medium px-1.5 py-0.5 rounded-full',
                model.mode === 'build' || model.mode === 'agent' || model.mode === 'auto' || model.mode === 'default'
                  ? 'bg-green-500/10 text-green-500'
                  : 'bg-blue-500/10 text-blue-500',
              )}>
                {model.mode}
              </span>
            </div>
          )}
          {repo && (
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground/60">Repo</span>
              <span className="text-[11px] text-foreground/70 font-mono truncate ml-2 max-w-[60%] text-right">
                {repo.owner}/{repo.name}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Token usage — compact */}
      {tokens && totalTokens > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-muted-foreground/60">Tokens</span>
            <span className="text-[11px] text-foreground/70 font-mono">
              {formatTokenCount(totalTokens)} / {formatTokenCount(contextLimit)}
            </span>
          </div>
          {/* Compact usage bar */}
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1 bg-muted/40 rounded-full overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full transition-all',
                  usagePercent >= 80 ? 'bg-red-500' : usagePercent >= 60 ? 'bg-yellow-500' : 'bg-primary/60',
                )}
                style={{ width: `${usagePercent}%` }}
              />
            </div>
            <span className="text-[9px] text-muted-foreground/40 font-mono w-7 text-right">
              {usagePercent.toFixed(0)}%
            </span>
          </div>
          <ContextBreakdownBar tokens={tokens} />
        </div>
      )}

      {/* Cost + Messages — inline row */}
      <div className="flex items-center gap-3 text-[11px] text-muted-foreground/60">
        {messageCounts.total > 0 && (
          <span>{messageCounts.total} msgs</span>
        )}
        {cost !== undefined && cost > 0 && (
          <span className="font-mono">{formatCost(cost)}</span>
        )}
      </div>
    </div>
  )
}
