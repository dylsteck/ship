/**
 * Maps ACP JSON-RPC notifications → Ship `message.part.updated` SSE events.
 *
 * @remarks
 * Vendors diverge on notification payloads — `extractDelta` stays intentionally permissive.
 * Tool call translation lives in {@link acp-tool-notifications} and covers OpenCode plus
 * common variants from Cursor, Claude-agent, and Codex.
 *
 * @packageDocumentation
 */

import {
  buildToolPartsFromState,
  translateToolCall,
  tryExtractToolCall,
} from './acp-tool-notifications'
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
  /** Build the final persisted parts array for this turn (tool + reasoning + text). */
  getFinalParts(): Record<string, unknown>[]
}

export function createAcpNotificationTranslator(sessionId: string): AcpNotificationTranslator {
  const state = createTranslatorState(sessionId)
  return {
    messageId: state.messageId,
    translateNotification(note) {
      return translate(state, note)
    },
    getFinalParts() {
      const parts: Record<string, unknown>[] = []
      const base = { sessionID: state.sessionId, messageID: state.messageId }

      for (const buf of state.textBuffers.values()) {
        if (buf.text) parts.push({ ...base, id: buf.partId, type: 'text', text: buf.text })
      }
      for (const buf of state.reasoningBuffers.values()) {
        if (buf.text) parts.push({ ...base, id: buf.partId, type: 'reasoning', text: buf.text })
      }
      parts.push(...buildToolPartsFromState(state))

      return parts
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
  if (method.includes('permission')) return []

  const params = note.params as Record<string, unknown> | undefined
  const update = params?.update as Record<string, unknown> | undefined
  const sessionUpdate = typeof update?.sessionUpdate === 'string' ? update.sessionUpdate : ''

  const toolData = tryExtractToolCall(update ?? {}, method, params ?? {})
  if (toolData) return translateToolCall(state, toolData)

  const partType = sessionUpdate === 'agent_thought_chunk' ? 'reasoning' : 'text'
  const delta = extractDelta(params)
  if (!delta) return []

  const key = partType === 'reasoning' ? REASONING_STREAM_KEY : STREAM_KEY
  const buffers = partType === 'reasoning' ? state.reasoningBuffers : state.textBuffers
  let buf = buffers.get(key)
  if (!buf) {
    buf = { partId: nextPartId(state), text: '' }
    buffers.set(key, buf)
  }
  buf.text += delta

  return [makeMessagePartUpdated(state, { id: buf.partId, type: partType, text: buf.text }, delta)]
}
