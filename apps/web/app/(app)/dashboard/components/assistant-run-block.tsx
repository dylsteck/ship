'use client'

import * as React from 'react'
import { Message, ThinkingBlock, Loader, SessionSetup, Response } from '@ship/ui'
import type { ToolInvocation } from '@/lib/ai-elements-adapter'
import { MessageToolList } from './messages/tool-list'
import { Markdown } from '@/components/chat/markdown'
import type { TodoItem } from '../types'
import { mergeAssistantText, useAssistantRunAggregates } from './assistant-run-block-utils'
import { AssistantRunPlanItems } from './assistant-run-plan-items'
import type { UIMessage } from '@/lib/ai-elements-adapter'

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
  const isLastEmpty = !lastMsg.content && !lastMsg.toolInvocations?.length && !lastMsg.reasoning?.length

  const { substantiveMessages, allReasoning, allTools, allPlanItems, startupStepsMsg } =
    useAssistantRunAggregates(messages, streamingMessageId)

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

  const textContent = mergeAssistantText(substantiveMessages.map((m) => m.content?.trim()).filter(Boolean))
  const hasReasoning = allReasoning.length > 0
  const hasTools = allTools.length > 0
  const lastElapsed = substantiveMessages[substantiveMessages.length - 1]?.elapsed

  return (
    <Message role="assistant">
      {isFirstAssistantBlock && startupStepsMsg?.startupSteps && (
        <SessionSetup steps={startupStepsMsg.startupSteps} defaultOpen={false} className="my-1" />
      )}

      {(hasReasoning || hasTools) && (
        <ThinkingBlock
          reasoning={allReasoning}
          isStreaming={isGroupStreaming}
          duration={lastElapsed != null ? Math.floor(lastElapsed / 1000) : undefined}
        >
          {hasTools && (
            <MessageToolList
              tools={allTools}
              sessionTodos={sessionTodos}
              todoRenderedRef={todoRenderedRef}
              onSubagentNavigate={onSubagentNavigate}
            />
          )}
        </ThinkingBlock>
      )}

      <AssistantRunPlanItems items={allPlanItems} />

      {textContent && (
        <div className={hasTools ? 'mt-4' : undefined}>
          <Response>
            <Markdown content={textContent} isAnimating={isGroupStreaming} />
          </Response>
        </div>
      )}
    </Message>
  )
})
