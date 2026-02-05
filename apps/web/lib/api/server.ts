/**
 * API client helpers for Ship web app
 *
 * These functions provide a clean interface for calling the Ship API
 * from Server Components and Server Actions.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || process.env.API_BASE_URL || 'http://localhost:8787'

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
    cache: 'no-store', // Always fetch fresh data
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
    headers: { 'Content-Type': 'application/json' },
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

  const res = await fetch(`${API_URL}/chat/${encodeURIComponent(sessionId)}/messages?${params}`, { cache: 'no-store' })

  if (!res.ok) {
    throw new Error('Failed to fetch messages')
  }

  return res.json()
}

/**
 * Send a chat message and get streaming response
 */
export async function sendChatMessage(sessionId: string, content: string, mode?: 'build' | 'plan'): Promise<Response> {
  console.log(`[api] Sending chat message to ${API_URL}/chat/${sessionId}`)
  return fetch(`${API_URL}/chat/${encodeURIComponent(sessionId)}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
    },
    body: JSON.stringify({ content, mode }),
  })
}

/**
 * Stop chat streaming
 */
export async function stopChatStream(sessionId: string): Promise<void> {
  await fetch(`${API_URL}/chat/${encodeURIComponent(sessionId)}/stop`, {
    method: 'POST',
  })
}
