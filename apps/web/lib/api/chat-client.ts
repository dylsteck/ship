/**
 * Browser-safe chat API calls using `setApiToken()` (session JWT).
 * Do not import `server.ts` from client components — it uses `next/headers`.
 */

import { API_URL } from '@/lib/config'
import { chatFetchHeaders } from './client'
import type { Message, RawEvent } from './chat-types'

export type { Message, RawEvent } from './chat-types'

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

export async function stopChatStream(sessionId: string): Promise<void> {
  await fetch(`${API_URL}/chat/${encodeURIComponent(sessionId)}/stop`, {
    method: 'POST',
    headers: chatFetchHeaders(),
  })
}

export async function subscribeToChatStream(sessionId: string): Promise<Response> {
  return fetch(`${API_URL}/chat/${encodeURIComponent(sessionId)}/subscribe`, {
    headers: chatFetchHeaders({ Accept: 'text/event-stream' }),
    cache: 'no-store',
  })
}
