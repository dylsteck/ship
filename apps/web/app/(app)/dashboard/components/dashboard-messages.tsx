'use client'

import { useRef, useEffect, useState } from 'react'
import { Message, Tool, Reasoning, Shimmer, Response, Loader } from '@ship/ui'
import { Markdown } from '@/components/chat/markdown'
import { ErrorMessage } from '@/components/chat/error-message'
import type { Message as ChatMessage } from '@/lib/api'
import type { ToolPart as SSEToolPart, ReasoningPart, StepFinishPart } from '@/lib/sse-types'
interface DashboardMessagesProps {
  activeSessionId: string | null
  messages: ChatMessage[]
  isStreaming: boolean
  activityTools: SSEToolPart[]
  reasoningParts: ReasoningPart[]
  thinkingParts: Array<{
    type: 'tool'
    callID: string
    tool: string
    state: { title: string; status?: string }
  }>
  thinkingReasoning: string
  thinkingStatus: string
  thinkingExpanded: boolean
  onToggleThinking: () => void
  lastStepCost: { cost: number; tokens: StepFinishPart['tokens'] } | null
  statusEvents: Array<{ status: string; message: string; time: number }>
  streamStartTime: number | null
}

function mapToolStatus(status: string | undefined): 'pending' | 'in_progress' | 'completed' | 'failed' {
  switch (status) {
    case 'completed':
    case 'complete':
      return 'completed'
    case 'running':
      return 'in_progress'
    case 'error':
      return 'failed'
    default:
      return 'pending'
  }
}

export function DashboardMessages({
  activeSessionId,
  messages,
  isStreaming,
  activityTools,
  reasoningParts,
  thinkingReasoning,
  thinkingStatus,
  lastStepCost,
  statusEvents,
  streamStartTime,
}: DashboardMessagesProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (activeSessionId && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, activeSessionId, isStreaming, activityTools])

  if (!activeSessionId) return null

  // Show setup status (provisioning, cloning, etc.) before any messages
  const setupEvents = statusEvents.filter(
    (e) => !e.status.startsWith('tool-call') && !e.status.startsWith('session-'),
  )
  const hasMessages = messages.some((m) => m.content)

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-6">
      {/* Setup status - only show before messages arrive */}
      {isStreaming && setupEvents.length > 0 && !hasMessages && (
        <Message role="assistant">
          <div className="space-y-1.5">
            {setupEvents.map((event, idx) => {
              const isLast = idx === setupEvents.length - 1
              return (
                <div
                  key={`${event.status}-${idx}`}
                  className="flex items-center gap-2 text-sm text-muted-foreground"
                >
                  {isLast && isStreaming ? (
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary/40 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
                    </span>
                  ) : (
                    <span className="w-2 h-2 rounded-full bg-green-500" />
                  )}
                  <span>{event.message}</span>
                  {isLast && streamStartTime && (
                    <ElapsedTime startTime={streamStartTime} />
                  )}
                </div>
              )
            })}
          </div>
        </Message>
      )}

      {/* Messages */}
      {messages.map((message) => {
        // Skip empty assistant messages that are still streaming
        if (message.role === 'assistant' && !message.content && isStreaming) {
          return null
        }

        const isError = message.type === 'error'

        if (isError) {
          return (
            <div key={message.id} className="px-4 py-2">
              <ErrorMessage
                message={message.content}
                category={message.errorCategory || 'persistent'}
                retryable={message.retryable || false}
              />
            </div>
          )
        }

        return (
          <Message
            key={message.id}
            role={message.role as 'user' | 'assistant'}
            avatar={message.role === 'user' ? <UserAvatar /> : undefined}
          >
            {message.content ? (
              <Response>
                <Markdown content={message.content} />
              </Response>
            ) : null}
          </Message>
        )
      })}

      {/* Streaming activity: tools + reasoning */}
      {isStreaming && (activityTools.length > 0 || thinkingReasoning) && (
        <Message role="assistant">
          {/* Reasoning */}
          {thinkingReasoning && (
            <Reasoning isStreaming={isStreaming}>
              {thinkingReasoning}
            </Reasoning>
          )}

          {/* Active tools - show each unique tool once */}
          {activityTools.length > 0 && (
            <div className="space-y-1">
              {activityTools.map((tool) => (
                <Tool
                  key={tool.callID}
                  name={tool.tool}
                  status={mapToolStatus(tool.state.status)}
                  input={tool.state.input || {}}
                  output={tool.state.output}
                  duration={
                    tool.state.time?.start && tool.state.time?.end
                      ? tool.state.time.end - tool.state.time.start
                      : undefined
                  }
                />
              ))}
            </div>
          )}

          {/* Current status label */}
          {!thinkingReasoning && activityTools.length === 0 && thinkingStatus && (
            <Loader message={thinkingStatus} />
          )}
        </Message>
      )}

      {/* Streaming with no activity yet */}
      {isStreaming && !thinkingReasoning && activityTools.length === 0 && setupEvents.length === 0 && messages.length > 0 && (
        <Message role="assistant">
          <Loader message={thinkingStatus || 'Thinking...'} />
        </Message>
      )}

      <div ref={messagesEndRef} />
    </div>
  )
}

function UserAvatar() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
      />
    </svg>
  )
}

function ElapsedTime({ startTime }: { startTime: number }) {
  const elapsed = useElapsed(startTime)
  if (elapsed < 1) return null
  return <span className="text-xs text-muted-foreground/60 ml-auto">{elapsed}s</span>
}

function useElapsed(startTime: number) {
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000))
    }, 1000)
    return () => clearInterval(interval)
  }, [startTime])
  return elapsed
}
