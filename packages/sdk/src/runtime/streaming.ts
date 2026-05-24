/**
 * SSE streaming endpoints — not covered by generated JSON SDK functions.
 */

import { client } from '../generated/client.gen'

/** Body for starting a chat turn. */
export interface SendChatMessageOptions {
  sessionId: string
  content: string
  mode?: string
  model?: string
}

/**
 * POST /chat/:sessionId — returns raw SSE {@link Response}.
 */
export async function sendChatMessage(options: SendChatMessageOptions): Promise<Response> {
  const config = client.getConfig()
  const baseUrl = config.baseUrl ?? 'http://localhost:8787'
  const auth = typeof config.auth === 'function' ? await config.auth({} as never) : config.auth
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'text/event-stream',
  }
  if (auth) headers.Authorization = `Bearer ${auth}`

  return fetch(`${baseUrl}/chat/${encodeURIComponent(options.sessionId)}`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      content: options.content,
      mode: options.mode,
      ...(options.model ? { model: options.model } : {}),
    }),
    cache: 'no-store',
  })
}

/**
 * GET /chat/:sessionId/subscribe — compatibility idle SSE stream.
 */
export async function subscribeToChatStream(sessionId: string): Promise<Response> {
  const config = client.getConfig()
  const baseUrl = config.baseUrl ?? 'http://localhost:8787'
  const auth = typeof config.auth === 'function' ? await config.auth({} as never) : config.auth
  const headers: Record<string, string> = { Accept: 'text/event-stream' }
  if (auth) headers.Authorization = `Bearer ${auth}`

  return fetch(`${baseUrl}/chat/${encodeURIComponent(sessionId)}/subscribe`, {
    headers,
    cache: 'no-store',
  })
}

/** POST /chat/:sessionId/stop */
export async function stopChatStream(sessionId: string): Promise<void> {
  const config = client.getConfig()
  const baseUrl = config.baseUrl ?? 'http://localhost:8787'
  const auth = typeof config.auth === 'function' ? await config.auth({} as never) : config.auth
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (auth) headers.Authorization = `Bearer ${auth}`

  await fetch(`${baseUrl}/chat/${encodeURIComponent(sessionId)}/stop`, {
    method: 'POST',
    headers,
  })
}

/** POST /chat/:sessionId/retry */
export async function retryChatSession(sessionId: string): Promise<void> {
  const config = client.getConfig()
  const baseUrl = config.baseUrl ?? 'http://localhost:8787'
  const auth = typeof config.auth === 'function' ? await config.auth({} as never) : config.auth
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (auth) headers.Authorization = `Bearer ${auth}`

  const res = await fetch(`${baseUrl}/chat/${encodeURIComponent(sessionId)}/retry`, {
    method: 'POST',
    headers,
  })
  if (!res.ok) throw new Error('Failed to retry chat session')
}
