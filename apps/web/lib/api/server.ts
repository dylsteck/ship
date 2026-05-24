/**
 * Server-side API helpers using `@ship/sdk`.
 *
 * @remarks
 * Configures the SDK with the session JWT from cookies before each call batch.
 */

import { cookies } from 'next/headers'
import {
  configureShipClient,
  deleteSessionsBySessionId,
  getChatBySessionIdEvents,
  getChatBySessionIdMessages,
  getSessions,
  getSessionsBySessionId,
  postSessions,
  unwrapSdkData,
  type CreateSessionBody,
  type Session,
} from '@ship/sdk'
import { API_URL } from '@/lib/config'
import { sendChatMessage, stopChatStream } from '@ship/sdk/streaming'
import type { Message, RawEvent } from './chat-types'
import { normalizeChatEvent, normalizeChatMessage } from './normalize'

export type { Message, RawEvent as ChatEvent }
export type ChatSession = Omit<Session, 'archivedAt'> & {
  archivedAt: number | null
  messageCount?: number
  branch?: string
}

async function withServerAuth<T>(fn: () => Promise<T>): Promise<T> {
  const cookieStore = await cookies()
  const jwt = cookieStore.get('session')?.value ?? null
  configureShipClient({
    baseUrl: API_URL,
    getAuthToken: () => jwt,
  })
  return fn()
}

export async function fetchSessions(): Promise<Session[]> {
  return withServerAuth(async () => unwrapSdkData(await getSessions()))
}

export async function createSession(data: CreateSessionBody): Promise<Session> {
  return withServerAuth(async () => unwrapSdkData(await postSessions({ body: data })))
}

export async function getSession(id: string): Promise<Session> {
  return withServerAuth(async () => unwrapSdkData(await getSessionsBySessionId({ path: { sessionId: id } })))
}

export async function deleteSession(id: string): Promise<void> {
  await withServerAuth(async () => {
    unwrapSdkData(await deleteSessionsBySessionId({ path: { sessionId: id } }))
  })
}

export async function getChatMessages(
  sessionId: string,
  options?: { limit?: number; before?: string },
): Promise<Message[]> {
  return withServerAuth(async () => {
    const rows = unwrapSdkData(
      await getChatBySessionIdMessages({
        path: { sessionId },
        query: { limit: options?.limit?.toString(), before: options?.before },
      }),
    )
    return rows.map(normalizeChatMessage)
  })
}

export async function getChatEvents(sessionId: string): Promise<RawEvent[]> {
  return withServerAuth(async () => {
    try {
      const rows = unwrapSdkData(await getChatBySessionIdEvents({ path: { sessionId } }))
      return rows.map(normalizeChatEvent)
    } catch {
      return []
    }
  })
}

export async function sendChatMessageFromServer(
  sessionId: string,
  content: string,
  mode?: string,
): Promise<Response> {
  await withServerAuth(async () => undefined)
  return sendChatMessage({ sessionId, content, mode })
}

export { sendChatMessageFromServer as sendChatMessage }

export async function stopChatStreamFromServer(sessionId: string): Promise<void> {
  await withServerAuth(async () => undefined)
  await stopChatStream(sessionId)
}

export { stopChatStreamFromServer as stopChatStream }
