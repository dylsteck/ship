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
  duration?: number
  title?: string
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
  // Wall-clock elapsed time in ms (set when streaming completes)
  elapsed?: number
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
function mapToolState(status: string | undefined): ToolInvocationState {
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
    state: mapToolState(toolPart.state?.status),
    args: toolPart.state?.input || {},
    result: toolPart.state?.output,
    duration,
    title: toolPart.state?.title,
  }
}

// ============ Message Transformation ============

/**
 * Apply a text delta to an existing message's content efficiently.
 * Returns a new messages array with the updated message.
 */
export function streamTextDelta(
  delta: string,
  messageId: string,
  messages: UIMessage[],
): UIMessage[] {
  return messages.map((m) => {
    if (m.id !== messageId) return m
    return { ...m, content: m.content + delta }
  })
}

/**
 * Set full text content on a message (fallback when delta not available).
 */
export function setMessageContent(
  text: string,
  messageId: string,
  messages: UIMessage[],
): UIMessage[] {
  return messages.map((m) => {
    if (m.id !== messageId) return m
    return { ...m, content: text }
  })
}

/**
 * Update or add a tool invocation on a message.
 */
export function updateToolInvocation(
  toolPart: ToolPart,
  messageId: string,
  messages: UIMessage[],
): UIMessage[] {
  const invocation = createToolInvocation(toolPart)

  return messages.map((m) => {
    if (m.id !== messageId) return m
    const existing = m.toolInvocations || []
    const idx = existing.findIndex((t) => t.toolCallId === invocation.toolCallId)
    const updated =
      idx >= 0
        ? existing.map((t, i) => (i === idx ? invocation : t))
        : [...existing, invocation]
    return { ...m, toolInvocations: updated }
  })
}

/**
 * Set reasoning text on a message (replaces, not appends — SSE sends cumulative text).
 */
export function setReasoning(
  text: string,
  messageId: string,
  messages: UIMessage[],
): UIMessage[] {
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
): UIMessage {
  return {
    id: `error-${Date.now()}`,
    role: 'system',
    content,
    type: 'error',
    errorCategory: category,
    retryable,
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

export function classifyError(errorMessage: string): {
  category: UIMessage['errorCategory']
  retryable: boolean
} {
  if (errorMessage.includes('credit balance') || errorMessage.includes('Anthropic API')) {
    return { category: 'user-action', retryable: false }
  }
  if (errorMessage.includes('rate limit') || errorMessage.includes('too many requests')) {
    return { category: 'transient', retryable: true }
  }
  if (
    errorMessage.includes('network') ||
    errorMessage.includes('connection') ||
    errorMessage.includes('timeout')
  ) {
    return { category: 'transient', retryable: true }
  }
  return { category: 'persistent', retryable: false }
}

/**
 * Parse a potentially JSON-wrapped error string into a clean message
 */
export function parseErrorMessage(raw: unknown): string {
  if (typeof raw !== 'string') return 'An error occurred'

  if (raw.startsWith('{')) {
    try {
      const parsed = JSON.parse(raw)
      return parsed.data?.message || parsed.message || parsed.error?.message || raw
    } catch {
      // Not valid JSON
    }
  }

  return raw
}

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

// ============ API Message → UIMessage Mapping ============

interface ApiMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  createdAt: number
  parts?: string // JSON string of MessagePart[]
  inlineTools?: Array<{
    name: string
    status: 'pending' | 'in_progress' | 'completed' | 'failed'
    input: Record<string, unknown>
    output?: unknown
    duration?: number
  }>
  reasoningBlocks?: Array<{ text: string }>
}

/**
 * Map an array of API messages to UIMessages (for loading history on reload).
 * Parses the `parts` JSON string to restore reasoning, tool invocations, and elapsed time.
 */
export function mapApiMessagesToUI(apiMessages: ApiMessage[]): UIMessage[] {
  return apiMessages.map((msg) => {
    const uiMsg: UIMessage = {
      id: msg.id,
      role: msg.role,
      content: msg.content,
      createdAt: new Date(msg.createdAt * 1000),
    }

    // Try to parse the `parts` JSON string first — it's the most complete source
    if (msg.parts) {
      try {
        const parts = JSON.parse(msg.parts) as MessagePart[]
        const tools: ToolInvocation[] = []
        const reasoningTexts: string[] = []
        let textContent = ''
        let elapsed: number | undefined

        for (const part of parts) {
          switch (part.type) {
            case 'tool': {
              const tp = part as ToolPart
              tools.push(createToolInvocation(tp))
              break
            }
            case 'reasoning': {
              const rp = part as ReasoningPart
              if (rp.text) reasoningTexts.push(rp.text)
              break
            }
            case 'text': {
              const txp = part as TextPart
              if (txp.text) textContent += txp.text
              break
            }
            case 'step-finish': {
              const sfp = part as StepFinishPart
              if (sfp.cost !== undefined) {
                // Use timing from the part if available
                const time = (sfp as StepFinishPart & { time?: { start: number; end?: number } }).time
                if (time?.start && time?.end) {
                  elapsed = time.end - time.start
                }
              }
              break
            }
          }
        }

        if (tools.length > 0) uiMsg.toolInvocations = tools
        if (reasoningTexts.length > 0) uiMsg.reasoning = reasoningTexts
        if (!uiMsg.content && textContent) uiMsg.content = textContent
        if (elapsed) uiMsg.elapsed = elapsed

        return uiMsg
      } catch {
        // Fall through to legacy fields
      }
    }

    // Fallback: use inlineTools and reasoningBlocks
    if (msg.inlineTools?.length) {
      uiMsg.toolInvocations = msg.inlineTools.map((t) => ({
        toolCallId: `${msg.id}-${t.name}`,
        toolName: t.name,
        state: t.status === 'completed' ? 'result' as const : t.status === 'failed' ? 'error' as const : 'call' as const,
        args: t.input,
        result: t.output,
        duration: t.duration,
      }))
    }
    if (msg.reasoningBlocks?.length) {
      uiMsg.reasoning = msg.reasoningBlocks.map((b) => b.text)
    }
    return uiMsg
  })
}

// ============ Status Helpers ============

/**
 * Get a human-readable status label from the current streaming state
 */
export function getStreamingStatus(messages: UIMessage[], streamingMessageId: string | null): string {
  if (!streamingMessageId) return ''

  const msg = messages.find((m) => m.id === streamingMessageId)
  if (!msg) return 'Thinking...'

  const activeTools = msg.toolInvocations?.filter(
    (t) => t.state === 'call' || t.state === 'partial-call',
  )

  if (activeTools && activeTools.length > 0) {
    const latest = activeTools[activeTools.length - 1]
    const name = latest.toolName.toLowerCase()

    if (name.includes('read') || name.includes('glob') || name.includes('grep')) {
      return `Reading: ${latest.title || 'files...'}`
    }
    if (name.includes('write') || name.includes('edit')) {
      return `Writing: ${latest.title || 'code...'}`
    }
    if (name.includes('bash') || name.includes('run') || name.includes('shell')) {
      return `Running: ${latest.title || 'command...'}`
    }
    if (name.includes('task') || name.includes('agent')) {
      return 'Creating task...'
    }
    return `${latest.toolName}: ${latest.title || ''}`
  }

  if (msg.reasoning && msg.reasoning.length > 0) {
    return 'Reasoning...'
  }

  if (msg.content) {
    return 'Writing response...'
  }

  return 'Thinking...'
}
