/**
 * API client helpers for Ship web app
 *
 * Server Components and Server Actions call the Ship API with the **session JWT**
 * from the `session` cookie when available, so Worker routes can bind identity to the JWT.
 * `API_SECRET` is only used when no session cookie is present (rare in SSR for logged-in pages).
 */

import { cookies } from 'next/headers'
import { API_URL } from '@/lib/config'
import { getApiToken } from './client'
import type { Message, RawEvent } from './chat-types'

export type { Message, MessagePart, RawEvent } from './chat-types'

const API_SECRET = typeof process !== 'undefined' ? process.env?.API_SECRET : undefined

/**
 * Builds `Authorization` and default headers for server-side API calls.
 * Prefers the encrypted session JWT cookie over `API_SECRET`.
 */
async function serverAuthHeaders(extra?: Record<string, string>): Promise<Record<string, string>> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...extra }
  const cookieStore = await cookies()
  const jwt = cookieStore.get('session')?.value
  if (jwt) {
    headers['Authorization'] = `Bearer ${jwt}`
    return headers
  }
  if (API_SECRET) {
    headers['Authorization'] = `Bearer ${API_SECRET}`
    return headers
  }
  const clientToken = getApiToken()
  if (clientToken) headers['Authorization'] = `Bearer ${clientToken}`
  return headers
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
  repoOwner: string
  repoName: string
  model?: string
  agentType?: string
  title?: string
  baseBranch?: string
}

/**
 * Fetch all sessions for the currently authenticated user (JWT from cookie).
 */
export async function fetchSessions(): Promise<ChatSession[]> {
  const res = await fetch(`${API_URL}/sessions`, {
    headers: await serverAuthHeaders(),
    cache: 'no-store',
  })

  if (!res.ok) {
    throw new Error('Failed to fetch sessions')
  }

  return res.json()
}

/**
 * Create a new session for the authenticated user.
 */
export async function createSession(data: CreateSessionData): Promise<ChatSession> {
  const res = await fetch(`${API_URL}/sessions`, {
    method: 'POST',
    headers: await serverAuthHeaders(),
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
    headers: await serverAuthHeaders(),
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
    headers: await serverAuthHeaders(),
  })

  if (!res.ok) {
    throw new Error('Failed to delete session')
  }
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
    headers: await serverAuthHeaders(),
    cache: 'no-store',
  })

  if (!res.ok) {
    throw new Error('Failed to fetch messages')
  }

  return res.json()
}

/**
 * Get persisted SSE events for a session (Overview inspector)
 */
export async function getChatEvents(sessionId: string): Promise<RawEvent[]> {
  const res = await fetch(`${API_URL}/chat/${encodeURIComponent(sessionId)}/events`, {
    headers: await serverAuthHeaders(),
    cache: 'no-store',
  })

  if (!res.ok) {
    return []
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
    headers: await serverAuthHeaders({ Accept: 'text/event-stream' }),
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
    headers: await serverAuthHeaders(),
  })
}

/**
 * Subscribe to an active chat stream (resume after page reload).
 * Returns a streaming Response; if session is not running, returns ok with session.idle and empty body.
 */
export async function subscribeToChatStream(sessionId: string): Promise<Response> {
  const response = await fetch(`${API_URL}/chat/${encodeURIComponent(sessionId)}/subscribe`, {
    headers: await serverAuthHeaders({ Accept: 'text/event-stream' }),
    cache: 'no-store',
  })
  return response
}
