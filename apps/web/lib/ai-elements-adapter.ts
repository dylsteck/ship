/**
 * SSE → UIMessage Adapter Layer
 *
 * Transforms OpenCode SSE event data into UIMessage format
 * that our dashboard components expect. Single source of truth for
 * all message state.
 */

import type {
  ToolPart,
  ReasoningPart,
  TextPart,
  MessagePart,
  Message as SSEMessage,
  StepFinishPart,
  PlanPart,
  SessionInfo,
  SSEEvent,
} from '@/lib/sse-types'
import type { MutableRefObject } from 'react'

// ============ UIMessage Types ============

export type ToolInvocationState = 'partial-call' | 'call' | 'result' | 'error'

export interface ToolInvocation {
  toolCallId: string
  toolName: string
  state: ToolInvocationState
  args: Record<string, unknown>
  result?: unknown
  /** Streaming output (partial) — used to extract session_id before tool completes */
  rawOutput?: string
  duration?: number
  title?: string
  metadata?: Record<string, unknown>
}

/** Renderable assistant message part in first-seen stream order. */
export type OrderedMessagePart =
  | { id: string; kind: 'text'; text: string }
  | { id: string; kind: 'reasoning'; text: string }
  | { id: string; kind: 'tool'; tool: ToolInvocation }
  | { id: string; kind: 'plan'; items: Array<{ id: string; title: string; status: string }> }

export interface UIMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  toolInvocations?: ToolInvocation[]
  reasoning?: string[]
  createdAt?: Date
  // Extended fields
  type?: 'error' | 'pr-notification' | 'permission' | 'question'
  errorCategory?: 'transient' | 'persistent' | 'user-action' | 'fatal'
  retryable?: boolean
  /** Raw error message before formatting (shown in Details when formatted would mask it) */
  rawErrorMessage?: string
  /** Optional primary action (e.g. open Settings) for user-action errors */
  errorAction?: { label: string; href: string }
  // Wall-clock elapsed time in ms (set when streaming completes)
  elapsed?: number
  // Plan items from PlanPart events
  planItems?: Array<{ id: string; title: string; status: string }>
  /** Render parts in their first-seen stream order. */
  orderedParts?: OrderedMessagePart[]
  /** Startup steps (e.g. "Provisioning sandbox...", "Server ready") — persisted, shown collapsible */
  startupSteps?: string[]
  // Permission/question prompt data
  promptData?: {
    id: string
    permission?: string
    description?: string
    patterns?: string[]
    text?: string
    status?: 'pending' | 'granted' | 'denied' | 'replied' | 'rejected'
  }
}

function upsertOrderedPart(
  parts: OrderedMessagePart[] | undefined,
  nextPart: OrderedMessagePart,
): OrderedMessagePart[] {
  const existing = parts || []
  const index = existing.findIndex((part) => part.id === nextPart.id && part.kind === nextPart.kind)
  if (index === -1) return [...existing, nextPart]
  return existing.map((part, i) => (i === index ? nextPart : part))
}

function getTextLikePartText(part: TextPart | ReasoningPart, delta: string | undefined, existing: string): string {
  if (typeof delta === 'string') return existing + delta
  if (part.text) return part.text
  return existing
}

function getOrderedText(parts: OrderedMessagePart[] | undefined, partId: string, kind: 'text' | 'reasoning'): string {
  const match = parts?.find((part) => part.id === partId && part.kind === kind)
  return match?.kind === kind ? match.text : ''
}

function joinOrderedText(parts: OrderedMessagePart[], kind: 'text' | 'reasoning'): string {
  return parts
    .filter((part): part is Extract<OrderedMessagePart, { kind: typeof kind }> => part.kind === kind)
    .map((part) => part.text)
    .join(kind === 'reasoning' ? '\n\n' : '')
}

/**
 * Updates the ordered render snapshot for a streamed text or reasoning part.
 */
export function applyOrderedTextLikePart(
  part: TextPart | ReasoningPart,
  delta: string | undefined,
  textRef: MutableRefObject<string>,
  reasoningRef: MutableRefObject<string>,
  orderedPartsRef?: MutableRefObject<OrderedMessagePart[]>,
): OrderedMessagePart[] | undefined {
  if (!orderedPartsRef) {
    if (part.type === 'text') {
      if (typeof delta === 'string') textRef.current += delta
      else if (part.text) textRef.current = part.text
    } else if (typeof delta === 'string') {
      reasoningRef.current += delta
    } else if (part.text) {
      reasoningRef.current = part.text
    }
    return undefined
  }

  const kind = part.type
  const existing = getOrderedText(orderedPartsRef.current, part.id, kind)
  const text = getTextLikePartText(part, delta, existing)
  orderedPartsRef.current = upsertOrderedPart(orderedPartsRef.current, {
    id: part.id,
    kind,
    text,
  })
  if (kind === 'text') textRef.current = joinOrderedText(orderedPartsRef.current, 'text')
  else reasoningRef.current = joinOrderedText(orderedPartsRef.current, 'reasoning')
  return orderedPartsRef.current
}

function upsertOrderedToolPart(
  orderedParts: OrderedMessagePart[] | undefined,
  invocation: ToolInvocation,
): OrderedMessagePart[] {
  return upsertOrderedPart(orderedParts, {
    id: invocation.toolCallId,
    kind: 'tool',
    tool: invocation,
  })
}

function upsertOrderedPlanPart(orderedParts: OrderedMessagePart[] | undefined, part: PlanPart): OrderedMessagePart[] {
  return upsertOrderedPart(orderedParts, {
    id: part.id,
    kind: 'plan',
    items: part.items || [],
  })
}

/**
 * Builds a best-effort ordered sequence for legacy messages that predate ordered parts.
 */
export function synthesizeOrderedParts(message: UIMessage): OrderedMessagePart[] {
  if (message.orderedParts?.length) return message.orderedParts

  const parts: OrderedMessagePart[] = []
  for (const [index, text] of (message.reasoning || []).entries()) {
    if (text) parts.push({ id: `${message.id}-reasoning-${index}`, kind: 'reasoning', text })
  }
  for (const tool of message.toolInvocations || []) {
    parts.push({ id: tool.toolCallId, kind: 'tool', tool })
  }
  if (message.planItems?.length) {
    parts.push({ id: `${message.id}-plan`, kind: 'plan', items: message.planItems })
  }
  if (message.content) {
    parts.push({ id: `${message.id}-text`, kind: 'text', text: message.content })
  }
  return parts
}

// ============ Tool State Mapping ============

/**
 * Maps OpenCode tool states → our ToolInvocation states
 */
function mapSSEToolState(status: string | undefined): ToolInvocationState {
  switch (status) {
    case 'pending':
      return 'partial-call'
    case 'running':
      return 'call'
    case 'completed':
      return 'result'
    case 'error':
      return 'error'
    default:
      return 'partial-call'
  }
}

/**
 * Create a ToolInvocation from an SSE ToolPart
 */
export function createToolInvocation(toolPart: ToolPart): ToolInvocation {
  const timeData = toolPart.state?.time
  const duration = timeData?.end && timeData?.start ? timeData.end - timeData.start : undefined

  return {
    toolCallId: toolPart.callID,
    toolName: toolPart.tool,
    state: mapSSEToolState(toolPart.state?.status),
    args: toolPart.state?.input || {},
    result: toolPart.state?.output,
    rawOutput: toolPart.state?.raw,
    duration,
    title: toolPart.state?.title,
    metadata: toolPart.state?.metadata,
  }
}

// ============ Message Transformation ============

/**
 * Apply a text delta to an existing message's content efficiently.
 * Returns a new messages array with the updated message.
 */
export function streamTextDelta(delta: string, messageId: string, messages: UIMessage[]): UIMessage[] {
  return messages.map((m) => {
    if (m.id !== messageId) return m
    return { ...m, content: m.content + delta }
  })
}

/**
 * Set full text content on a message (fallback when delta not available).
 */
export function setMessageContent(text: string, messageId: string, messages: UIMessage[]): UIMessage[] {
  return messages.map((m) => {
    if (m.id !== messageId) return m
    return { ...m, content: text }
  })
}

/**
 * Update or add a tool invocation on a message.
 */
export function updateToolInvocation(toolPart: ToolPart, messageId: string, messages: UIMessage[]): UIMessage[] {
  const invocation = createToolInvocation(toolPart)

  return messages.map((m) => {
    if (m.id !== messageId) return m
    const existing = m.toolInvocations || []
    const idx = existing.findIndex((t) => t.toolCallId === invocation.toolCallId)
    const updated = idx >= 0 ? existing.map((t, i) => (i === idx ? invocation : t)) : [...existing, invocation]
    return { ...m, toolInvocations: updated, orderedParts: upsertOrderedToolPart(m.orderedParts, invocation) }
  })
}

/**
 * Set reasoning text on a message (replaces, not appends — SSE sends cumulative text).
 */
export function setReasoning(text: string, messageId: string, messages: UIMessage[]): UIMessage[] {
  return messages.map((m) => {
    if (m.id !== messageId) return m
    return { ...m, reasoning: [text] }
  })
}

/**
 * Process a message.part.updated event and return updated messages array.
 * This is the main handler for SSE streaming events.
 */
export function processPartUpdated(
  part: MessagePart,
  delta: string | undefined,
  streamingMessageId: string,
  messages: UIMessage[],
  textRef: MutableRefObject<string>,
  reasoningRef: MutableRefObject<string>,
  orderedPartsRef?: MutableRefObject<OrderedMessagePart[]>,
): UIMessage[] {
  switch (part.type) {
    case 'text': {
      const orderedParts = applyOrderedTextLikePart(part as TextPart, delta, textRef, reasoningRef, orderedPartsRef)
      return messages.map((m) => {
        if (m.id !== streamingMessageId) return m
        return {
          ...m,
          content: textRef.current,
          ...(orderedParts ? { orderedParts } : {}),
        }
      })
    }

    case 'tool': {
      const invocation = createToolInvocation(part as ToolPart)
      if (orderedPartsRef) {
        orderedPartsRef.current = upsertOrderedToolPart(orderedPartsRef.current, invocation)
      }
      return messages.map((m) => {
        if (m.id !== streamingMessageId) return m
        const existing = m.toolInvocations || []
        const idx = existing.findIndex((t) => t.toolCallId === invocation.toolCallId)
        const updated = idx >= 0 ? existing.map((t, i) => (i === idx ? invocation : t)) : [...existing, invocation]
        return {
          ...m,
          toolInvocations: updated,
          orderedParts: upsertOrderedToolPart(orderedPartsRef?.current ?? m.orderedParts, invocation),
        }
      })
    }

    case 'reasoning': {
      const orderedParts = applyOrderedTextLikePart(
        part as ReasoningPart,
        delta,
        textRef,
        reasoningRef,
        orderedPartsRef,
      )
      if (reasoningRef.current) {
        return messages.map((m) => {
          if (m.id !== streamingMessageId) return m
          return {
            ...m,
            reasoning: [reasoningRef.current],
            ...(orderedParts ? { orderedParts } : {}),
          }
        })
      }
      return messages
    }

    case 'plan': {
      const planPart = part as PlanPart
      if (planPart.items) {
        if (orderedPartsRef) {
          orderedPartsRef.current = upsertOrderedPlanPart(orderedPartsRef.current, planPart)
        }
        return messages.map((m) => {
          if (m.id !== streamingMessageId) return m
          return {
            ...m,
            planItems: planPart.items,
            orderedParts: upsertOrderedPlanPart(orderedPartsRef?.current ?? m.orderedParts, planPart),
          }
        })
      }
      return messages
    }

    case 'step-finish':
    case 'step-start':
      // These are handled separately for cost tracking
      return messages

    default:
      return messages
  }
}

// ============ User Message Creation ============

export function createUserMessage(content: string): UIMessage {
  return {
    id: `user-${Date.now()}`,
    role: 'user',
    content,
    createdAt: new Date(),
  }
}

export function createAssistantPlaceholder(): UIMessage {
  return {
    id: `assistant-${Date.now()}`,
    role: 'assistant',
    content: '',
    createdAt: new Date(),
  }
}

export function createErrorMessage(
  content: string,
  category: UIMessage['errorCategory'] = 'persistent',
  retryable = false,
  rawErrorMessage?: string,
  errorAction?: UIMessage['errorAction'],
): UIMessage {
  return {
    id: `error-${Date.now()}`,
    role: 'system',
    content,
    type: 'error',
    errorCategory: category,
    retryable,
    rawErrorMessage,
    ...(errorAction && { errorAction }),
    createdAt: new Date(),
  }
}

export function createSystemMessage(content: string, type?: UIMessage['type']): UIMessage {
  return {
    id: `system-${Date.now()}`,
    role: 'system',
    content,
    type,
    createdAt: new Date(),
  }
}

// ============ Permission & Question Messages ============

export function createPermissionMessage(
  id: string,
  permission: string,
  description?: string,
  patterns?: string[],
): UIMessage {
  return {
    id: `permission-${id}`,
    role: 'system',
    content: description || `Permission requested: ${permission}`,
    type: 'permission',
    promptData: {
      id,
      permission,
      description,
      patterns,
      status: 'pending',
    },
    createdAt: new Date(),
  }
}

export function createQuestionMessage(id: string, text: string): UIMessage {
  return {
    id: `question-${id}`,
    role: 'system',
    content: text,
    type: 'question',
    promptData: {
      id,
      text,
      status: 'pending',
    },
    createdAt: new Date(),
  }
}

export function updatePromptStatus(
  promptId: string,
  status: 'granted' | 'denied' | 'replied' | 'rejected',
  messages: UIMessage[],
): UIMessage[] {
  return messages.map((m) => {
    if (m.promptData?.id !== promptId) return m
    return {
      ...m,
      promptData: { ...m.promptData!, status },
    }
  })
}

// ============ Error Classification ============

export { classifyError, parseErrorMessage, type ErrorCategory } from './ai-elements-errors'

// ============ Cost Extraction ============

export interface StepCost {
  cost: number
  tokens: StepFinishPart['tokens']
}

export function extractStepCost(part: MessagePart): StepCost | null {
  if (part.type !== 'step-finish') return null
  const stepPart = part as StepFinishPart
  return {
    cost: stepPart.cost,
    tokens: stepPart.tokens,
  }
}

export { mapApiMessagesToUI, replayEventsToMessages, type RawEvent } from './ai-elements-history'
export { mapToolState, getStreamingStatus } from './ai-elements-ui-helpers'
