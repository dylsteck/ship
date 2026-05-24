/**
 * Browser-safe chat helpers — delegates to `@ship/sdk` and `@ship/sdk/streaming`.
 */

import {
  getSessionsBySessionId,
  getSessionsBySessionIdSandbox,
  unwrapSdkData,
  type SandboxStatus,
  type Session,
} from '@ship/sdk'
import {
  retryChatSession,
  sendChatMessage,
  stopChatStream,
  subscribeToChatStream,
} from '@ship/sdk/streaming'
import type { Message, RawEvent } from './chat-types'

export type { Message, RawEvent } from './chat-types'
export { fetchChatEvents, fetchChatMessages } from './hooks/use-chat'

export type BrowserChatSession = Session
export type SessionSandboxStatus = SandboxStatus & {
  opencodeUrl?: string | null
  opencodeSessionId?: string | null
}

export async function getSession(sessionId: string): Promise<BrowserChatSession> {
  return unwrapSdkData(await getSessionsBySessionId({ path: { sessionId } }))
}

export async function getSessionSandbox(sessionId: string): Promise<SessionSandboxStatus | null> {
  try {
    return unwrapSdkData(await getSessionsBySessionIdSandbox({ path: { sessionId } }))
  } catch {
    return null
  }
}

export { sendChatMessage, stopChatStream, subscribeToChatStream, retryChatSession }

/** @deprecated Route removed — kept for import compatibility */
export async function streamSubagentSession(
  _parentSessionId: string,
  _subagentSessionId: string,
  _signal?: AbortSignal,
): Promise<Response> {
  return new Response(null, { status: 404, statusText: 'Not Found' })
}
