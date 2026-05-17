/**
 * Mutable per-turn state shared by the chunk handlers.
 *
 * Kept in its own module so handlers can be authored as pure functions of
 * `(chunk, state) → ShipSSEEvent[]`.
 *
 * @packageDocumentation
 */

/** Cached state for one tool call (input id, accumulated input json, status). */
export interface ToolCallTrace {
  partId: string
  callId: string
  toolName: string
  inputJson: string
  status: 'pending' | 'running' | 'completed' | 'error'
  startedAt: number
}

/** Translator state for one chat turn. */
export interface TranslatorState {
  readonly sessionId: string
  /** Stable Ship messageID emitted on every part. */
  messageId: string
  /** AI SDK `text-*` chunk id → buffer. */
  textBuffers: Map<string, { partId: string; text: string }>
  /** AI SDK `reasoning-*` chunk id → buffer. */
  reasoningBuffers: Map<string, { partId: string; text: string }>
  /** Tool call id → trace. */
  toolCalls: Map<string, ToolCallTrace>
  /** Monotonic counter for synthesized part ids. */
  partCounter: number
}

/** Build initial state for a session. */
export function createTranslatorState(sessionId: string): TranslatorState {
  return {
    sessionId,
    messageId: synthesizeId('msg', sessionId),
    textBuffers: new Map(),
    reasoningBuffers: new Map(),
    toolCalls: new Map(),
    partCounter: 0,
  }
}

/** Mint a unique id from a prefix and a session-derived seed. */
export function synthesizeId(prefix: string, sessionId: string): string {
  const seed = sessionId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8) || 'session'
  return `${prefix}-${seed}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

/** Mint a fresh part id and bump the counter. */
export function nextPartId(state: TranslatorState): string {
  return synthesizeId(`part-${++state.partCounter}`, state.sessionId)
}
