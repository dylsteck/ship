// apps/web/lib/sse-parser.ts

import type { SSEEvent, MessagePart, ToolPart, TextPart } from './sse-types'

/**
 * Parse raw SSE event data into typed event
 * Handles nested events, wrapped events, and various event formats
 */
export function parseSSEEvent(data: unknown): SSEEvent | null {
  if (!data || typeof data !== 'object') return null

  const event = data as Record<string, unknown>

  // Handle wrapped events (server sends event inside 'event' field sometimes)
  if (event.event && typeof event.event === 'object') {
    return parseSSEEvent(event.event)
  }

  // Handle events wrapped with type: 'event' and properties
  if (event.type === 'event' && event.properties && typeof event.properties === 'object') {
    return parseSSEEvent(event.properties)
  }

  // Handle opencode-url event which has url at top level
  if (event.type === 'opencode-url' && event.url) {
    return {
      type: 'opencode-url',
      url: event.url as string,
    } as SSEEvent
  }

  const type = event.type
  if (typeof type !== 'string') return null

  return event as SSEEvent
}

/**
 * Extract text content from a message.part.updated event
 */
export function extractTextDelta(event: SSEEvent): string | null {
  if (event.type !== 'message.part.updated') return null

  const part = event.properties.part
  if (part.type !== 'text') return null

  // Prefer delta (incremental) over full text
  const delta = event.properties.delta
  if (typeof delta === 'string') return delta

  return (part as TextPart).text || null
}

/**
 * Extract tool info from a message.part.updated event
 */
export function extractToolInfo(event: SSEEvent): {
  callID: string
  tool: string
  status: string
  title?: string
  input?: unknown
  output?: string
} | null {
  if (event.type !== 'message.part.updated') return null

  const part = event.properties.part
  if (part.type !== 'tool') return null

  const toolPart = part as ToolPart
  return {
    callID: toolPart.callID,
    tool: toolPart.tool,
    status: toolPart.state.status,
    title: toolPart.state.title,
    input: toolPart.state.input,
    output: toolPart.state.output,
  }
}

/**
 * Get a human-readable status from an event
 */
export function getEventStatus(event: SSEEvent): { label: string; icon: string } | null {
  switch (event.type) {
    case 'status':
      return getStatusFromStatusEvent(event)
    case 'message.part.updated':
      return getStatusFromPartEvent(event)
    case 'session.status':
      return { label: event.properties.status.type, icon: event.properties.status.type === 'busy' ? '🔄' : '✅' }
    case 'heartbeat':
      return { label: `Waiting (${event.timeSinceLastEvent}s)`, icon: '⏳' }
    default:
      return null
  }
}

function getStatusFromStatusEvent(event: { type: 'status'; status: string; message: string }): {
  label: string
  icon: string
} {
  const statusIcons: Record<string, string> = {
    initializing: '🚀',
    provisioning: '📦',
    'sandbox-ready': '✅',
    'starting-opencode': '🔌',
    cloning: '📥',
    'repo-ready': '✅',
    'creating-session': '🔧',
    'sending-prompt': '📤',
    'agent-active': '⚡',
    'tool-call': '🔧',
    'agent-thinking': '💭',
  }

  return {
    label: event.message,
    icon: statusIcons[event.status] || '📡',
  }
}

function getStatusFromPartEvent(event: {
  type: 'message.part.updated'
  properties: { part: MessagePart }
}): { label: string; icon: string } | null {
  const part = event.properties.part

  switch (part.type) {
    case 'tool': {
      const toolPart = part as ToolPart
      const toolName = toolPart.tool.toLowerCase()

      if (toolName.includes('read') || toolName.includes('glob') || toolName.includes('grep')) {
        return { label: `Reading: ${toolPart.state.title || 'files...'}`, icon: '🔍' }
      }
      if (toolName.includes('write') || toolName.includes('edit')) {
        return { label: `Writing: ${toolPart.state.title || 'code...'}`, icon: '✏️' }
      }
      if (toolName.includes('bash') || toolName.includes('run') || toolName.includes('shell')) {
        return { label: `Running: ${toolPart.state.title || 'command...'}`, icon: '⚡' }
      }
      if (toolName.includes('task') || toolName.includes('agent')) {
        return { label: 'Creating task...', icon: '📋' }
      }
      return { label: `${toolPart.tool}: ${toolPart.state.title || ''}`, icon: '🔧' }
    }
    case 'text':
      return { label: 'Writing response...', icon: '✍️' }
    case 'reasoning':
      return { label: 'Reasoning...', icon: '💭' }
    case 'step-start':
      return { label: 'Starting step...', icon: '🚀' }
    case 'step-finish':
      return { label: 'Step complete', icon: '✅' }
    default:
      return null
  }
}

/**
 * Get cost info from step-finish event
 */
export function extractCostInfo(event: SSEEvent): {
  cost: number
  tokens: { input: number; output: number; reasoning: number; cacheRead: number; cacheWrite: number }
} | null {
  if (event.type !== 'message.part.updated') return null

  const part = event.properties.part
  if (part.type !== 'step-finish') return null

  return {
    cost: part.cost,
    tokens: {
      input: part.tokens.input,
      output: part.tokens.output,
      reasoning: part.tokens.reasoning,
      cacheRead: part.tokens.cache.read,
      cacheWrite: part.tokens.cache.write,
    },
  }
}
