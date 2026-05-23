/**
 * Browser-safe chat API calls using `setApiToken()` (session JWT).
 * Do not import `server.ts` from client components — it uses `next/headers`.
 */

import { API_URL } from '@/lib/config'
import { chatFetchHeaders } from './client'
import type { Message, RawEvent } from './chat-types'
import type { ChatSession } from './server'
import type { SandboxStatus } from './types'

export type { Message, RawEvent } from './chat-types'

/** Chat session payload used by browser session views. */
export interface BrowserChatSession extends ChatSession {
  branch?: string
}

/** Sandbox details returned for a chat session. */
export interface SessionSandboxStatus extends SandboxStatus {
  opencodeUrl?: string | null
  opencodeSessionId?: string | null
}

/** Fetch one chat session by ID from browser code. */
export async function getSession(sessionId: string): Promise<BrowserChatSession> {
  const res = await fetch(`${API_URL}/sessions/${encodeURIComponent(sessionId)}`, {
    headers: chatFetchHeaders(),
    cache: 'no-store',
  })

  if (!res.ok) {
    throw new Error('Failed to fetch session')
  }

  return res.json()
}

/** Fetch sandbox status for one chat session from browser code. */
export async function getSessionSandbox(sessionId: string): Promise<SessionSandboxStatus | null> {
  const res = await fetch(`${API_URL}/sessions/${encodeURIComponent(sessionId)}/sandbox`, {
    headers: chatFetchHeaders(),
    cache: 'no-store',
  })

  if (res.status === 404) return null

  if (!res.ok) {
    throw new Error('Failed to fetch session sandbox')
  }

  return res.json()
}

/** Fetch persisted chat messages for a session from browser code. */
export async function getChatMessages(
  sessionId: string,
  options?: { limit?: number; before?: string },
): Promise<Message[]> {
  const params = new URLSearchParams()
  if (options?.limit) params.set('limit', options.limit.toString())
  if (options?.before) params.set('before', options.before)

  const res = await fetch(`${API_URL}/chat/${encodeURIComponent(sessionId)}/messages?${params}`, {
    headers: chatFetchHeaders(),
    cache: 'no-store',
  })

  if (!res.ok) {
    throw new Error('Failed to fetch messages')
  }

  return res.json()
}

/** Fetch persisted SSE events for a session from browser code. */
export async function getChatEvents(sessionId: string): Promise<RawEvent[]> {
  const res = await fetch(`${API_URL}/chat/${encodeURIComponent(sessionId)}/events`, {
    headers: chatFetchHeaders(),
    cache: 'no-store',
  })

  if (!res.ok) {
    return []
  }

  return res.json()
}

/** Start a chat turn and return its SSE response. */
export async function sendChatMessage(
  sessionId: string,
  content: string,
  mode?: string,
  model?: string | null,
): Promise<Response> {
  const url = `${API_URL}/chat/${encodeURIComponent(sessionId)}`

  return fetch(url, {
    method: 'POST',
    headers: chatFetchHeaders({ Accept: 'text/event-stream' }),
    body: JSON.stringify({ content, mode, ...(model ? { model } : {}) }),
    cache: 'no-store',
  })
}

/** Ask the API to stop the active chat stream for a session. */
export async function stopChatStream(sessionId: string): Promise<void> {
  await fetch(`${API_URL}/chat/${encodeURIComponent(sessionId)}/stop`, {
    method: 'POST',
    headers: chatFetchHeaders(),
  })
}

/** Subscribe to the compatibility chat stream endpoint for a session. */
export async function subscribeToChatStream(sessionId: string): Promise<Response> {
  return fetch(`${API_URL}/chat/${encodeURIComponent(sessionId)}/subscribe`, {
    headers: chatFetchHeaders({ Accept: 'text/event-stream' }),
    cache: 'no-store',
  })
}

/** Clear paused/stopped flags so a failed chat operation can be retried. */
export async function retryChatSession(sessionId: string): Promise<void> {
  const res = await fetch(`${API_URL}/chat/${encodeURIComponent(sessionId)}/retry`, {
    method: 'POST',
    headers: chatFetchHeaders(),
  })

  if (!res.ok) {
    throw new Error('Failed to retry chat session')
  }
}

/** Stream a sub-agent transcript for the selected parent session. */
export async function streamSubagentSession(
  parentSessionId: string,
  subagentSessionId: string,
  signal?: AbortSignal,
): Promise<Response> {
  return fetch(
    `${API_URL}/chat/${encodeURIComponent(parentSessionId)}/subagent/${encodeURIComponent(subagentSessionId)}/stream`,
    {
      signal,
      headers: chatFetchHeaders({ Accept: 'text/event-stream' }),
      credentials: 'include',
      cache: 'no-store',
    },
  )
}
