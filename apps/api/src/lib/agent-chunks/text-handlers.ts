/**
 * Handlers for text and reasoning AI SDK chunks.
 *
 * @packageDocumentation
 */

import type { UIMessageChunk } from 'ai'
import { makeMessagePartUpdated, type ShipSSEEvent } from './events'
import { nextPartId, type TranslatorState } from './state'

interface PartBuffer {
  partId: string
  text: string
}

/** Begin tracking a fresh `text-*` stream id. */
export function handleTextStart(
  chunk: Extract<UIMessageChunk, { type: 'text-start' }>,
  state: TranslatorState,
): ShipSSEEvent[] {
  state.textBuffers.set(chunk.id, { partId: nextPartId(state), text: '' })
  return []
}

/** Append a text delta and emit an updated text part. */
export function handleTextDelta(
  chunk: Extract<UIMessageChunk, { type: 'text-delta' }>,
  state: TranslatorState,
): ShipSSEEvent[] {
  const buffer = ensureBuffer(state.textBuffers, chunk.id, state)
  buffer.text += chunk.delta
  return [makeMessagePartUpdated(state, { id: buffer.partId, type: 'text', text: buffer.text }, chunk.delta)]
}

/** Begin tracking a fresh `reasoning-*` stream id. */
export function handleReasoningStart(
  chunk: Extract<UIMessageChunk, { type: 'reasoning-start' }>,
  state: TranslatorState,
): ShipSSEEvent[] {
  state.reasoningBuffers.set(chunk.id, { partId: nextPartId(state), text: '' })
  return []
}

/** Append a reasoning delta and emit an updated reasoning part. */
export function handleReasoningDelta(
  chunk: Extract<UIMessageChunk, { type: 'reasoning-delta' }>,
  state: TranslatorState,
): ShipSSEEvent[] {
  const buffer = ensureBuffer(state.reasoningBuffers, chunk.id, state)
  buffer.text += chunk.delta
  return [makeMessagePartUpdated(state, { id: buffer.partId, type: 'reasoning', text: buffer.text }, chunk.delta)]
}

/** Lazy-initialize a part buffer when the upstream `*-start` chunk was missed. */
function ensureBuffer(buffers: Map<string, PartBuffer>, id: string, state: TranslatorState): PartBuffer {
  const existing = buffers.get(id)
  if (existing) return existing
  const buffer: PartBuffer = { partId: nextPartId(state), text: '' }
  buffers.set(id, buffer)
  return buffer
}
