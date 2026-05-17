'use client'

import * as React from 'react'
import {
  Message,
  ThinkingBlock,
  Loader,
  SessionSetup,
  Response,
} from '@ship/ui'
import type { UIMessage, ToolInvocation } from '@/lib/ai-elements-adapter'
import { MessageToolList } from './messages/tool-list'
import { Markdown } from '@/components/chat/markdown'
import type { TodoItem } from '../types'

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
    !lastMsg.content && !lastMsg.toolInvocations?.length && !lastMsg.reasoning?.length

  const substantiveMessages = React.useMemo(
    () =>
      messages.filter(
        (m) =>
          m.content ||
          m.toolInvocations?.length ||
          m.reasoning?.length ||
          m.id === streamingMessageId,
      ),
    [messages, streamingMessageId],
  )

  const allReasoning = React.useMemo(
    () => substantiveMessages.flatMap((m) => m.reasoning || []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [substantiveMessages.map((m) => m.reasoning?.join()).join()],
  )

  const allTools = React.useMemo(() => {
    const allToolsRaw = substantiveMessages.flatMap((m) => m.toolInvocations || [])
    const toolsByCallId = new Map<string, ToolInvocation>()
    const toolOrder: string[] = []
    for (const t of allToolsRaw) {
      if (!toolsByCallId.has(t.toolCallId)) toolOrder.push(t.toolCallId)
      toolsByCallId.set(t.toolCallId, t)
    }
    return toolOrder.map((id) => toolsByCallId.get(id)!)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [substantiveMessages.map((m) => m.toolInvocations?.map((t) => `${t.toolCallId}:${t.state}`).join()).join()])

  const allPlanItems = React.useMemo(() => {
    const allPlanItemsRaw = substantiveMessages.flatMap((m) => m.planItems || [])
    const planById = new Map(allPlanItemsRaw.map((p) => [p.id, p]))
    return Array.from(planById.values())
  }, [substantiveMessages])

  const startupStepsMsg = React.useMemo(
    () => substantiveMessages.find((m) => m.startupSteps?.length),
    [substantiveMessages],
  )

  if (messages.length === 1 && isLastEmpty && isGroupStreaming) {
    if (showSessionSetup && streamingStatusSteps.length > 0) {
      return (
        <Message role="assistant">
          <SessionSetup steps={streamingStatusSteps} isStreaming />
        </Message>
      )
    }
    return (
      <Message role="assistant">
        <Loader message={statusLabel || 'Thinking...'} />
      </Message>
    )
  }

  if (substantiveMessages.length === 0) return null

  const textContent = substantiveMessages[substantiveMessages.length - 1]?.content ?? ''
  const hasReasoning = allReasoning.length > 0
  const hasTools = allTools.length > 0

  return (
    <Message role="assistant">
      {isFirstAssistantBlock && startupStepsMsg?.startupSteps && (
        <SessionSetup
          steps={startupStepsMsg.startupSteps}
          defaultOpen={false}
          className="my-1"
        />
      )}

      {(hasReasoning || hasTools) && (
        <ThinkingBlock
          reasoning={allReasoning}
          isStreaming={isGroupStreaming}
          duration={
            substantiveMessages[substantiveMessages.length - 1]?.elapsed != null
              ? Math.floor(substantiveMessages[substantiveMessages.length - 1]!.elapsed! / 1000)
              : undefined
          }
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

      {allPlanItems.length > 0 && (
        <div className="my-2 rounded-lg border border-border/50 bg-muted/20 p-3 space-y-1.5">
          <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-2">
            Plan
          </div>
          {allPlanItems.map((item) => (
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
