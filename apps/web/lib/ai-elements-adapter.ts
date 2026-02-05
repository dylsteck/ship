/**
 * SSE to AI Elements Adapter
 *
 * Transforms OpenCode SSE event data into shapes that AI Elements components expect.
 * Uses existing types from lib/sse-types.ts as input.
 */

import type { ToolPart, ReasoningPart, TextPart, Message, AssistantMessage, UserMessage } from '@/lib/sse-types'

/**
 * Adapt a tool part from SSE to AI Elements Tool format
 */
export function adaptToolPart(sseToolPart: ToolPart): {
  name: string
  status: 'pending' | 'in_progress' | 'completed' | 'failed'
  input: Record<string, unknown>
  output?: unknown
  duration?: number
} {
  const toolName = sseToolPart.tool || 'unknown'

  // Map tool states to AI Elements status
  let status: 'pending' | 'in_progress' | 'completed' | 'failed'
  switch (sseToolPart.state?.status) {
    case 'running':
      status = 'in_progress'
      break
    case 'completed':
      status = 'completed'
      break
    case 'error':
      status = 'failed'
      break
    default:
      status = 'pending'
  }

  const timeData = sseToolPart.state?.time
  const duration = timeData?.end && timeData?.start ? timeData.end - timeData.start : undefined

  return {
    name: toolName,
    status,
    input: sseToolPart.state?.input || {},
    output: sseToolPart.state?.output,
    duration,
  }
}

/**
 * Adapt a reasoning part from SSE to AI Elements Reasoning format
 */
export function adaptReasoningPart(sseReasoningPart: ReasoningPart): {
  text: string
} {
  return {
    text: sseReasoningPart.text || '',
  }
}

/**
 * Step for ChainOfThought component
 */
export interface ChainOfThoughtStep {
  id: string
  name: string
  status: 'pending' | 'in_progress' | 'completed' | 'failed'
  description?: string
}

/**
 * Build chain of thought steps from tools and reasoning parts
 */
export function buildChainOfThoughtSteps(
  tools: ToolPart[],
  reasoningParts: ReasoningPart[] = [],
): ChainOfThoughtStep[] {
  const steps: ChainOfThoughtStep[] = []

  // Add reasoning as first step if present
  if (reasoningParts.length > 0) {
    const hasActiveReasoning = reasoningParts.some((r) => !r.text?.endsWith('...'))
    steps.push({
      id: 'reasoning',
      name: 'Analyzing',
      status: hasActiveReasoning ? 'completed' : 'in_progress',
      description: 'Understanding the request',
    })
  }

  // Add tool execution steps
  tools.forEach((tool, index) => {
    const toolName = tool.tool || `Tool ${index + 1}`

    let status: 'pending' | 'in_progress' | 'completed' | 'failed'
    switch (tool.state?.status) {
      case 'running':
        status = 'in_progress'
        break
      case 'completed':
        status = 'completed'
        break
      case 'error':
        status = 'failed'
        break
      default:
        status = 'pending'
    }

    const description =
      tool.state?.title ||
      (tool.state?.input && typeof tool.state.input === 'object'
        ? (Object.values(tool.state.input)[0] as string)
        : undefined)

    steps.push({
      id: `tool-${index}`,
      name: toolName,
      status,
      description,
    })
  })

  return steps
}

/**
 * Adapted message for AI Elements display
 */
export interface AdaptedMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  inlineTools?: Array<{
    name: string
    status: 'pending' | 'in_progress' | 'completed' | 'failed'
    input: Record<string, unknown>
    output?: unknown
    duration?: number
  }>
  reasoningBlocks?: Array<{
    text: string
  }>
}

/**
 * Get content from a message (handles both UserMessage and AssistantMessage)
 */
function getMessageContent(message: Message): string {
  // User messages don't have a direct content field in the type
  // The content comes from parsed parts for assistant messages
  return ''
}

/**
 * Adapt a complete message for AI Elements display
 */
export function adaptMessageForDisplay(
  message: Message,
  parsedParts: Array<TextPart | ToolPart | ReasoningPart> = [],
): AdaptedMessage {
  const inlineTools: AdaptedMessage['inlineTools'] = []
  const reasoningBlocks: AdaptedMessage['reasoningBlocks'] = []
  let content = ''

  parsedParts.forEach((part) => {
    if (part.type === 'tool') {
      inlineTools.push(adaptToolPart(part as ToolPart))
    } else if (part.type === 'reasoning') {
      reasoningBlocks.push(adaptReasoningPart(part as ReasoningPart))
    } else if (part.type === 'text') {
      content += (part as TextPart).text
    }
  })

  return {
    id: message.id,
    role: message.role,
    content,
    inlineTools: inlineTools.length > 0 ? inlineTools : undefined,
    reasoningBlocks: reasoningBlocks.length > 0 ? reasoningBlocks : undefined,
  }
}

/**
 * Extract text content from message parts for streaming display
 */
export function extractTextFromParts(parts: Array<TextPart | ToolPart | ReasoningPart>): string {
  return parts
    .filter((p): p is TextPart => p.type === 'text')
    .map((p) => p.text || '')
    .join('')
}

/**
 * Check if a tool part is currently streaming (incomplete)
 */
export function isToolStreaming(toolPart: ToolPart): boolean {
  return toolPart.state?.status === 'running'
}
