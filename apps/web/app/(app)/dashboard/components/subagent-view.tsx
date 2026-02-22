'use client'

import * as React from 'react'
import { Message, Tool, Response, Loader, Conversation, ConversationScrollButton } from '@ship/ui'
import { Markdown } from '@/components/chat/markdown'
import { mapToolState } from '@/lib/ai-elements-adapter'
import { useSubagentStream } from '../hooks/use-subagent-stream'

interface SubagentViewState {
  toolCallId: string
  agentType: string
  description: string
  prompt?: string
  resultText?: string
  sessionId?: string
  childTools?: { name: string; status: string; title?: string }[]
  toolStatus?: 'pending' | 'in_progress' | 'completed' | 'failed'
  duration?: number
}

interface SubagentViewProps {
  subagent: SubagentViewState
  onBack: () => void
}

function formatDuration(ms: number): string {
  if (ms >= 60000) {
    const mins = Math.floor(ms / 60000)
    const secs = ((ms % 60000) / 1000).toFixed(0)
    return `${mins}m ${secs}s`
  }
  return `${(ms / 1000).toFixed(1)}s`
}

export function SubagentView({ subagent, onBack }: SubagentViewProps) {
  // Only try WebSocket if we have a sessionId
  const { messages, isStreaming, status } = useSubagentStream({
    sessionId: subagent.sessionId || null,
  })

  const hasStreamData = subagent.sessionId && messages.some(
    (m) => m.content || m.toolInvocations?.length || m.reasoning?.length,
  )

  // Determine what to show
  const showStreamData = hasStreamData
  const showResultFallback = !showStreamData && subagent.resultText
  const showChildToolsFallback = !showStreamData && subagent.childTools && subagent.childTools.length > 0

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border/30 bg-background/80 backdrop-blur-sm sticky top-0 z-10">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>
        <div className="h-4 w-px bg-border/50" />
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <svg
            className="w-4 h-4 shrink-0 text-muted-foreground/70"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="3" y="3" width="7" height="7" rx="1" />
            <rect x="14" y="3" width="7" height="7" rx="1" />
            <rect x="3" y="14" width="7" height="7" rx="1" />
            <rect x="14" y="14" width="7" height="7" rx="1" />
          </svg>
          <span className="text-sm font-medium text-foreground truncate">
            {subagent.description || subagent.agentType}
          </span>
          <span className="text-xs text-muted-foreground/50 shrink-0">(@{subagent.agentType.toLowerCase().replace(/\s+/g, '-')} subagent)</span>
          {isStreaming && (
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary/40 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
            </span>
          )}
        </div>
        {subagent.duration && (
          <span className="text-xs text-muted-foreground/50 shrink-0">{formatDuration(subagent.duration)}</span>
        )}
      </div>

      {/* Content */}
      <Conversation className="flex-1">
        <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-8 sm:py-8">
          {/* Agent prompt */}
          {subagent.prompt && (
            <div className="mb-6">
              <div className="text-sm text-foreground/80 bg-muted/30 rounded-lg px-4 py-3 border border-border/20">
                {subagent.prompt}
              </div>
            </div>
          )}

          {/* Live streaming content from child session (priority 1) */}
          {showStreamData && (
            <div className="space-y-4">
              {status && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground/60">
                  {isStreaming && (
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary/50 opacity-75" />
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-primary/60" />
                    </span>
                  )}
                  {status}
                </div>
              )}
              {messages.map((message) => {
                if (!message.content && !message.toolInvocations?.length && !message.reasoning?.length) {
                  return isStreaming ? (
                    <Message key={message.id} role="assistant">
                      <Loader message={status || 'Working...'} />
                    </Message>
                  ) : null
                }

                const hasSteps =
                  message.role === 'assistant' &&
                  message.toolInvocations &&
                  message.toolInvocations.length > 0

                const hasOnlyReasoning =
                  message.role === 'assistant' &&
                  message.reasoning &&
                  message.reasoning.length > 0 &&
                  !message.toolInvocations?.length

                return (
                  <Message key={message.id} role={message.role}>
                    {hasOnlyReasoning && <Loader message={status || 'Thinking...'} />}
                    {hasSteps && message.toolInvocations && message.toolInvocations.length > 0 && (
                      <div className="space-y-2 my-1">
                        {message.toolInvocations.map((tool) => (
                          <Tool
                            key={tool.toolCallId}
                            name={tool.toolName}
                            status={mapToolState(tool.state)}
                            input={tool.args}
                            output={tool.result}
                            duration={tool.duration}
                          />
                        ))}
                      </div>
                    )}
                    {message.role === 'assistant' && message.content && (
                      <div className={hasSteps ? 'mt-4' : undefined}>
                        <Response>
                          <Markdown content={message.content} />
                        </Response>
                      </div>
                    )}
                  </Message>
                )
              })}
            </div>
          )}

          {/* Fallback: show child tools + result text (priority 2) */}
          {!showStreamData && (showChildToolsFallback || showResultFallback) && (
            <div className="space-y-4">
              {/* Child tools list */}
              {showChildToolsFallback && subagent.childTools && (
                <div className="space-y-2 my-1">
                  {subagent.childTools.map((tool, i) => (
                    <Tool
                      key={i}
                      name={tool.name}
                      status={tool.status === 'completed' ? 'completed' : tool.status === 'error' || tool.status === 'failed' ? 'failed' : 'completed'}
                      input={tool.title ? { description: tool.title } : undefined}
                    />
                  ))}
                </div>
              )}
              {/* Result text */}
              {showResultFallback && subagent.resultText && (
                <Message role="assistant">
                  <Response>
                    <Markdown content={subagent.resultText} />
                  </Response>
                </Message>
              )}
            </div>
          )}

          {/* Loading state when WebSocket is connecting */}
          {subagent.sessionId && !showStreamData && !showResultFallback && !showChildToolsFallback && (
            <Message role="assistant">
              <Loader message="Connecting to sub-agent session..." />
            </Message>
          )}

          {/* No data at all — shouldn't happen but handle gracefully */}
          {!subagent.sessionId && !showResultFallback && !showChildToolsFallback && (
            <Message role="assistant">
              <div className="text-sm text-muted-foreground/60">
                {subagent.toolStatus === 'in_progress' || subagent.toolStatus === 'pending'
                  ? <Loader message="Sub-agent is working..." />
                  : 'Sub-agent completed without output.'}
              </div>
            </Message>
          )}
        </div>
        <ConversationScrollButton />
      </Conversation>
    </div>
  )
}

export type { SubagentViewState }
