import { classifyErrorFromMessage, type ErrorCode } from '@ship/contracts'

import type { ToolInvocation, UIMessage } from '@/lib/ai-elements-adapter'

/** Tool kinds eligible for consecutive collapse in the timeline. */
export type CollapsibleToolKind = 'read' | 'grep' | 'bash'

/** A single tool row or a collapsed group of consecutive similar tools. */
export type CollapsedToolInvocation =
  | { kind: 'single'; tool: ToolInvocation }
  | { kind: 'group'; groupKind: CollapsibleToolKind; tools: ToolInvocation[]; label: string }

/** One renderable row in the message timeline. */
export interface TimelineEntry {
  kind: 'message'
  id: string
  message: UIMessage
  displayTools: CollapsedToolInvocation[]
}

/** Permission or question prompt still awaiting user action. */
export interface PendingPrompt {
  id: string
  type: 'permission' | 'question'
  messageId: string
  promptData: NonNullable<UIMessage['promptData']>
}

/** UI-facing error classification including stable {@link ErrorCode}. */
export interface ClassifiedErrorFromCode {
  category: UIMessage['errorCategory']
  retryable: boolean
  code: ErrorCode
}

const GROUP_LABELS: Record<CollapsibleToolKind, string> = {
  read: 'Read files',
  grep: 'Searched files',
  bash: 'Ran commands',
}

function getCollapsibleToolKind(toolName: string): CollapsibleToolKind | null {
  const name = toolName.toLowerCase()
  if (name.includes('grep') || name.includes('glob') || name.includes('search')) {
    return 'grep'
  }
  if (name.includes('read')) {
    return 'read'
  }
  if (
    name.includes('bash') ||
    name.includes('shell') ||
    name.includes('terminal') ||
    name.includes('command') ||
    name.includes('run')
  ) {
    return 'bash'
  }
  return null
}

function groupLabel(kind: CollapsibleToolKind, count: number): string {
  const base = GROUP_LABELS[kind]
  return count > 1 ? `${base} (${count})` : base
}

/**
 * Group consecutive similar read, grep, or bash tool invocations for compact UI.
 *
 * @param tools - Tool invocations in timeline order
 */
export function collapseToolInvocations(tools: ToolInvocation[]): CollapsedToolInvocation[] {
  const collapsed: CollapsedToolInvocation[] = []

  for (const tool of tools) {
    const groupKind = getCollapsibleToolKind(tool.toolName)
    const previous = collapsed.at(-1)

    if (groupKind && previous?.kind === 'group' && previous.groupKind === groupKind) {
      previous.tools.push(tool)
      previous.label = groupLabel(groupKind, previous.tools.length)
      continue
    }

    if (groupKind) {
      collapsed.push({
        kind: 'group',
        groupKind,
        tools: [tool],
        label: groupLabel(groupKind, 1),
      })
      continue
    }

    collapsed.push({ kind: 'single', tool })
  }

  return collapsed
}

/**
 * Build timeline entries from persisted or live {@link UIMessage} rows.
 *
 * @param messages - Messages in display order
 */
export function deriveTimelineEntries(messages: UIMessage[]): TimelineEntry[] {
  return messages.map((message) => ({
    kind: 'message',
    id: message.id,
    message,
    displayTools: collapseToolInvocations(message.toolInvocations ?? []),
  }))
}

/**
 * Collect permission and question prompts that are still pending user action.
 *
 * @param messages - Full message list for the session
 */
export function derivePendingPrompts(messages: UIMessage[]): PendingPrompt[] {
  return messages.flatMap((message) => {
    if (message.type !== 'permission' && message.type !== 'question') {
      return []
    }
    if (message.promptData?.status !== 'pending') {
      return []
    }
    return [
      {
        id: message.promptData.id,
        type: message.type,
        messageId: message.id,
        promptData: message.promptData,
      },
    ]
  })
}

/**
 * Classify an error message using shared {@link classifyErrorFromMessage} heuristics.
 *
 * @param message - Raw or sanitized error text
 */
export function classifyErrorFromCode(message: string): ClassifiedErrorFromCode {
  const classified = classifyErrorFromMessage(message)
  return {
    category: classified.category,
    retryable: classified.retryable,
    code: classified.code,
  }
}
