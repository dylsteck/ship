// apps/web/lib/sse-types.ts

// ============ Base Types ============

export type ToolState = {
  status: 'pending' | 'running' | 'completed' | 'error'
  input: Record<string, unknown>
  raw?: string
  title?: string
  output?: string
  metadata?: Record<string, unknown>
  time?: {
    start: number
    end?: number
  }
}

export type TextPart = {
  id: string
  sessionID: string
  messageID: string
  type: 'text'
  text: string
  time?: {
    start: number
    end?: number
  }
}

export type ToolPart = {
  id: string
  sessionID: string
  messageID: string
  type: 'tool'
  callID: string
  tool: string
  state: ToolState
}

export type ReasoningPart = {
  id: string
  sessionID: string
  messageID: string
  type: 'reasoning'
  text: string
}

export type StepStartPart = {
  id: string
  sessionID: string
  messageID: string
  type: 'step-start'
  snapshot: string
}

export type StepFinishPart = {
  id: string
  sessionID: string
  messageID: string
  type: 'step-finish'
  reason: 'stop' | 'tool-calls' | 'unknown'
  snapshot: string
  cost: number
  tokens: {
    input: number
    output: number
    reasoning: number
    cache: { read: number; write: number }
  }
}

export type PlanPart = {
  id: string
  sessionID: string
  messageID: string
  type: 'plan'
  items: Array<{
    id: string
    title: string
    status: 'pending' | 'in_progress' | 'completed' | 'cancelled'
  }>
}

export type MessagePart = TextPart | ToolPart | ReasoningPart | StepStartPart | StepFinishPart | PlanPart

// ============ Message Types ============

export type UserMessage = {
  id: string
  sessionID: string
  role: 'user'
  time: { created: number }
  summary?: { title?: string; diffs: unknown[] }
  agent: string
  model: { providerID: string; modelID: string }
}

export type AssistantMessage = {
  id: string
  sessionID: string
  role: 'assistant'
  time: { created: number; completed?: number }
  parentID: string
  modelID: string
  providerID: string
  mode: string
  agent: string
  path: { cwd: string; root: string }
  cost: number
  tokens: {
    input: number
    output: number
    reasoning: number
    cache: { read: number; write: number }
  }
  finish?: 'stop' | 'tool-calls' | 'unknown'
  error?: { name: string; data: { message: string } }
}

export type Message = UserMessage | AssistantMessage

// ============ Session Types ============

export type SessionInfo = {
  id: string
  slug: string
  version: string
  projectID: string
  directory: string
  title: string
  time: { created: number; updated: number }
  summary: { additions: number; deletions: number; files: number }
  share?: { url: string }
  agentType?: string
}

export type SessionStatus =
  | { type: 'idle' }
  | { type: 'busy' }
  | { type: 'retry'; attempt: number; message: string; next: number }

import type { SSEEvent, MessagePartUpdatedEvent } from './sse-event-types'

export type { SSEEvent } from './sse-event-types'
export * from './sse-event-types'

// ============ Type Guards ============

export function isMessagePartUpdated(event: SSEEvent): event is MessagePartUpdatedEvent {
  return event.type === 'message.part.updated'
}

export function isToolPart(part: MessagePart): part is ToolPart {
  return part.type === 'tool'
}

export function isTextPart(part: MessagePart): part is TextPart {
  return part.type === 'text'
}

export function isReasoningPart(part: MessagePart): part is ReasoningPart {
  return part.type === 'reasoning'
}

export function isStepFinish(part: MessagePart): part is StepFinishPart {
  return part.type === 'step-finish'
}

/** Chat-route status values we exclude from Overview (not from agent harness) */
const CHAT_ROUTE_STATUS_VALUES = new Set([
  'sandbox-ready',
  'starting-agent-server',
  'cloning',
  'repo-ready',
  'reconnecting',
  'initializing',
  'provisioning',
  'retrying',
])

/** Event types emitted by chat route setup, not by agent harness */
const CHAT_ROUTE_EVENT_TYPES = new Set([
  'heartbeat',
  'agent-url',
  'opencode-url',
  'server.connected',
  'server.heartbeat',
])

/**
 * Returns true if the event comes from the agent harness (sandbox-agent).
 * Used to filter Overview events so we only show raw agent events, not
 * chat-route status like "sandbox ready", heartbeats, etc.
 */
export function isAgentHarnessEvent(eventType: string, payload?: unknown): boolean {
  if (CHAT_ROUTE_EVENT_TYPES.has(eventType)) return false
  if (eventType === 'status') {
    const status = (payload as { status?: string })?.status
    if (typeof status === 'string' && CHAT_ROUTE_STATUS_VALUES.has(status)) return false
  }
  return true
}
