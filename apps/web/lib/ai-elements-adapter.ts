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
  SessionInfo,
  SSEEvent,
} from '@/lib/sse-types'

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
    return { ...m, toolInvocations: updated }
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
  textRef: React.MutableRefObject<string>,
  reasoningRef: React.MutableRefObject<string>,
): UIMessage[] {
  switch (part.type) {
    case 'text': {
      if (typeof delta === 'string') {
        textRef.current += delta
      } else if ((part as TextPart).text) {
        textRef.current = (part as TextPart).text
      }
      return setMessageContent(textRef.current, streamingMessageId, messages)
    }

    case 'tool': {
      return updateToolInvocation(part as ToolPart, streamingMessageId, messages)
    }

    case 'reasoning': {
      const reasoningPart = part as ReasoningPart
      if (typeof delta === 'string') {
        reasoningRef.current += delta
      } else if (reasoningPart.text) {
        reasoningRef.current = reasoningPart.text
      }
      if (reasoningRef.current) {
        return setReasoning(reasoningRef.current, streamingMessageId, messages)
      }
      return messages
    }

    case 'plan': {
      const planPart = part as import('@/lib/sse-types').PlanPart
      if (planPart.items) {
        return messages.map((m) => {
          if (m.id !== streamingMessageId) return m
          return { ...m, planItems: planPart.items }
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
