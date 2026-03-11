/**
 * API client helpers for Ship web app
 *
 * These functions provide a clean interface for calling the Ship API
 * from Server Components and Server Actions.
 */

import { API_URL } from '@/lib/config'
import { getApiToken } from './client'

const API_SECRET = typeof process !== 'undefined' ? process.env?.API_SECRET : undefined

function serverAuthHeaders(extra?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  // Server-side: use API_SECRET. Client-side: use session JWT from client token store.
  if (API_SECRET) {
    headers['Authorization'] = `Bearer ${API_SECRET}`
  } else {
    const clientToken = getApiToken()
    if (clientToken) headers['Authorization'] = `Bearer ${clientToken}`
  }
  return { ...headers, ...extra }
}

// Session types matching API response
export interface ChatSession {
  id: string
  userId: string
  repoOwner: string
  repoName: string
  status: string
  lastActivity: number
  createdAt: number
  archivedAt: number | null
  messageCount?: number
  title?: string
  model?: string
  agentType?: string
}

export interface CreateSessionData {
  userId: string
  repoOwner: string
  repoName: string
}

/**
 * Fetch all sessions for a user
 */
export async function fetchSessions(userId: string): Promise<ChatSession[]> {
  const res = await fetch(`${API_URL}/sessions?userId=${encodeURIComponent(userId)}`, {
    headers: serverAuthHeaders(),
    cache: 'no-store',
  })

  if (!res.ok) {
    throw new Error('Failed to fetch sessions')
  }

  return res.json()
}

/**
 * Create a new session
 */
export async function createSession(data: CreateSessionData): Promise<ChatSession> {
  const res = await fetch(`${API_URL}/sessions`, {
    method: 'POST',
    headers: serverAuthHeaders(),
    body: JSON.stringify(data),
  })

  if (!res.ok) {
    throw new Error('Failed to create session')
  }

  return res.json()
}

/**
 * Get a single session by ID
 */
export async function getSession(id: string): Promise<ChatSession> {
  const res = await fetch(`${API_URL}/sessions/${encodeURIComponent(id)}`, {
    headers: serverAuthHeaders(),
    cache: 'no-store',
  })

  if (!res.ok) {
    if (res.status === 404) {
      throw new Error('Session not found')
    }
    throw new Error('Failed to fetch session')
  }

  return res.json()
}

/**
 * Delete a session
 */
export async function deleteSession(id: string): Promise<void> {
  const res = await fetch(`${API_URL}/sessions/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: serverAuthHeaders(),
  })

  if (!res.ok) {
    throw new Error('Failed to delete session')
  }
}

// Message types for chat - aligned with message-list.tsx
export interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  parts?: string // JSON string of tool parts from API
  createdAt: number
  // Message type fields
  type?: 'error' | 'pr-notification'
  errorCategory?: 'transient' | 'persistent' | 'user-action' | 'fatal'
  retryable?: boolean
  // AI Elements data - persisted from streaming
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

export interface MessagePart {
  type: 'text' | 'tool-call' | 'tool-result'
  content?: string
  toolName?: string
  toolInput?: unknown
  toolOutput?: unknown
  state?: 'pending' | 'running' | 'complete' | 'error'
}

/**
 * Get chat messages with pagination
 */
export async function getChatMessages(
  sessionId: string,
  options?: { limit?: number; before?: string },
): Promise<Message[]> {
  const params = new URLSearchParams()
  if (options?.limit) params.set('limit', options.limit.toString())
  if (options?.before) params.set('before', options.before)

  const res = await fetch(`${API_URL}/chat/${encodeURIComponent(sessionId)}/messages?${params}`, {
    headers: serverAuthHeaders(),
    cache: 'no-store',
  })

  if (!res.ok) {
    throw new Error('Failed to fetch messages')
  }

  return res.json()
}

/**
 * Send a chat message and get streaming response
 * Uses fetch with explicit streaming configuration
 */
export async function sendChatMessage(sessionId: string, content: string, mode?: string): Promise<Response> {
  const url = `${API_URL}/chat/${encodeURIComponent(sessionId)}`

  const response = await fetch(url, {
    method: 'POST',
    headers: serverAuthHeaders({ Accept: 'text/event-stream' }),
    body: JSON.stringify({ content, mode }),
    cache: 'no-store',
  })

  return response
}

/**
 * Stop chat streaming
 */
export async function stopChatStream(sessionId: string): Promise<void> {
  await fetch(`${API_URL}/chat/${encodeURIComponent(sessionId)}/stop`, {
    method: 'POST',
    headers: serverAuthHeaders(),
  })
}

/**
 * Subscribe to an active chat stream (resume after page reload).
 * Returns a streaming Response; if session is not running, returns ok with session.idle and empty body.
 */
export async function subscribeToChatStream(sessionId: string): Promise<Response> {
  const response = await fetch(`${API_URL}/chat/${encodeURIComponent(sessionId)}/subscribe`, {
    headers: serverAuthHeaders({ Accept: 'text/event-stream' }),
    cache: 'no-store',
  })
  return response
}
