'use client'

import { Message, Loader, SessionSetup } from '@ship/ui'
import { ErrorMessage } from '@/components/chat/error-message'
import { PermissionPrompt } from '../permission-prompt'
import { QuestionPrompt } from '../question-prompt'
import type { UIMessage, ToolInvocation } from '@/lib/ai-elements-adapter'
import type { TodoItem } from '../../types'
import { AssistantOrderedParts } from '../assistant-ordered-parts'

export interface MessageItemProps {
  message: UIMessage
  isCurrentlyStreaming: boolean
  streamStartTime: number | null
  streamingStatusSteps: string[]
  statusLabel: string
  sessionTodos: TodoItem[]
  todoRenderedRef: React.MutableRefObject<boolean>
  activeSessionId: string | null
  onPermissionReply?: (permissionId: string, approved: boolean) => Promise<void>
  onQuestionReply?: (questionId: string, response: string) => Promise<void>
  onQuestionSkip?: (questionId: string) => Promise<void>
  onSubagentNavigate: (tool: ToolInvocation) => void
  showSessionSetup?: boolean
  onRetry?: () => void
}

function MessagePromptContent({
  message,
  activeSessionId,
  onPermissionReply,
  onQuestionReply,
  onQuestionSkip,
  onRetry,
}: Pick<
  MessageItemProps,
  'message' | 'activeSessionId' | 'onPermissionReply' | 'onQuestionReply' | 'onQuestionSkip' | 'onRetry'
>) {
  if (message.type === 'permission' && message.promptData) {
    return (
      <div className="py-2">
        <PermissionPrompt
          id={message.promptData.id}
          permission={message.promptData.permission || ''}
          description={message.promptData.description}
          patterns={message.promptData.patterns}
          status={message.promptData.status as 'pending' | 'granted' | 'denied'}
          onApprove={
            onPermissionReply && activeSessionId ? () => onPermissionReply(message.promptData!.id, true) : undefined
          }
          onDeny={
            onPermissionReply && activeSessionId ? () => onPermissionReply(message.promptData!.id, false) : undefined
          }
        />
      </div>
    )
  }

  if (message.type === 'question' && message.promptData) {
    return (
      <div className="py-2">
        <QuestionPrompt
          id={message.promptData.id}
          text={message.promptData.text || message.content}
          status={message.promptData.status as 'pending' | 'replied' | 'rejected'}
          onReply={
            onQuestionReply && activeSessionId ? (answer) => onQuestionReply(message.promptData!.id, answer) : undefined
          }
          onSkip={onQuestionSkip && activeSessionId ? () => onQuestionSkip(message.promptData!.id) : undefined}
        />
      </div>
    )
  }

  if (message.type === 'error') {
    return (
      <div className="py-2">
        <ErrorMessage
          message={message.content}
          category={message.errorCategory || 'persistent'}
          retryable={message.retryable || false}
          onRetry={message.retryable ? onRetry : undefined}
          rawMessage={message.rawErrorMessage}
          action={message.errorAction}
        />
      </div>
    )
  }

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

  return null
}

function AssistantMessageBody({
  message,
  isCurrentlyStreaming,
  streamingStatusSteps,
  statusLabel,
  sessionTodos,
  todoRenderedRef,
  onSubagentNavigate,
  showSessionSetup,
}: Pick<
  MessageItemProps,
  | 'message'
  | 'isCurrentlyStreaming'
  | 'streamingStatusSteps'
  | 'statusLabel'
  | 'sessionTodos'
  | 'todoRenderedRef'
  | 'onSubagentNavigate'
  | 'showSessionSetup'
>) {
  if (
    !message.content &&
    !message.toolInvocations?.length &&
    !message.reasoning?.length &&
    !message.planItems?.length &&
    !message.orderedParts?.length &&
    isCurrentlyStreaming
  ) {
    return (
      <Message key={message.id} role="assistant">
        {showSessionSetup && streamingStatusSteps.length > 0 ? (
          <SessionSetup steps={streamingStatusSteps} isStreaming />
        ) : (
          <Loader message={statusLabel || 'Thinking...'} />
        )}
      </Message>
    )
  }

  return (
    <Message key={message.id} role={message.role}>
      {message.startupSteps && message.startupSteps.length > 0 && (
        <SessionSetup steps={message.startupSteps} defaultOpen={false} className="my-1" />
      )}

      <AssistantOrderedParts
        messages={[message]}
        isStreaming={isCurrentlyStreaming}
        sessionTodos={sessionTodos}
        todoRenderedRef={todoRenderedRef}
        onSubagentNavigate={onSubagentNavigate}
      />
    </Message>
  )
}

export function MessageItem(props: MessageItemProps) {
  const { message } = props

  const promptContent = MessagePromptContent(props)
  if (promptContent) return promptContent

  if (
    !message.content &&
    !message.toolInvocations?.length &&
    !message.reasoning?.length &&
    !message.planItems?.length &&
    !message.orderedParts?.length
  ) {
    return null
  }

  if (message.role === 'user' && message.content) {
    return (
      <Message key={message.id} role="user" timestamp={message.createdAt} copyContent={message.content}>
        <div className="text-foreground whitespace-pre-wrap">{message.content}</div>
      </Message>
    )
  }

  if (message.role === 'assistant') {
    return <AssistantMessageBody {...props} />
  }

  return null
}
