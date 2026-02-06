'use client'

import { Message, Tool, Reasoning, Shimmer, Response, Loader, Task, Conversation, ConversationScrollButton } from '@ship/ui'
import { Markdown } from '@/components/chat/markdown'
import { ErrorMessage } from '@/components/chat/error-message'
import { PermissionPrompt } from './permission-prompt'
import { QuestionPrompt } from './question-prompt'
import type { UIMessage } from '@/lib/ai-elements-adapter'
import { getStreamingStatus } from '@/lib/ai-elements-adapter'

interface DashboardMessagesProps {
  activeSessionId: string | null
  messages: UIMessage[]
  isStreaming: boolean
  streamingMessageId: string | null
  streamStartTime: number | null
  sessionTodos?: Array<{
    id: string
    content: string
    status: 'pending' | 'in_progress' | 'completed' | 'cancelled'
    priority: 'high' | 'medium' | 'low'
  }>
}

export function DashboardMessages({
  activeSessionId,
  messages,
  isStreaming,
  streamingMessageId,
  streamStartTime,
  sessionTodos = [],
}: DashboardMessagesProps) {
  if (!activeSessionId) return null

  const statusLabel = isStreaming ? getStreamingStatus(messages, streamingMessageId) : ''
  const hasContent = messages.some((m) => m.content || m.toolInvocations?.length)

  return (
    <Conversation className="h-full">
      <div className="mx-auto w-full max-w-3xl px-6 py-6">
        {/* Empty state */}
        {!hasContent && !isStreaming && (
          <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
            Send a message to start the conversation.
          </div>
        )}

        {/* Messages */}
        {messages.map((message) => {
          // Permission prompts
          if (message.type === 'permission' && message.promptData) {
            return (
              <div key={message.id} className="px-4 py-2">
                <PermissionPrompt
                  id={message.promptData.id}
                  permission={message.promptData.permission || ''}
                  description={message.promptData.description}
                  patterns={message.promptData.patterns}
                  status={message.promptData.status as 'pending' | 'granted' | 'denied'}
                />
              </div>
            )
          }

          // Question prompts
          if (message.type === 'question' && message.promptData) {
            return (
              <div key={message.id} className="px-4 py-2">
                <QuestionPrompt
                  id={message.promptData.id}
                  text={message.promptData.text || message.content}
                  status={message.promptData.status as 'pending' | 'replied' | 'rejected'}
                />
              </div>
            )
          }

          // Error messages
          if (message.type === 'error') {
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

          // PR notification
          if (message.type === 'pr-notification') {
            return (
              <Message key={message.id} role="system">
                <div className="border border-green-500/50 bg-green-50 dark:bg-green-950/20 rounded-lg p-3">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-green-600">&#x2714;</span>
                    <span className="text-foreground">{message.content}</span>
                  </div>
                </div>
              </Message>
            )
          }

          // Skip empty streaming assistant messages
          const isCurrentlyStreaming = message.id === streamingMessageId
          if (
            message.role === 'assistant' &&
            !message.content &&
            !message.toolInvocations?.length &&
            !message.reasoning?.length &&
            isCurrentlyStreaming
          ) {
            // Show loader for empty streaming message
            return (
              <Message key={message.id} role="assistant">
                <Loader message={statusLabel || 'Thinking...'} />
              </Message>
            )
          }

          // Skip truly empty messages
          if (!message.content && !message.toolInvocations?.length && !message.reasoning?.length) {
            return null
          }

          return (
            <Message key={message.id} role={message.role}>
              {/* User messages */}
              {message.role === 'user' && message.content && (
                <div className="text-foreground whitespace-pre-wrap">{message.content}</div>
              )}

              {/* Assistant reasoning - collapsible */}
              {message.role === 'assistant' && message.reasoning && message.reasoning.length > 0 && (
                <Reasoning isStreaming={isCurrentlyStreaming}>
                  {message.reasoning.join('\n\n')}
                </Reasoning>
              )}

              {/* Assistant tools - inline, individually */}
              {message.role === 'assistant' && message.toolInvocations && message.toolInvocations.length > 0 && (
                <div className="space-y-1">
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

              {/* Assistant response content */}
              {message.role === 'assistant' && message.content && (
                <Response>
                  {isCurrentlyStreaming ? (
                    <Shimmer>
                      <Markdown content={message.content} />
                    </Shimmer>
                  ) : (
                    <Markdown content={message.content} />
                  )}
                </Response>
              )}
            </Message>
          )
        })}

        {/* Streaming loader when assistant has no content yet but tools/reasoning are updating */}
        {isStreaming && streamingMessageId && (() => {
          const streamMsg = messages.find((m) => m.id === streamingMessageId)
          // Only show if we haven't already rendered the message above
          if (streamMsg && !streamMsg.content && !streamMsg.toolInvocations?.length && !streamMsg.reasoning?.length) {
            return null // Already handled by the empty streaming check above
          }
          return null
        })()}

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
      </div>

      <ConversationScrollButton />
    </Conversation>
  )
}

/**
 * Map our ToolInvocation state to the Tool component's status
 */
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
