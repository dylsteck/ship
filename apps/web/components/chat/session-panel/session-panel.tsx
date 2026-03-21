'use client'

import { cn, Separator } from '@ship/ui'
import type { SessionPanelProps } from './types'
import { TasksSection } from './tasks-section'
import { StatsSection } from './stats-section'
import { ChangesSection } from './changes-section'
import { SessionActionsSection } from './session-actions-section'
import { VCSSection } from './vcs-section'
import { EventsSection } from './events-section'

export function SessionPanel({
  sessionId,
  repo,
  agent,
  model,
  tokens,
  cost,
  todos,
  diffs,
  sessionInfo,
  agentUrl,
  agentSessionId,
  messages = [],
  className,
}: SessionPanelProps) {
  return (
    <div className={cn('flex flex-col text-xs', className)}>
      {/* Session title */}
      <div className="px-3 pt-3 pb-1">
        {sessionInfo?.title ? (
          <h3 className="text-sm font-medium text-foreground leading-snug truncate" title={sessionInfo.title}>
            {sessionInfo.title}
          </h3>
        ) : (
          <h3 className="text-xs text-muted-foreground/50">Session</h3>
        )}
      </div>

      {/* Primary info group */}
      <StatsSection
        sessionId={sessionId}
        agent={agent}
        model={model}
        repo={repo}
        tokens={tokens}
        cost={cost}
        messages={messages}
        sessionInfo={sessionInfo}
        agentUrl={agentUrl}
      />

      {/* Tasks */}
      <TasksSection todos={todos || []} messages={messages} />

      {/* Changes */}
      <ChangesSection diffs={diffs || []} />

      {/* VCS */}
      <VCSSection sessionInfo={sessionInfo} />

      {/* Session Health */}
      <SessionActionsSection tokens={tokens} sessionCreatedAt={sessionInfo?.time?.created} />

      <Separator className="opacity-20" />

      {/* Events inspector */}
      <EventsSection sessionId={sessionId} messageCount={messages.length} />

      {/* Empty state */}
      {!repo && !model && !tokens && !sessionInfo && !agentUrl && messages.length === 0 && (
        <div className="px-3 py-12 text-muted-foreground/40 text-center text-xs">
          Waiting for session data...
        </div>
      )}
    </div>
  )
}
