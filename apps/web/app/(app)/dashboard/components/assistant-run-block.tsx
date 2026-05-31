'use client'

import * as React from 'react'
import { Message, Loader, SessionSetup } from '@ship/ui'
import type { ToolInvocation } from '@/lib/ai-elements-adapter'
import type { TodoItem } from '../types'
import type { UIMessage } from '@/lib/ai-elements-adapter'
import { AssistantOrderedParts } from './assistant-ordered-parts'

export interface AssistantRunBlockProps {
  messages: UIMessage[]
  streamingMessageId: string | null
  streamingStatusSteps: string[]
  statusLabel: string
  sessionTodos: TodoItem[]
  todoRenderedRef: React.MutableRefObject<boolean>
  onSubagentNavigate: (tool: ToolInvocation) => void
  showSessionSetup: boolean
  isFirstAssistantBlock: boolean
}

export const AssistantRunBlock = React.memo(function AssistantRunBlock({
  messages,
  streamingMessageId,
  streamingStatusSteps,
  statusLabel,
  sessionTodos,
  todoRenderedRef,
  onSubagentNavigate,
  showSessionSetup,
  isFirstAssistantBlock,
}: AssistantRunBlockProps) {
  const isGroupStreaming = messages.some((m) => m.id === streamingMessageId)
  const lastMsg = messages[messages.length - 1]
  const isLastEmpty =
    !lastMsg.content && !lastMsg.toolInvocations?.length && !lastMsg.reasoning?.length && !lastMsg.orderedParts?.length

  const substantiveMessages = messages.filter(
    (m) =>
      m.content ||
      m.toolInvocations?.length ||
      m.reasoning?.length ||
      m.planItems?.length ||
      m.orderedParts?.length ||
      m.id === streamingMessageId,
  )
  const startupStepsMsg = substantiveMessages.find((m) => m.startupSteps?.length)

  if (messages.length === 1 && isLastEmpty && isGroupStreaming) {
    return (
      <Message role="assistant">
        {showSessionSetup && streamingStatusSteps.length > 0 ? (
          <SessionSetup steps={streamingStatusSteps} isStreaming />
        ) : (
          <Loader message={statusLabel || 'Thinking...'} />
        )}
      </Message>
    )
  }

  if (substantiveMessages.length === 0) return null

  return (
    <Message role="assistant">
      {isFirstAssistantBlock && startupStepsMsg?.startupSteps && (
        <SessionSetup steps={startupStepsMsg.startupSteps} defaultOpen={false} className="my-1" />
      )}

      <AssistantOrderedParts
        messages={substantiveMessages}
        isStreaming={isGroupStreaming}
        sessionTodos={sessionTodos}
        todoRenderedRef={todoRenderedRef}
        onSubagentNavigate={onSubagentNavigate}
      />
    </Message>
  )
})
