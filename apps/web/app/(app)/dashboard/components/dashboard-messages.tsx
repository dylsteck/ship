'use client'

import { useRef, useEffect } from 'react'
import { cn } from '@ship/ui'
import { ActivityFeed } from '@/components/chat/activity-feed'
import type { Message } from '@/lib/api'
import type { ToolPart as SSEToolPart, ReasoningPart, StepFinishPart } from '@/lib/sse-types'

// Simple ToolPart type for backward compatibility
type ToolPart = {
  type: 'tool'
  callID: string
  tool: string
  state: {
    title: string
    status?: 'pending' | 'running' | 'complete' | 'error'
  }
}

interface DashboardMessagesProps {
  activeSessionId: string | null
  messages: Message[]
  isStreaming: boolean
  activityTools: SSEToolPart[]
  reasoningParts: ReasoningPart[]
  thinkingParts: ToolPart[]
  thinkingReasoning: string
  thinkingStatus: string
  thinkingExpanded: boolean
  onToggleThinking: () => void
  lastStepCost: { cost: number; tokens: StepFinishPart['tokens'] } | null
  statusEvents: Array<{ status: string; message: string; time: number }>
  streamStartTime: number | null
}

export function DashboardMessages({
  activeSessionId,
  messages,
  isStreaming,
  activityTools,
  reasoningParts,
  thinkingParts,
  thinkingReasoning,
  thinkingStatus,
  thinkingExpanded,
  onToggleThinking,
  lastStepCost,
  statusEvents,
  streamStartTime,
}: DashboardMessagesProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (activeSessionId && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, activeSessionId, isStreaming])

  if (!activeSessionId) return null

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-6 space-y-4">
      {messages.length === 0 && isStreaming && (
        <div className="flex justify-center py-12 animate-in fade-in-0 duration-500">
          <div className="flex items-center gap-3 text-muted-foreground">
            <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
            <span className="text-sm">Starting session...</span>
          </div>
        </div>
      )}

      {messages.map((message) => {
        if (message.role === 'assistant' && !message.content && isStreaming) {
          return null
        }

        return (
          <div
            key={message.id}
            className={cn(
              'flex animate-in fade-in-0 slide-in-from-bottom-2 duration-300',
              message.role === 'user' ? 'justify-end' : 'justify-start',
            )}
          >
            <div
              className={cn(
                'max-w-[85%] rounded-2xl px-4 py-3',
                message.role === 'user'
                  ? 'bg-foreground text-background'
                  : message.role === 'system'
                    ? 'bg-muted/50 text-muted-foreground text-sm'
                    : 'bg-muted/30',
              )}
            >
              <p className="whitespace-pre-wrap text-[15px] leading-relaxed">{message.content}</p>
            </div>
          </div>
        )
      })}

      {isStreaming && (activityTools.length > 0 || thinkingStatus || statusEvents.length > 0) && (
        <div className="animate-in fade-in-0 slide-in-from-bottom-2 duration-300">
          <ActivityFeed
            tools={activityTools}
            reasoning={reasoningParts}
            tokenInfo={lastStepCost?.tokens}
            cost={lastStepCost?.cost}
            isStreaming={isStreaming}
            startTime={streamStartTime || undefined}
            statusEvents={statusEvents}
          />
        </div>
      )}

      {isStreaming && messages.length > 0 && activityTools.length === 0 && thinkingParts.length > 0 && (
        <div className="animate-in fade-in-0 slide-in-from-bottom-2 duration-300">
          <div className="rounded-lg border border-border bg-muted/30 p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              <span>{thinkingStatus || 'Thinking...'}</span>
            </div>
            {thinkingReasoning && (
              <div className="mt-2 text-xs text-muted-foreground whitespace-pre-wrap">{thinkingReasoning}</div>
            )}
          </div>
        </div>
      )}

      <div ref={messagesEndRef} />
    </div>
  )
}
