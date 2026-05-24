'use client'

import { useMemo } from 'react'
import type { UIMessage } from '@/lib/ai-elements-adapter'
import type { SessionPanelProps } from './types'
import { StatsInfoPanel, StatsTokensPanel } from './stats-section-panels'

export function StatsSection({
  agent,
  model,
  repo,
  tokens,
  cost,
  messages,
  agentUrl,
}: Pick<SessionPanelProps, 'sessionId' | 'agent' | 'model' | 'repo' | 'tokens' | 'cost' | 'sessionInfo' | 'agentUrl'> & { messages: UIMessage[] }) {
  const messageCount = useMemo(() => messages.length, [messages.length])
  const totalTokens = tokens ? tokens.input + tokens.output + tokens.reasoning : 0
  const hasInfo = agent || model || repo || agentUrl
  const hasTokens = tokens && totalTokens > 0

  if (!hasInfo && !hasTokens && messageCount === 0) return null

  return (
    <div className="px-3 py-2 space-y-3">
      {hasInfo && (
        <StatsInfoPanel
          agent={agent}
          model={model}
          repo={repo}
          messageCount={messageCount}
          agentUrl={agentUrl}
          cost={cost}
        />
      )}
      {hasTokens && tokens && <StatsTokensPanel tokens={tokens} />}
    </div>
  )
}
