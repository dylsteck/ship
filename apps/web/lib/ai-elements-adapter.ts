/**
 * SSE to AI Elements Adapter
 *
 * Transforms OpenCode SSE event data into shapes that AI Elements components expect.
 * Uses existing types from lib/sse-types.ts as input.
 */

import type { ToolPart, ReasoningPart, TextPart, MessagePart, Message, AssistantMessage, UserMessage } from '@/lib/sse-types'

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

/**
 * Adapt permission.asked event to UI format
 */
export function adaptPermissionAsked(event: {
  type: 'permission.asked'
  properties: {
    permission: string
    description?: string
    patterns?: string[]
  }
}): {
  permission: string
  description: string
  patterns?: string[]
} {
  return {
    permission: event.properties.permission,
    description: event.properties.description || `Request permission for ${event.properties.permission}`,
    patterns: event.properties.patterns,
  }
}

/**
 * Adapt question.asked event to UI format
 */
export function adaptQuestionAsked(event: {
  type: 'question.asked'
  properties: {
    text: string
  }
}): {
  text: string
} {
  return {
    text: event.properties.text,
  }
}

/**
 * Adapt file-watcher.updated event to UI format
 */
export function adaptFileWatcherEvent(event: {
  type: 'file-watcher.updated'
  properties: {
    event: 'create' | 'modify' | 'delete'
    path: string
  }
}): {
  type: 'create' | 'modify' | 'delete'
  path: string
  icon: string
} {
  const icons = {
    create: '📝',
    modify: '✏️',
    delete: '🗑️',
  }
  return {
    type: event.properties.event,
    path: event.properties.path,
    icon: icons[event.properties.event],
  }
}

/**
 * Adapt session.updated event to extract title
 */
export function adaptSessionUpdated(event: {
  type: 'session.updated'
  properties: {
    info: {
      id: string
      title: string
      summary?: { additions: number; deletions: number; files: number }
    }
  }
}): {
  id: string
  title: string
  summary?: { additions: number; deletions: number; files: number }
} {
  return {
    id: event.properties.info.id,
    title: event.properties.info.title,
    summary: event.properties.info.summary,
  }
}

/**
 * Adapt event to AI Elements display format
 * Returns component type and props for rendering
 */
export function adaptEventToAIElements(event: {
  type: string
  properties?: Record<string, unknown>
  [key: string]: unknown
}): {
  component: 'Message' | 'Tool' | 'Reasoning' | 'Loader' | 'Task' | 'Error' | 'System'
  props: Record<string, unknown>
  displayPriority: number
} | null {
  switch (event.type) {
    case 'message.part.updated': {
      const part = (event.properties as { part?: MessagePart })?.part
      if (!part) return null

      if (part.type === 'tool') {
        return {
          component: 'Tool',
          props: adaptToolPart(part as ToolPart),
          displayPriority: 7,
        }
      }
      if (part.type === 'reasoning') {
        return {
          component: 'Reasoning',
          props: adaptReasoningPart(part as ReasoningPart),
          displayPriority: 6,
        }
      }
      return null
    }
    case 'permission.asked':
      return {
        component: 'Message',
        props: {
          role: 'assistant',
          children: adaptPermissionAsked(event as Parameters<typeof adaptPermissionAsked>[0]),
        },
        displayPriority: 9, // High priority - needs user action
      }
    case 'question.asked':
      return {
        component: 'Message',
        props: {
          role: 'assistant',
          children: adaptQuestionAsked(event as Parameters<typeof adaptQuestionAsked>[0]),
        },
        displayPriority: 8,
      }
    case 'file-watcher.updated':
      return {
        component: 'System',
        props: adaptFileWatcherEvent(event as Parameters<typeof adaptFileWatcherEvent>[0]),
        displayPriority: 3, // Low priority - informational
      }
    case 'session.updated':
      return {
        component: 'System',
        props: adaptSessionUpdated(event as Parameters<typeof adaptSessionUpdated>[0]),
        displayPriority: 5,
      }
    default:
      return null
  }
}
