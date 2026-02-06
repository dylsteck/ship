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

export type MessagePart = TextPart | ToolPart | ReasoningPart | StepStartPart | StepFinishPart

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
  mode: 'build' | 'plan'
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
}

export type SessionStatus =
  | { type: 'idle' }
  | { type: 'busy' }
  | { type: 'retry'; attempt: number; message: string; next: number }

// ============ SSE Event Types ============

export type StatusEvent = {
  type: 'status'
  status: string
  message: string
  toolName?: string
  toolStatus?: string
  toolTitle?: string
}

export type MessagePartUpdatedEvent = {
  type: 'message.part.updated'
  properties: {
    part: MessagePart
    delta?: string
  }
}

export type MessageUpdatedEvent = {
  type: 'message.updated'
  properties: {
    info: Message
  }
}

export type SessionUpdatedEvent = {
  type: 'session.updated'
  properties: {
    info: SessionInfo
  }
}

export type SessionStatusEvent = {
  type: 'session.status'
  properties: {
    sessionID: string
    status: SessionStatus
  }
}

export type SessionIdleEvent = {
  type: 'session.idle'
  properties: {
    sessionID: string
  }
}

export type SessionErrorEvent = {
  type: 'session.error'
  properties: {
    sessionID: string
    error: {
      name: string
      data?: {
        message?: string
      }
      message?: string
    }
  }
}

export type SessionDiffEvent = {
  type: 'session.diff'
  properties: {
    sessionID: string
    diff: Array<{
      filename: string
      additions: number
      deletions: number
    }>
  }
}

export type TodoUpdatedEvent = {
  type: 'todo.updated'
  properties: {
    sessionID: string
    todos: Array<{
      id: string
      content: string
      status: 'pending' | 'in_progress' | 'completed' | 'cancelled'
      priority: 'high' | 'medium' | 'low'
    }>
  }
}

export type FileWatcherEvent = {
  type: 'file-watcher.updated'
  properties: {
    event: 'create' | 'modify' | 'delete'
    path: string
  }
}

export type PermissionAskedEvent = {
  type: 'permission.asked'
  properties: {
    sessionID: string
    id: string
    permission: string
    patterns?: string[]
    description?: string
    metadata?: Record<string, unknown>
  }
}

export type PermissionGrantedEvent = {
  type: 'permission.granted'
  properties: {
    sessionID: string
    id: string
    permission: string
  }
}

export type PermissionDeniedEvent = {
  type: 'permission.denied'
  properties: {
    sessionID: string
    id: string
    permission: string
  }
}

export type QuestionAskedEvent = {
  type: 'question.asked'
  properties: {
    sessionID: string
    id: string
    text: string
  }
}

export type QuestionRepliedEvent = {
  type: 'question.replied'
  properties: {
    sessionID: string
    id: string
    text: string
  }
}

export type QuestionRejectedEvent = {
  type: 'question.rejected'
  properties: {
    sessionID: string
    id: string
  }
}

export type CommandExecutedEvent = {
  type: 'command.executed'
  properties: {
    sessionID: string
    command: string
    output?: string
  }
}

export type SessionCreatedEvent = {
  type: 'session.created'
  properties: {
    info: SessionInfo
  }
}

export type SessionDeletedEvent = {
  type: 'session.deleted'
  properties: {
    sessionID: string
  }
}

export type SessionCompactedEvent = {
  type: 'session.compacted'
  properties: {
    sessionID: string
  }
}

export type MessageRemovedEvent = {
  type: 'message.removed'
  properties: {
    sessionID: string
    messageID: string
  }
}

export type OpencodeUrlEvent = {
  type: 'opencode-url'
  url: string
}

export type ServerConnectedEvent = {
  type: 'server.connected'
  properties: Record<string, never>
}

export type ServerHeartbeatEvent = {
  type: 'server.heartbeat'
  properties: Record<string, never>
}

export type HeartbeatEvent = {
  type: 'heartbeat'
  message: string
  eventCount: number
  timeSinceLastEvent: number
}

export type DoneEvent = {
  type: 'done'
}

export type ErrorEvent = {
  type: 'error'
  error: string
  category?: 'transient' | 'persistent' | 'user-action' | 'fatal'
  retryable?: boolean
  details?: string
}

export type SSEEvent =
  | StatusEvent
  | MessagePartUpdatedEvent
  | MessageUpdatedEvent
  | MessageRemovedEvent
  | SessionCreatedEvent
  | SessionUpdatedEvent
  | SessionDeletedEvent
  | SessionCompactedEvent
  | SessionStatusEvent
  | SessionIdleEvent
  | SessionErrorEvent
  | SessionDiffEvent
  | TodoUpdatedEvent
  | FileWatcherEvent
  | PermissionAskedEvent
  | PermissionGrantedEvent
  | PermissionDeniedEvent
  | QuestionAskedEvent
  | QuestionRepliedEvent
  | QuestionRejectedEvent
  | CommandExecutedEvent
  | OpencodeUrlEvent
  | ServerConnectedEvent
  | ServerHeartbeatEvent
  | HeartbeatEvent
  | DoneEvent
  | ErrorEvent

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
