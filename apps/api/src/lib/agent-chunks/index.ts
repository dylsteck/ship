/**
 * AI SDK `UIMessageChunk` → Ship SSE event translator.
 *
 * Composes the small handlers in this directory into a single stateful
 * translator. Handlers are pure `(chunk, state) → ShipSSEEvent[]`; this
 * file just routes the chunk discriminant to the right handler.
 *
 * @packageDocumentation
 */

import type { UIMessageChunk } from 'ai'
import { makeSessionErrorEvent, type ShipSSEEvent } from './events'
import { createTranslatorState, type TranslatorState } from './state'
import {
  handleReasoningDelta,
  handleReasoningStart,
  handleTextDelta,
  handleTextStart,
} from './text-handlers'
import {
  handleToolError,
  handleToolInputAvailable,
  handleToolInputDelta,
  handleToolOutput,
  handleToolStart,
} from './tool-handlers'

export type { ShipSSEEvent, StepFinishTotals } from './events'
export { makeStepFinishEvent, totalsFromUsage } from './events'

/**
 * Stateful translator handle.
 *
 * `translate` consumes an AI SDK chunk and returns zero or more Ship SSE
 * events. `messageId` is the synthesized id used in emitted parts and is
 * stable for the duration of the turn.
 */
export interface AgentChunkTranslator {
  /** Stable Ship messageID used in emitted SSE part objects. */
  readonly messageId: string
  /** Translate one AI SDK chunk to Ship SSE events. */
  translate(chunk: UIMessageChunk): ShipSSEEvent[]
}

/**
 * Build a stateful translator for one chat turn.
 *
 * @param sessionId - Ship session id (drives part/message ids).
 */
export function createAgentChunkTranslator(sessionId: string): AgentChunkTranslator {
  const state = createTranslatorState(sessionId)
  return {
    messageId: state.messageId,
    translate(chunk) {
      return route(chunk, state)
    },
  }
}

/**
 * Dispatch one chunk to the matching handler.
 *
 * Unknown / lifecycle-only chunks (`start`, `start-step`, `finish`, etc.)
 * yield no Ship events.
 */
function route(chunk: UIMessageChunk, state: TranslatorState): ShipSSEEvent[] {
  switch (chunk.type) {
    case 'text-start':
      return handleTextStart(chunk, state)
    case 'text-delta':
      return handleTextDelta(chunk, state)
    case 'reasoning-start':
      return handleReasoningStart(chunk, state)
    case 'reasoning-delta':
      return handleReasoningDelta(chunk, state)
    case 'tool-input-start':
      return handleToolStart(chunk, state)
    case 'tool-input-delta':
      return handleToolInputDelta(chunk, state)
    case 'tool-input-available':
      return handleToolInputAvailable(chunk, state)
    case 'tool-output-available':
      return handleToolOutput(chunk, state)
    case 'tool-output-error':
      return handleToolError(chunk, state)
    case 'error':
      return [makeSessionErrorEvent(state, chunk.errorText ?? 'Unknown agent error')]
    default:
      return []
  }
}
