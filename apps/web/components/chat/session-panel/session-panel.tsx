'use client'

import { useMemo } from 'react'
import { cn } from '@ship/ui/utils'
import type { SessionPanelProps } from './types'
import { ActiveToolsSection } from './active-tools-section'
import { TasksSection } from './tasks-section'
import { StatsSection } from './stats-section'
import { ChangesSection } from './changes-section'
import { AgentLink } from './agent-link'
import { SessionActionsSection } from './session-actions-section'
import { VCSSection } from './vcs-section'

export function SessionPanel({
  sessionId,
  repo,
  model,
  tokens,
  cost,
  todos,
  diffs,
  sessionInfo,
  agentUrl,
  messages = [],
  className,
}: SessionPanelProps) {
  const activeTools = useMemo(() => {
    const tools: Array<{ toolCallId: string; toolName: string; title?: string }> = []
    for (let i = messages.length - 1; i >= 0 && tools.length < 5; i--) {
      const msg = messages[i]
      if (!msg.toolInvocations) continue
      for (const tool of msg.toolInvocations) {
        if (tool.state === 'call' || tool.state === 'partial-call') {
          tools.push({ toolCallId: tool.toolCallId, toolName: tool.toolName, title: tool.title })
        }
      }
    }
    return tools
  }, [messages])

  return (
    <div className={cn('flex flex-col text-xs', className)}>
      {/* Session title */}
      <div className="px-3 pt-3 pb-2">
        {sessionInfo?.title ? (
          <div className="text-[12px] font-medium text-foreground leading-snug" title={sessionInfo.title}>
            {sessionInfo.title}
          </div>
        ) : (
          <div className="text-[11px] text-muted-foreground/50">Session</div>
        )}
      </div>

      {/* Active tools — always show when present */}
      <ActiveToolsSection tools={activeTools} />

      {/* Primary info group */}
      <StatsSection
        sessionId={sessionId}
        model={model}
        repo={repo}
        tokens={tokens}
        cost={cost}
        messages={messages}
        sessionInfo={sessionInfo}
      />

      {/* Tasks */}
      <TasksSection todos={todos || []} messages={messages} />

      {/* Changes */}
      <ChangesSection diffs={diffs || []} />

      {/* VCS */}
      <VCSSection sessionInfo={sessionInfo} />

      {/* Session Health */}
      <SessionActionsSection tokens={tokens} sessionCreatedAt={sessionInfo?.time?.created} />

      {/* Agent link */}
      {agentUrl && <AgentLink url={agentUrl} />}

      {/* Empty state */}
      {!repo && !model && !tokens && !sessionInfo && !agentUrl && messages.length === 0 && (
        <div className="px-3 py-8 text-muted-foreground/40 text-center text-[11px]">
          Waiting for session data...
        </div>
      )}
    </div>
  )
}
