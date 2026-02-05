'use client'

import { useRef, useEffect, useState } from 'react'
import { Message, Tool, Reasoning, Shimmer, Response, Loader, Task, ChainOfThought } from '@ship/ui'
import { Button } from '@ship/ui'
import { Markdown } from '@/components/chat/markdown'
import { ErrorMessage } from '@/components/chat/error-message'
import type { Message as ChatMessage } from '@/lib/api'
import type { ToolPart as SSEToolPart, ReasoningPart, StepFinishPart } from '@/lib/sse-types'
import { buildChainOfThoughtSteps } from '@/lib/ai-elements-adapter'
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
  sessionTodos?: Array<{
    id: string
    content: string
    status: 'pending' | 'in_progress' | 'completed' | 'cancelled'
    priority: 'high' | 'medium' | 'low'
  }>
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
  sessionTodos = [],
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

  // Group status events by type for better display
  const permissionEvents = statusEvents.filter((e) => e.status.startsWith('permission.'))
  const questionEvents = statusEvents.filter((e) => e.status.startsWith('question.'))
  const fileChangeEvents = statusEvents.filter((e) => e.status === 'file-changed')
  const sessionEvents = statusEvents.filter((e) => e.status.startsWith('session-') || e.status === 'session-updated')
  const systemEvents = statusEvents.filter(
    (e) =>
      !e.status.startsWith('tool-call') &&
      !e.status.startsWith('session-') &&
      !e.status.startsWith('permission.') &&
      !e.status.startsWith('question.') &&
      e.status !== 'file-changed' &&
      e.status !== 'opencode-ready',
  )

  // Build chain of thought steps from tools and reasoning
  const chainSteps = buildChainOfThoughtSteps(activityTools, reasoningParts)

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
          >
            {/* User messages - plain text */}
            {message.role === 'user' && message.content && (
              <div className="text-foreground whitespace-pre-wrap">{message.content}</div>
            )}
            {/* Assistant messages - markdown */}
            {message.role === 'assistant' && message.content && (
              <Response>
                <Markdown content={message.content} />
              </Response>
            )}
          </Message>
        )
      })}

      {/* Streaming activity: tools + reasoning */}
      {isStreaming && (activityTools.length > 0 || thinkingReasoning || chainSteps.length > 0) && (
        <SubagentActivity
          activityTools={activityTools}
          chainSteps={chainSteps}
          thinkingReasoning={thinkingReasoning}
          thinkingStatus={thinkingStatus}
          isStreaming={isStreaming}
          streamStartTime={streamStartTime}
        />
      )}

      {/* Permission Requests */}
      {permissionEvents.length > 0 && (
        <Message role="assistant">
          {permissionEvents.map((event, idx) => {
            const isAsked = event.status === 'permission.asked'
            const isGranted = event.status === 'permission.granted'
            const isDenied = event.status === 'permission.denied'

            return (
              <div
                key={`${event.status}-${idx}`}
                className={`border rounded-lg p-4 ${
                  isAsked
                    ? 'border-yellow-500/50 bg-yellow-50 dark:bg-yellow-950/20'
                    : isGranted
                      ? 'border-green-500/50 bg-green-50 dark:bg-green-950/20'
                      : 'border-red-500/50 bg-red-50 dark:bg-red-950/20'
                }`}
              >
                <div className="flex items-start gap-3">
                  <span className={isAsked ? 'text-yellow-600' : isGranted ? 'text-green-600' : 'text-red-600'}>
                    {isAsked ? '🔒' : isGranted ? '✅' : '❌'}
                  </span>
                  <div className="flex-1">
                    <div className="font-medium text-foreground mb-1">
                      {isAsked ? 'Permission Request' : isGranted ? 'Permission Granted' : 'Permission Denied'}
                    </div>
                    <div className="text-sm text-muted-foreground mb-3">{event.message}</div>
                    {isAsked && (
                      <div className="flex gap-2">
                        <Button variant="default" size="sm">
                          Approve
                        </Button>
                        <Button variant="outline" size="sm">
                          Deny
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </Message>
      )}

      {/* Questions */}
      {questionEvents.length > 0 && (
        <Message role="assistant">
          {questionEvents.map((event, idx) => {
            const isAsked = event.status === 'question.asked'
            const isReplied = event.status === 'question.replied'
            const isRejected = event.status === 'question.rejected'

            return (
              <div
                key={`${event.status}-${idx}`}
                className={`border rounded-lg p-4 ${
                  isAsked
                    ? 'border-blue-500/50 bg-blue-50 dark:bg-blue-950/20'
                    : isReplied
                      ? 'border-green-500/50 bg-green-50 dark:bg-green-950/20'
                      : 'border-gray-500/50 bg-gray-50 dark:bg-gray-950/20'
                }`}
              >
                <div className="flex items-start gap-3">
                  <span className={isAsked ? 'text-blue-600' : isReplied ? 'text-green-600' : 'text-gray-600'}>
                    {isAsked ? '❓' : isReplied ? '✅' : '⏭️'}
                  </span>
                  <div className="flex-1">
                    <div className="font-medium text-foreground mb-2">{event.message}</div>
                    {isAsked && (
                      <div className="flex gap-2">
                        <Button variant="default" size="sm">
                          Reply
                        </Button>
                        <Button variant="outline" size="sm">
                          Skip
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </Message>
      )}

      {/* File Changes */}
      {fileChangeEvents.length > 0 && (
        <Message role="assistant">
          <div className="space-y-1">
            {fileChangeEvents.map((event, idx) => {
              const parts = event.message.split(': ')
              const action = parts[0] || 'modify'
              const filename = parts[1] || ''
              const icon = action === 'create' ? '📝' : action === 'modify' ? '✏️' : '🗑️'

              return (
                <div key={`file-${idx}`} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>{icon}</span>
                  <span className="font-mono text-xs">{filename}</span>
                  <span className="text-xs">{action}</span>
                </div>
              )
            })}
          </div>
        </Message>
      )}

      {/* Session Updates */}
      {sessionEvents.length > 0 && (
        <Message role="assistant">
          <div className="space-y-1">
            {sessionEvents.map((event, idx) => (
              <div key={`session-${idx}`} className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>📝</span>
                <span>{event.message}</span>
              </div>
            ))}
          </div>
        </Message>
      )}

      {/* OpenCode URL Ready */}
      {statusEvents.some((e) => e.status === 'opencode-ready') && (
        <Message role="assistant">
          <div className="border border-green-500/50 bg-green-50 dark:bg-green-950/20 rounded-lg p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-green-600">🔗</span>
                <span className="text-sm font-medium text-foreground">OpenCode Server Ready</span>
              </div>
            </div>
          </div>
        </Message>
      )}

      {/* Todos */}
      {sessionTodos.length > 0 && (
        <Message role="assistant">
          <div className="space-y-2">
            {sessionTodos.map((todo) => {
              const statusMap: Record<string, 'pending' | 'in_progress' | 'completed' | 'failed'> = {
                pending: 'pending',
                in_progress: 'in_progress',
                completed: 'completed',
                cancelled: 'failed',
              }
              return (
                <Task
                  key={todo.id}
                  title={todo.content}
                  status={statusMap[todo.status] || 'pending'}
                  description={todo.priority !== 'medium' ? `Priority: ${todo.priority}` : undefined}
                />
              )
            })}
          </div>
        </Message>
      )}

      {/* System Events */}
      {systemEvents.length > 0 && (
        <Message role="assistant">
          <div className="space-y-1">
            {systemEvents.map((event, idx) => (
              <div key={`system-${idx}`} className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className="w-2 h-2 rounded-full bg-muted-foreground/30" />
                <span>{event.message}</span>
              </div>
            ))}
          </div>
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

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${minutes}m, ${secs}s`
}

interface SubagentActivityProps {
  activityTools: SSEToolPart[]
  chainSteps: ReturnType<typeof buildChainOfThoughtSteps>
  thinkingReasoning: string
  thinkingStatus: string
  isStreaming: boolean
  streamStartTime: number | null
}

function SubagentActivity({
  activityTools,
  chainSteps,
  thinkingReasoning,
  thinkingStatus,
  isStreaming,
  streamStartTime,
}: SubagentActivityProps) {
  const [expanded, setExpanded] = useState(false)
  
  // Get unique tool names for pill display
  const uniqueTools = Array.from(new Set(activityTools.map((t) => t.tool)))
  
  // Calculate duration
  const duration = streamStartTime ? Math.floor((Date.now() - streamStartTime) / 1000) : 0
  const durationText = duration > 0 ? formatDuration(duration) : null
  
  // Determine activity summary from status or tool names
  const activitySummary = thinkingStatus || (uniqueTools.length > 0 ? uniqueTools[0] : 'Working...')
  
  // Group tools by name for display
  const toolsByType = activityTools.reduce((acc, tool) => {
    if (!acc[tool.tool]) {
      acc[tool.tool] = []
    }
    acc[tool.tool].push(tool)
    return acc
  }, {} as Record<string, SSEToolPart[]>)

  return (
    <Message role="assistant">
      {/* Tools displayed above as pills */}
      {uniqueTools.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {uniqueTools.map((toolName) => {
            const tools = toolsByType[toolName]
            const latestTool = tools[tools.length - 1]
            const status = mapToolStatus(latestTool.state.status)
            const isActive = status === 'in_progress' || status === 'pending'
            
            return (
              <div
                key={toolName}
                className={`
                  inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium
                  ${isActive 
                    ? 'bg-primary/10 text-primary border border-primary/20' 
                    : 'bg-muted text-muted-foreground border border-border'
                  }
                `}
              >
                {isActive && (
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary/40 opacity-75" />
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-primary" />
                  </span>
                )}
                <span>{toolName}</span>
              </div>
            )
          })}
        </div>
      )}

      {/* Activity summary with expandable steps */}
      {(chainSteps.length > 0 || activityTools.length > 0 || thinkingReasoning) && (
        <div className="border border-border rounded-lg overflow-hidden">
          {/* Summary header - clickable to expand */}
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors text-left"
          >
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 bg-foreground text-background rounded-full text-xs font-medium">
                {activitySummary}
              </span>
              {durationText && (
                <span className="text-xs text-muted-foreground ml-1">{durationText}</span>
              )}
            </div>
            <svg
              className={`w-4 h-4 text-muted-foreground transition-transform ${expanded ? 'rotate-180' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {/* Expanded content */}
          {expanded && (
            <div className="px-4 pb-4 space-y-3 border-t border-border">
              {/* Chain of Thought steps */}
              {chainSteps.length > 0 && (
                <div>
                  <div className="text-xs font-medium text-muted-foreground mb-2">Steps</div>
                  <ChainOfThought steps={chainSteps} />
                </div>
              )}

              {/* Reasoning */}
              {thinkingReasoning && (
                <div>
                  <div className="text-xs font-medium text-muted-foreground mb-2">Reasoning</div>
                  <Reasoning isStreaming={isStreaming}>
                    {thinkingReasoning}
                  </Reasoning>
                </div>
              )}

              {/* Detailed tool calls */}
              {activityTools.length > 0 && (
                <div>
                  <div className="text-xs font-medium text-muted-foreground mb-2">Tool Calls</div>
                  <div className="space-y-2">
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
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Status when no tools/reasoning yet */}
      {!thinkingReasoning && activityTools.length === 0 && chainSteps.length === 0 && thinkingStatus && (
        <Loader message={thinkingStatus} />
      )}
    </Message>
  )
}
