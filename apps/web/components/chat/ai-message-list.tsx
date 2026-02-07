'use client'

import { Message, Reasoning, Tool, Shimmer, Response, Loader, Conversation, ConversationScrollButton } from '@ship/ui'
import { ErrorMessage } from './error-message'
import { Markdown } from './markdown'
import { cn } from '@ship/ui'
import { SubagentSheet } from './subagent-sheet'
import { SubagentProvider, useSubagent } from '@/lib/subagent/subagent-context'
import { isSubagentToolInvocation, extractSubagentSessionId } from '@/lib/subagent/utils'
import type { UIMessage, ToolInvocation } from '@/lib/ai-elements-adapter'

interface AIMessageListProps {
  messages: UIMessage[]
  isStreaming?: boolean
  streamingMessageId?: string | null
  streamingLabel?: string
  onRetryError?: (messageId: string) => void
  onOpenVSCode?: () => void
  onOpenTerminal?: () => void
  className?: string
}

function mapToolState(state: string): 'pending' | 'in_progress' | 'completed' | 'failed' {
  switch (state) {
    case 'partial-call':
      return 'pending'
    case 'call':
      return 'in_progress'
    case 'result':
      return 'completed'
    case 'error':
      return 'failed'
    default:
      return 'pending'
  }
}

// Inner component that uses the subagent context
function MessageListContent({
  messages,
  isStreaming,
  streamingMessageId,
  streamingLabel,
  onRetryError,
  onOpenVSCode,
  onOpenTerminal,
  className,
}: AIMessageListProps) {
  const { openSubagent, closeSubagent, viewState } = useSubagent()

  const handleViewSubagent = (sessionId: string, toolCallId: string, toolName: string) => {
    openSubagent(sessionId, toolCallId, toolName)
  }

  if (messages.length === 0 && !isStreaming) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center">
          <svg
            className="mx-auto h-12 w-12 text-muted-foreground"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
            />
          </svg>
          <h3 className="mt-4 text-sm font-medium text-foreground">No messages yet</h3>
          <p className="mt-1 text-sm text-muted-foreground">Start a conversation to see messages here.</p>
        </div>
      </div>
    )
  }

  return (
    <>
      <Conversation className={cn('flex-1', className)}>
        <div className="max-w-3xl mx-auto py-6">
          {messages.map((msg) => {
            // Handle error messages
            if (msg.type === 'error') {
              return (
                <div key={msg.id} className="px-4 py-2">
                  <ErrorMessage
                    message={msg.content}
                    category={msg.errorCategory || 'persistent'}
                    retryable={msg.retryable || false}
                    onRetry={onRetryError ? () => onRetryError(msg.id) : undefined}
                    onOpenVSCode={onOpenVSCode}
                    onOpenTerminal={onOpenTerminal}
                  />
                </div>
              )
            }

            const isCurrentlyStreaming = msg.id === streamingMessageId

            return (
              <Message key={msg.id} role={msg.role}>
                {/* User messages */}
                {msg.role === 'user' && msg.content && (
                  <div className="text-foreground whitespace-pre-wrap">{msg.content}</div>
                )}

                {/* Assistant reasoning */}
                {msg.role === 'assistant' && msg.reasoning && msg.reasoning.length > 0 && (
                  <Reasoning isStreaming={isCurrentlyStreaming}>{msg.reasoning.join('\n\n')}</Reasoning>
                )}

                {/* Assistant tools - inline */}
                {msg.role === 'assistant' && msg.toolInvocations && msg.toolInvocations.length > 0 && (
                  <div className="space-y-1">
                    {msg.toolInvocations.map((tool) => {
                      const sessionId = extractSubagentSessionId(tool)
                      const isSubagent = isSubagentToolInvocation(tool)

                      return (
                        <Tool
                          key={tool.toolCallId}
                          name={tool.toolName}
                          status={mapToolState(tool.state)}
                          input={tool.args}
                          output={tool.result}
                          duration={tool.duration}
                          sessionId={sessionId || undefined}
                          onViewSubagent={
                            isSubagent && sessionId
                              ? (sid) => handleViewSubagent(sid, tool.toolCallId, tool.toolName)
                              : undefined
                          }
                          subagentLabel="View details"
                        />
                      )
                    })}
                  </div>
                )}

                {/* Assistant response content */}
                {msg.role === 'assistant' && msg.content && (
                  <Response>
                    {isCurrentlyStreaming ? (
                      <Shimmer>
                        <Markdown content={msg.content} />
                      </Shimmer>
                    ) : (
                      <Markdown content={msg.content} />
                    )}
                  </Response>
                )}

                {/* Loading state for empty streaming message */}
                {msg.role === 'assistant' &&
                  isCurrentlyStreaming &&
                  !msg.content &&
                  !msg.toolInvocations?.length &&
                  !msg.reasoning?.length && <Loader message={streamingLabel || 'Thinking...'} />}
              </Message>
            )
          })}
        </div>

        <ConversationScrollButton />
      </Conversation>

      {/* Subagent Detail Sheet */}
      <SubagentSheet
        sessionId={viewState.sessionId || undefined}
        toolName={viewState.toolName}
        isOpen={viewState.isOpen}
        onClose={closeSubagent}
      />
    </>
  )
}

// Wrapper component that provides the SubagentProvider
export function AIMessageList(props: AIMessageListProps) {
  return (
    <SubagentProvider>
      <MessageListContent {...props} />
    </SubagentProvider>
  )
}
