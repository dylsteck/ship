'use client'

import * as React from 'react'
import {
  Message,
  Tool,
  Response,
  Loader,
  ThinkingBlock,
  SessionSetup,
  Conversation,
  ConversationScrollButton,
} from '@ship/ui'
import { Markdown } from '@/components/chat/markdown'
import { mapToolState } from '@/lib/ai-elements-adapter'
import { useSubagentStream } from '../hooks/use-subagent-stream'
import { MessageToolList } from './messages/tool-list'

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
  parentSessionId: string | null
}

function formatDuration(ms: number): string {
  if (ms >= 60000) {
    const mins = Math.floor(ms / 60000)
    const secs = ((ms % 60000) / 1000).toFixed(0)
    return `${mins}m ${secs}s`
  }
  return `${(ms / 1000).toFixed(1)}s`
}

export function SubagentView({ subagent, onBack, parentSessionId }: SubagentViewProps) {
  const { messages, isStreaming, status, statusSteps } = useSubagentStream({
    parentSessionId,
    subagentSessionId: subagent.sessionId || null,
  })

  // Show stream area when we're connected and have stream state (even if just placeholder)
  const hasStreamData = subagent.sessionId && messages.length > 0

  // Determine what to show
  const showStreamData = hasStreamData
  const showResultFallback = !showStreamData && subagent.resultText
  const showChildToolsFallback = !showStreamData && subagent.childTools && subagent.childTools.length > 0

  return (
    <div className="flex flex-col h-full">
      {/* Compact inline bar: Back + label */}
      <div className="flex items-center gap-2 px-4 py-1.5 text-xs">
        <button
          type="button"
          onClick={onBack}
          className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
        >
          ← Back
        </button>
        <span className="text-muted-foreground/60">·</span>
        <span className="text-muted-foreground truncate min-w-0">
          {subagent.description || subagent.agentType}
          {isStreaming && status && ` · ${status}`}
          {subagent.duration && !isStreaming && ` · ${formatDuration(subagent.duration)}`}
        </span>
      </div>

      {/* Content */}
      <Conversation className="flex-1 min-h-0">
        <div className="mx-auto w-full max-w-4xl px-4 py-4 sm:px-6 sm:py-5">
          {/* Agent prompt — compact */}
          {subagent.prompt && (
            <div className="mb-4">
              <div className="text-sm text-foreground/80 leading-relaxed rounded-md px-3 py-2.5 bg-muted/15 border border-border/20">
                {subagent.prompt}
              </div>
            </div>
          )}

          {/* Live streaming content from child session (priority 1) — same structure as main page */}
          {showStreamData && (
            <div className="space-y-4">
              {/* Session setup steps (like main page) */}
              {statusSteps.length > 0 && (
                <SessionSetup
                  steps={statusSteps}
                  isStreaming={isStreaming}
                  defaultOpen={isStreaming}
                />
              )}
              {/* Empty streaming message → show Loader with status (like main page) */}
              {messages.length === 1 &&
                !messages[0].content &&
                !messages[0].toolInvocations?.length &&
                !messages[0].reasoning?.length &&
                isStreaming &&
                statusSteps.length === 0 && (
                  <Message role="assistant">
                    <Loader message={status || 'Thinking...'} />
                  </Message>
                )}
              {/* Messages with content — use ThinkingBlock + tools (like main page) */}
              {messages
                .filter(
                  (m) =>
                    m.content || m.toolInvocations?.length || m.reasoning?.length,
                )
                .map((message) => {
                  const allReasoning = message.reasoning || []
                  const allTools = message.toolInvocations || []
                  const hasReasoning = allReasoning.length > 0
                  const hasTools = allTools.length > 0

                  return (
                    <Message key={message.id} role={message.role}>
                      {(hasReasoning || hasTools) && (
                        <ThinkingBlock
                          reasoning={allReasoning}
                          isStreaming={isStreaming}
                          duration={
                            message.elapsed != null
                              ? Math.floor(message.elapsed / 1000)
                              : undefined
                          }
                        >
                          {hasTools && (
                            <MessageToolList
                              tools={allTools}
                              sessionTodos={[]}
                              todoRenderedRef={{ current: false }}
                              onSubagentNavigate={() => {}}
                            />
                          )}
                        </ThinkingBlock>
                      )}
                      {message.role === 'assistant' && message.content && (
                        <div className={hasTools ? 'mt-4' : undefined}>
                          <Response>
                            <Markdown content={message.content} isAnimating={isStreaming} />
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
                    <Markdown content={subagent.resultText} isAnimating={false} />
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
              <div className="flex items-center gap-3 text-sm text-muted-foreground/70">
                {(subagent.toolStatus === 'in_progress' || subagent.toolStatus === 'pending') && (
                  <span className="h-4 w-4 shrink-0 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
                )}
                {subagent.toolStatus === 'in_progress' || subagent.toolStatus === 'pending'
                  ? 'Thinking...'
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
