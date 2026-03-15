'use client'

import * as React from 'react'
import {
  Message,
  Response,
  Loader,
  ThinkingBlock,
  SessionSetup,
} from '@ship/ui'
import { Markdown } from '@/components/chat/markdown'
import { ErrorMessage } from '@/components/chat/error-message'
import { PermissionPrompt } from '../permission-prompt'
import { QuestionPrompt } from '../question-prompt'
import type { UIMessage } from '@/lib/ai-elements-adapter'
import type { TodoItem } from '../../types'
import { MessageToolList } from './tool-list'

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
  onSubagentNavigate: (tool: import('@/lib/ai-elements-adapter').ToolInvocation) => void
  /** Only show SessionSetup for the first assistant in the thread */
  showSessionSetup?: boolean
  onRetry?: () => void
}

export function MessageItem({
  message,
  isCurrentlyStreaming,
  streamStartTime: _streamStartTime,
  streamingStatusSteps,
  statusLabel,
  sessionTodos,
  todoRenderedRef,
  activeSessionId,
  onPermissionReply,
  onQuestionReply,
  onQuestionSkip,
  onSubagentNavigate,
  showSessionSetup = true,
  onRetry,
}: MessageItemProps) {
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
            onPermissionReply && activeSessionId
              ? () => onPermissionReply(message.promptData!.id, true)
              : undefined
          }
          onDeny={
            onPermissionReply && activeSessionId
              ? () => onPermissionReply(message.promptData!.id, false)
              : undefined
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
            onQuestionReply && activeSessionId
              ? (answer) => onQuestionReply(message.promptData!.id, answer)
              : undefined
          }
          onSkip={
            onQuestionSkip && activeSessionId
              ? () => onQuestionSkip(message.promptData!.id)
              : undefined
          }
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

  if (
    message.role === 'assistant' &&
    !message.content &&
    !message.toolInvocations?.length &&
    !message.reasoning?.length &&
    isCurrentlyStreaming
  ) {
    if (showSessionSetup && streamingStatusSteps.length > 0) {
      return (
        <Message key={message.id} role="assistant">
          <SessionSetup steps={streamingStatusSteps} isStreaming />
        </Message>
      )
    }
    return (
      <Message key={message.id} role="assistant">
        <Loader message={statusLabel || 'Thinking...'} />
      </Message>
    )
  }

  if (!message.content && !message.toolInvocations?.length && !message.reasoning?.length) {
    return null
  }

  const hasReasoning =
    message.role === 'assistant' && !!message.reasoning && message.reasoning.length > 0
  const hasSteps =
    message.role === 'assistant' &&
    !!(message.toolInvocations && message.toolInvocations.length > 0)

  return (
    <Message
      key={message.id}
      role={message.role}
      className={isCurrentlyStreaming ? 'will-change-contents' : undefined}
    >
      {message.role === 'user' && message.content && (
        <div className="text-foreground whitespace-pre-wrap">{message.content}</div>
      )}

      {message.role === 'assistant' &&
        message.startupSteps &&
        message.startupSteps.length > 0 && (
          <SessionSetup steps={message.startupSteps} defaultOpen={false} className="my-1" />
        )}

      {(hasReasoning || hasSteps) && (
        <ThinkingBlock
          reasoning={message.reasoning}
          isStreaming={isCurrentlyStreaming}
          duration={
            message.elapsed != null ? Math.floor(message.elapsed / 1000) : undefined
          }
        >
          {hasSteps && message.toolInvocations && message.toolInvocations.length > 0 && (
            <MessageToolList
              tools={message.toolInvocations}
              sessionTodos={sessionTodos}
              todoRenderedRef={todoRenderedRef}
              onSubagentNavigate={onSubagentNavigate}
            />
          )}
        </ThinkingBlock>
      )}

      {message.planItems && message.planItems.length > 0 && (
        <div className="my-2 rounded-lg border border-border/50 bg-muted/20 p-3 space-y-1.5">
          <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-2">
            Plan
          </div>
          {message.planItems.map((item) => (
            <div key={item.id} className="flex items-center gap-2 text-sm">
              <span className="shrink-0 w-4 text-center">
                {item.status === 'completed'
                  ? '✓'
                  : item.status === 'in_progress'
                    ? '●'
                    : item.status === 'cancelled'
                      ? '✗'
                      : '○'}
              </span>
              <span
                className={
                  item.status === 'completed'
                    ? 'text-muted-foreground line-through'
                    : item.status === 'in_progress'
                      ? 'text-foreground font-medium'
                      : item.status === 'cancelled'
                        ? 'text-muted-foreground/50 line-through'
                        : 'text-foreground'
                }
              >
                {item.title}
              </span>
            </div>
          ))}
        </div>
      )}

      {message.role === 'assistant' && message.content && (
        <div className={hasSteps ? 'mt-4' : undefined}>
          <Response>
            <Markdown content={message.content} isAnimating={isCurrentlyStreaming} />
          </Response>
        </div>
      )}
    </Message>
  )
}
