'use client'

import * as React from 'react'
import { useMemo } from 'react'
import { Card, CardHeader, CardTitle, CardContent, Badge, Progress, ScrollArea, Separator } from '@ship/ui'
import { cn } from '@ship/ui/utils'
import { ToolCard } from './tool-card'
import type { ToolPart, ReasoningPart, StepFinishPart } from '@/lib/sse-types'

interface ActivityFeedProps {
  tools: ToolPart[]
  reasoning?: ReasoningPart[]
  tokenInfo?: StepFinishPart['tokens'] & { contextLimit?: number }
  cost?: number
  isStreaming?: boolean
  startTime?: number
  className?: string
  statusEvents?: Array<{ status: string; message: string; time: number }>
}

// Animated streaming indicator
function StreamingIndicator() {
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
      </span>
      <span>Agent is thinking...</span>
    </div>
  )
}

// Status icon mapping
const STATUS_ICONS: Record<string, string> = {
  initializing: '🚀',
  provisioning: '📦',
  'sandbox-ready': '✅',
  'starting-opencode': '🔌',
  cloning: '📥',
  'repo-ready': '✅',
  'creating-session': '🔧',
  'sending-prompt': '📤',
  'agent-active': '⚡',
  'agent-thinking': '💭',
  'tool-call': '🔧',
}

// Status timeline showing initialization progress
function StatusTimeline({
  events,
  isStreaming,
}: {
  events: Array<{ status: string; message: string; time: number }>
  isStreaming?: boolean
}) {
  if (events.length === 0) return null

  // Get unique statuses (keep latest for each status type)
  const uniqueEvents = useMemo(() => {
    const seen = new Set<string>()
    const result: typeof events = []
    // Iterate in reverse to keep latest
    for (let i = events.length - 1; i >= 0; i--) {
      const event = events[i]
      if (!seen.has(event.status)) {
        seen.add(event.status)
        result.unshift(event)
      }
    }
    return result
  }, [events])

  return (
    <Card size="sm" className="border-dashed border-blue-500/30 bg-blue-500/5">
      <CardHeader className="pb-2">
        <CardTitle className="text-xs flex items-center gap-2">
          <span>📊</span>
          <span>Initialization Progress</span>
          {isStreaming && (
            <span className="relative flex h-1.5 w-1.5 ml-auto">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-blue-500" />
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-[11px] top-2 bottom-2 w-0.5 bg-gradient-to-b from-blue-500/50 via-blue-500/30 to-transparent" />

          {/* Status items */}
          <div className="space-y-2">
            {uniqueEvents.map((event, index) => {
              const icon = STATUS_ICONS[event.status] || '⚪'
              const isLatest = index === uniqueEvents.length - 1

              return (
                <div key={`${event.status}-${index}`} className="flex items-center gap-3 relative">
                  {/* Icon bubble */}
                  <div
                    className={cn(
                      'relative z-10 flex items-center justify-center w-5 h-5 rounded-full text-xs shrink-0',
                      isLatest && isStreaming
                        ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/30'
                        : 'bg-background border border-blue-500/30',
                    )}
                  >
                    {icon}
                  </div>

                  {/* Status text */}
                  <div className="flex-1 min-w-0">
                    <p
                      className={cn(
                        'text-xs truncate',
                        isLatest && isStreaming ? 'text-foreground font-medium' : 'text-muted-foreground',
                      )}
                    >
                      {event.message}
                    </p>
                  </div>

                  {/* Animated indicator for latest */}
                  {isLatest && isStreaming && (
                    <span className="w-1 h-1 rounded-full bg-blue-500 animate-pulse shrink-0" />
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// Token/cost summary bar
function TokenSummary({
  tokens,
  cost,
  contextLimit = 200000,
}: {
  tokens: StepFinishPart['tokens']
  cost?: number
  contextLimit?: number
}) {
  const totalTokens = tokens.input + tokens.output + tokens.reasoning
  const contextUsage = Math.min((totalTokens / contextLimit) * 100, 100)

  return (
    <Card size="sm">
      <CardContent className="py-3">
        <div className="space-y-3">
          {/* Context usage */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Context Usage</span>
              <span className="font-mono">
                {totalTokens.toLocaleString()} / {contextLimit.toLocaleString()}
              </span>
            </div>
            <Progress
              value={contextUsage}
              className={cn(
                'h-1.5',
                contextUsage > 80 && 'bg-red-500/20 [&>div]:bg-red-500',
                contextUsage > 60 && contextUsage <= 80 && 'bg-yellow-500/20 [&>div]:bg-yellow-500',
              )}
            />
          </div>

          {/* Token breakdown */}
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-3">
              <span className="text-muted-foreground">
                In: <span className="text-foreground font-mono">{tokens.input.toLocaleString()}</span>
              </span>
              <span className="text-muted-foreground">
                Out: <span className="text-foreground font-mono">{tokens.output.toLocaleString()}</span>
              </span>
              {tokens.reasoning > 0 && (
                <span className="text-muted-foreground">
                  Think: <span className="text-foreground font-mono">{tokens.reasoning.toLocaleString()}</span>
                </span>
              )}
            </div>
            {cost !== undefined && cost > 0 && (
              <Badge variant="outline" className="font-mono text-[0.625rem]">
                ${cost.toFixed(4)}
              </Badge>
            )}
          </div>

          {/* Cache info */}
          {(tokens.cache.read > 0 || tokens.cache.write > 0) && (
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              {tokens.cache.read > 0 && (
                <span>
                  Cache read:{' '}
                  <span className="text-green-600 dark:text-green-400 font-mono">
                    {tokens.cache.read.toLocaleString()}
                  </span>
                </span>
              )}
              {tokens.cache.write > 0 && (
                <span>
                  Cache write:{' '}
                  <span className="text-blue-600 dark:text-blue-400 font-mono">
                    {tokens.cache.write.toLocaleString()}
                  </span>
                </span>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// Reasoning section
function ReasoningSection({ reasoning }: { reasoning: ReasoningPart[] }) {
  const combinedReasoning = reasoning.map((r) => r.text).join('\n')

  if (!combinedReasoning) return null

  return (
    <Card size="sm" className="border-dashed border-purple-500/30 bg-purple-500/5">
      <CardHeader className="pb-2">
        <CardTitle className="text-xs flex items-center gap-2">
          <span>💭</span>
          <span>Reasoning</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <ScrollArea className="max-h-[150px]">
          <p className="text-xs text-muted-foreground whitespace-pre-wrap">{combinedReasoning}</p>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}

// Elapsed time display
function ElapsedTime({ startTime }: { startTime: number }) {
  const [elapsed, setElapsed] = React.useState(0)

  React.useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(Date.now() - startTime)
    }, 1000)
    return () => clearInterval(interval)
  }, [startTime])

  const seconds = Math.floor(elapsed / 1000)
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60

  return (
    <span className="text-xs text-muted-foreground font-mono">
      {minutes > 0 ? `${minutes}m ${remainingSeconds}s` : `${remainingSeconds}s`}
    </span>
  )
}

export function ActivityFeed({
  tools,
  reasoning,
  tokenInfo,
  cost,
  isStreaming = false,
  startTime,
  className,
  statusEvents,
}: ActivityFeedProps) {
  // Group tools by status
  const { runningTools, completedTools, errorTools, pendingTools } = useMemo(() => {
    const running: ToolPart[] = []
    const completed: ToolPart[] = []
    const errors: ToolPart[] = []
    const pending: ToolPart[] = []

    for (const tool of tools) {
      switch (tool.state.status) {
        case 'running':
          running.push(tool)
          break
        case 'completed':
          completed.push(tool)
          break
        case 'error':
          errors.push(tool)
          break
        case 'pending':
          pending.push(tool)
          break
      }
    }

    return {
      runningTools: running,
      completedTools: completed,
      errorTools: errors,
      pendingTools: pending,
    }
  }, [tools])

  const hasTools = tools.length > 0
  const hasReasoning = reasoning && reasoning.length > 0
  const hasStatusEvents = statusEvents && statusEvents.length > 0

  return (
    <div className={cn('space-y-4', className)}>
      {/* Header with streaming indicator and elapsed time */}
      <div className="flex items-center justify-between">
        {isStreaming ? <StreamingIndicator /> : <span className="text-xs text-muted-foreground">Activity</span>}
        {startTime && <ElapsedTime startTime={startTime} />}
      </div>

      {/* Status timeline - shows initialization progress */}
      {hasStatusEvents && <StatusTimeline events={statusEvents} isStreaming={isStreaming} />}

      {/* Token/cost summary */}
      {tokenInfo && <TokenSummary tokens={tokenInfo} cost={cost} contextLimit={tokenInfo.contextLimit} />}

      {/* Reasoning section */}
      {hasReasoning && <ReasoningSection reasoning={reasoning!} />}

      {/* Tools grouped by status */}
      {hasTools && (
        <div className="space-y-3">
          {/* Running tools (always first) */}
          {runningTools.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant="default" className="animate-pulse bg-blue-500">
                  Running ({runningTools.length})
                </Badge>
              </div>
              {runningTools.map((tool) => (
                <ToolCard key={tool.id} id={tool.id} tool={tool.tool} state={tool.state} />
              ))}
            </div>
          )}

          {/* Pending tools */}
          {pendingTools.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant="outline">Pending ({pendingTools.length})</Badge>
              </div>
              {pendingTools.map((tool) => (
                <ToolCard key={tool.id} id={tool.id} tool={tool.tool} state={tool.state} />
              ))}
            </div>
          )}

          {/* Separator between active and finished */}
          {(runningTools.length > 0 || pendingTools.length > 0) &&
            (completedTools.length > 0 || errorTools.length > 0) && <Separator className="my-3" />}

          {/* Error tools */}
          {errorTools.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant="destructive">Errors ({errorTools.length})</Badge>
              </div>
              {errorTools.map((tool) => (
                <ToolCard key={tool.id} id={tool.id} tool={tool.tool} state={tool.state} />
              ))}
            </div>
          )}

          {/* Completed tools */}
          {completedTools.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="bg-green-500/10 text-green-600 dark:text-green-400">
                  Completed ({completedTools.length})
                </Badge>
              </div>
              <ScrollArea className="max-h-[400px]">
                <div className="space-y-2 pr-3">
                  {completedTools.map((tool) => (
                    <ToolCard key={tool.id} id={tool.id} tool={tool.tool} state={tool.state} />
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}
        </div>
      )}

      {/* Empty state */}
      {!hasTools && !hasReasoning && !hasStatusEvents && !isStreaming && (
        <div className="text-center py-8 text-muted-foreground text-sm">No activity yet</div>
      )}
    </div>
  )
}

export type { ActivityFeedProps }
