/** Shared types for {@link SessionDO} SQLite storage and RPC payloads. */

/** Connection state attached to each WebSocket (survives hibernation). */
export interface ConnectionState {
  connectedAt: number
  lastSeen: number
  userId?: string
}

/** Message row type matching SQLite return values. */
export interface MessageRow extends Record<string, SqlStorageValue> {
  id: string
  role: string
  content: string
  parts: string | null
  created_at: number
}

/** Chat message persisted in the session DO. */
export interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  parts?: string
  createdAt: number
}

/** Structured part within a chat message. */
export interface MessagePart {
  type: 'text' | 'tool-call' | 'tool-result'
  content?: string
  toolName?: string
  toolInput?: unknown
  toolOutput?: unknown
  state?: 'pending' | 'running' | 'complete' | 'error'
}

/** Agent task inferred from chat. */
export interface Task {
  id: string
  title: string
  description?: string
  status: 'pending' | 'running' | 'complete' | 'error'
  mode: 'build' | 'plan'
  createdAt: number
  completedAt?: number
}

/** Task row type matching SQLite return values. */
export interface TaskRow extends Record<string, SqlStorageValue> {
  id: string
  title: string
  description: string | null
  status: string
  mode: string
  created_at: number
  completed_at: number | null
}

/** Session meta key-value pair matching SQLite return values. */
export interface SessionMetaRow extends Record<string, SqlStorageValue> {
  key: string
  value: string
}

/** Returns true when D1 is missing the legacy `parts` column. */
export function isMissingPartsColumnError(error: unknown): boolean {
  return String(error).includes('no column named parts') || String(error).includes('no such column: parts')
}
