'use client'

import * as React from 'react'
import { Response, ThinkingBlock } from '@ship/ui'
import { Markdown } from '@/components/chat/markdown'
import {
  synthesizeOrderedParts,
  type OrderedMessagePart,
  type ToolInvocation,
  type UIMessage,
} from '@/lib/ai-elements-adapter'
import type { TodoItem } from '../types'
import { AssistantRunPlanItems } from './assistant-run-plan-items'
import { MessageToolList } from './messages/tool-list'

type RenderGroup =
  | { kind: 'text'; part: Extract<OrderedMessagePart, { kind: 'text' }> }
  | { kind: 'reasoning'; parts: Array<Extract<OrderedMessagePart, { kind: 'reasoning' }>> }
  | { kind: 'tools'; parts: Array<Extract<OrderedMessagePart, { kind: 'tool' }>> }
  | { kind: 'plan'; part: Extract<OrderedMessagePart, { kind: 'plan' }> }

/** Props for ordered assistant part rendering. */
export interface AssistantOrderedPartsProps {
  messages: UIMessage[]
  isStreaming: boolean
  sessionTodos: TodoItem[]
  todoRenderedRef: React.MutableRefObject<boolean>
  onSubagentNavigate: (tool: ToolInvocation) => void
}

/** Flattens assistant messages into render parts while preserving each message's local order. */
export function getOrderedPartsForMessages(messages: UIMessage[]): OrderedMessagePart[] {
  return messages.flatMap((message) => synthesizeOrderedParts(message))
}

function groupOrderedParts(parts: OrderedMessagePart[]): RenderGroup[] {
  const groups: RenderGroup[] = []

  for (const part of parts) {
    const previous = groups[groups.length - 1]
    if (part.kind === 'tool' && previous?.kind === 'tools') {
      previous.parts.push(part)
      continue
    }
    if (part.kind === 'reasoning' && previous?.kind === 'reasoning') {
      previous.parts.push(part)
      continue
    }
    if (part.kind === 'tool') groups.push({ kind: 'tools', parts: [part] })
    else if (part.kind === 'reasoning') groups.push({ kind: 'reasoning', parts: [part] })
    else groups.push({ kind: part.kind, part } as RenderGroup)
  }

  return groups
}

function getLastTextPartId(parts: OrderedMessagePart[]): string | null {
  for (let i = parts.length - 1; i >= 0; i--) {
    if (parts[i]?.kind === 'text') return parts[i].id
  }
  return null
}

/** Renders assistant text, reasoning, tools, and plans in stream arrival order. */
export const AssistantOrderedParts = React.memo(function AssistantOrderedParts({
  messages,
  isStreaming,
  sessionTodos,
  todoRenderedRef,
  onSubagentNavigate,
}: AssistantOrderedPartsProps) {
  const parts = getOrderedPartsForMessages(messages)
  const groups = groupOrderedParts(parts)
  const lastTextPartId = getLastTextPartId(parts)
  const lastElapsed = messages[messages.length - 1]?.elapsed

  return (
    <div className="space-y-3">
      {groups.map((group, index) => {
        if (group.kind === 'text') {
          return (
            <Response key={`${group.part.id}-${index}`}>
              <Markdown content={group.part.text} isAnimating={isStreaming && group.part.id === lastTextPartId} />
            </Response>
          )
        }

        if (group.kind === 'reasoning') {
          return (
            <ThinkingBlock
              key={`reasoning-${group.parts.map((part) => part.id).join('-')}-${index}`}
              reasoning={group.parts.map((part) => part.text)}
              isStreaming={isStreaming && index === groups.length - 1}
              duration={lastElapsed != null ? Math.floor(lastElapsed / 1000) : undefined}
            />
          )
        }

        if (group.kind === 'tools') {
          return (
            <ThinkingBlock
              key={`tools-${group.parts.map((part) => part.id).join('-')}-${index}`}
              isStreaming={isStreaming && index === groups.length - 1}
              duration={lastElapsed != null ? Math.floor(lastElapsed / 1000) : undefined}
            >
              <MessageToolList
                tools={group.parts.map((part) => part.tool)}
                sessionTodos={sessionTodos}
                todoRenderedRef={todoRenderedRef}
                onSubagentNavigate={onSubagentNavigate}
              />
            </ThinkingBlock>
          )
        }

        return <AssistantRunPlanItems key={`${group.part.id}-${index}`} items={group.part.items} />
      })}
    </div>
  )
})
