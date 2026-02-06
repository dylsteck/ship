'use client'

import { Message, Tool, Response, Loader, Task, Steps, Conversation, ConversationScrollButton } from '@ship/ui'
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
              <div key={message.id} className="py-2">
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
              <div key={message.id} className="py-2">
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
              <div key={message.id} className="py-2">
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

          const hasSteps =
            message.role === 'assistant' &&
            ((message.reasoning && message.reasoning.length > 0) ||
              (message.toolInvocations && message.toolInvocations.length > 0))

          // Wall-clock elapsed: use stamped value for completed, live timer for streaming
          const stepsElapsed = isCurrentlyStreaming
            ? (streamStartTime ? Date.now() - streamStartTime : 0)
            : (message.elapsed || 0)

          return (
            <Message
              key={message.id}
              role={message.role}
              className={isCurrentlyStreaming ? 'will-change-[contents]' : undefined}
            >
              {/* User messages */}
              {message.role === 'user' && message.content && (
                <div className="text-foreground whitespace-pre-wrap">{message.content}</div>
              )}

              {/* Steps collapsible — groups reasoning + tools */}
              {hasSteps && (
                <Steps
                  isStreaming={isCurrentlyStreaming && isStreaming}
                  elapsed={stepsElapsed}
                  toolCount={message.toolInvocations?.length}
                >
                  {/* Reasoning inside steps */}
                  {message.reasoning && message.reasoning.length > 0 && (
                    <div className="text-sm text-muted-foreground/80 border-l-2 border-border/40 pl-3 py-1 my-1">
                      <div className="text-[11px] text-muted-foreground/50 mb-1 font-medium">Reasoning</div>
                      <div className="whitespace-pre-wrap leading-relaxed">{message.reasoning.join('\n\n')}</div>
                    </div>
                  )}

                  {/* Tools inside steps */}
                  {message.toolInvocations && message.toolInvocations.length > 0 && (
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
                </Steps>
              )}

              {/* Assistant response content — always visible, outside steps */}
              {message.role === 'assistant' && message.content && (
                <Response>
                  <Markdown content={message.content} />
                </Response>
              )}
            </Message>
          )
        })}

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
