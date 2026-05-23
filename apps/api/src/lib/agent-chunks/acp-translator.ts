/**
 * Maps ACP JSON-RPC notifications → Ship `message.part.updated` SSE events.
 *
 * @remarks
 * Vendors diverge on notification payloads — `extractDelta` stays intentionally permissive.
 *
 * @packageDocumentation
 */

import { makeMessagePartUpdated, type ShipSSEEvent } from './events'
import { createTranslatorState, nextPartId, type TranslatorState } from './state'

const STREAM_KEY = 'acp-text-stream'
const REASONING_STREAM_KEY = 'acp-reasoning-stream'

function extractContentText(content: unknown): string | null {
  if (typeof content === 'string') return content
  if (!content) return null
  if (Array.isArray(content)) {
    const texts = content
      .filter((c) => c && typeof c === 'object')
      .map((c) => {
        const chunk = c as Record<string, unknown>
        return typeof chunk.text === 'string' ? chunk.text : typeof chunk.content === 'string' ? chunk.content : ''
      })
      .filter(Boolean)
    return texts.length ? texts.join('') : null
  }
  if (typeof content === 'object') {
    const obj = content as Record<string, unknown>
    if (typeof obj.text === 'string') return obj.text
    if (typeof obj.content === 'string') return obj.content
  }
  return null
}

function extractDelta(params: Record<string, unknown> | undefined): string | null {
  if (!params) return null
  if (typeof params.delta === 'string') return params.delta
  if (typeof params.text === 'string') return params.text
  const contentText = extractContentText(params.content)
  if (contentText) return contentText
  const msg = params.message as Record<string, unknown> | undefined
  if (msg && typeof msg.content === 'string') return msg.content
  const update = params.update as Record<string, unknown> | undefined
  if (update) return extractContentText(update.content)
  return null
}

export interface AcpNotificationTranslator {
  readonly messageId: string
  translateNotification(note: Record<string, unknown>): ShipSSEEvent[]
}

export function createAcpNotificationTranslator(sessionId: string): AcpNotificationTranslator {
  const state = createTranslatorState(sessionId)
  return {
    messageId: state.messageId,
    translateNotification(note) {
      return translate(state, note)
    },
  }
}

function translate(state: TranslatorState, note: Record<string, unknown>): ShipSSEEvent[] {
  if (note.result !== undefined && note.result !== null && typeof note.result === 'object') {
    const r = note.result as Record<string, unknown>
    const blob =
      typeof r.assistant === 'string'
        ? r.assistant
        : typeof r.content === 'string'
          ? r.content
          : extractDelta(r)
    if (blob) {
      let buf = state.textBuffers.get(STREAM_KEY)
      if (!buf) {
        buf = { partId: nextPartId(state), text: '' }
        state.textBuffers.set(STREAM_KEY, buf)
      }
      buf.text += blob
      return [makeMessagePartUpdated(state, { id: buf.partId, type: 'text', text: buf.text }, blob)]
    }
  }

  const method = typeof note.method === 'string' ? note.method : ''
  if (!method && note.result !== undefined) return []

  // Cursor permission UX starts at auto allow-once — handled in the runner (JSON-RPC response path).
  if (method.includes('permission')) return []

  const params = note.params as Record<string, unknown> | undefined
  const update = params?.update as Record<string, unknown> | undefined
  const sessionUpdate = typeof update?.sessionUpdate === 'string' ? update.sessionUpdate : ''
  const partType = sessionUpdate === 'agent_thought_chunk' ? 'reasoning' : 'text'

  const delta = extractDelta(params)
  if (!delta) return []

  const key = partType === 'reasoning' ? REASONING_STREAM_KEY : STREAM_KEY
  let buf = state.textBuffers.get(key)
  if (!buf) {
    buf = { partId: nextPartId(state), text: '' }
    state.textBuffers.set(key, buf)
  }
  buf.text += delta

  return [makeMessagePartUpdated(state, { id: buf.partId, type: partType, text: buf.text }, delta)]
}
