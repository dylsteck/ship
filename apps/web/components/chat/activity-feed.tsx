'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, cn } from '@ship/ui'
import type { ToolPart as SSEToolPart, ReasoningPart, StepFinishPart } from '@/lib/sse-types'

interface ActivityFeedProps {
  tools: SSEToolPart[]
  reasoning: ReasoningPart[]
  tokenInfo?: StepFinishPart['tokens']
  cost?: number
  isStreaming: boolean
  startTime?: number
  statusEvents: Array<{ status: string; message: string; time: number }>
}

export function ActivityFeed({
  tools,
  reasoning,
  tokenInfo,
  cost,
  isStreaming,
  startTime,
  statusEvents,
}: ActivityFeedProps) {
  const [elapsedTime, setElapsedTime] = useState(0)

  useEffect(() => {
    if (!isStreaming || !startTime) return

    const interval = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - startTime) / 1000))
    }, 1000)

    return () => clearInterval(interval)
  }, [isStreaming, startTime])

  // Show status events if we have them, even without tools
  const hasContent = statusEvents.length > 0 || tools.length > 0 || reasoning.length > 0

  if (!hasContent && !isStreaming) {
    return null
  }

  return (
    <Card className="w-full">
      <CardContent className="p-4 space-y-3">
        {/* Status Timeline */}
        {statusEvents.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs font-medium text-muted-foreground mb-2">Status</div>
            <div className="space-y-1.5">
              {statusEvents.map((event, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2 text-sm animate-in fade-in-0 slide-in-from-left-2"
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                  <span className="text-muted-foreground">{event.message}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Current Status */}
        {isStreaming && statusEvents.length > 0 && (
          <div className="flex items-center gap-2 text-sm">
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span className="text-muted-foreground">
              {statusEvents[statusEvents.length - 1]?.message || 'Processing...'}
            </span>
            {elapsedTime > 0 && (
              <span className="text-xs text-muted-foreground/60 ml-auto">{elapsedTime}s</span>
            )}
          </div>
        )}

        {/* Tools */}
        {tools.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs font-medium text-muted-foreground mb-2">Tools</div>
            <div className="space-y-1.5">
              {tools.map((tool) => (
                <div
                  key={tool.callID}
                  className="flex items-center gap-2 text-sm animate-in fade-in-0 slide-in-from-left-2"
                >
                  <div
                    className={cn(
                      'w-1.5 h-1.5 rounded-full',
                      tool.state.status === 'completed' ? 'bg-green-500' : 'bg-primary animate-pulse',
                    )}
                  />
                  <span className="text-muted-foreground">
                    {tool.tool}
                    {tool.state.title && `: ${tool.state.title}`}
                  </span>
                  {tool.state.status && (
                    <span className="text-xs text-muted-foreground/60 ml-auto capitalize">
                      {tool.state.status}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Reasoning */}
        {reasoning.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs font-medium text-muted-foreground mb-2">Reasoning</div>
            <div className="space-y-1.5">
              {reasoning.map((r) => (
                <div key={r.id} className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {r.text}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Cost & Tokens */}
        {(cost !== undefined || tokenInfo) && (
          <div className="pt-2 border-t border-border/50 flex items-center justify-between text-xs text-muted-foreground">
            {cost !== undefined && <span>Cost: ${cost.toFixed(4)}</span>}
            {tokenInfo && (
              <span>
                Tokens: {tokenInfo.input + tokenInfo.output + tokenInfo.reasoning} (
                {tokenInfo.input} in, {tokenInfo.output} out, {tokenInfo.reasoning} reasoning)
              </span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
