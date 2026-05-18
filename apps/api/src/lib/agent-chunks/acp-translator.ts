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

function extractDelta(params: Record<string, unknown> | undefined): string | null {
  if (!params) return null
  if (typeof params.delta === 'string') return params.delta
  if (typeof params.text === 'string') return params.text
  const content = params.content
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    const chunks = content.filter((c) => c && typeof c === 'object') as Array<Record<string, unknown>>
    const texts = chunks
      .map((c) => (typeof c.text === 'string' ? c.text : typeof c.content === 'string' ? c.content : ''))
      .filter(Boolean)
    if (texts.length) return texts.join('')
  }
  const msg = params.message as Record<string, unknown> | undefined
  if (msg && typeof msg.content === 'string') return msg.content
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

  const delta = extractDelta(params)
  if (!delta) return []

  let buf = state.textBuffers.get(STREAM_KEY)
  if (!buf) {
    buf = { partId: nextPartId(state), text: '' }
    state.textBuffers.set(STREAM_KEY, buf)
  }
  buf.text += delta

  return [makeMessagePartUpdated(state, { id: buf.partId, type: 'text', text: buf.text }, delta)]
}
