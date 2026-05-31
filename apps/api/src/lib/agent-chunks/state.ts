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
  outputJson?: string
  status: 'pending' | 'running' | 'completed' | 'error'
  startedAt: number
  endedAt?: number
}

/** Reference to a final persisted part in first-seen order. */
export type OrderedPartRef =
  | { kind: 'text'; key: string }
  | { kind: 'reasoning'; key: string }
  | { kind: 'tool'; key: string }

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
  /** First-seen part order for final persistence. */
  orderedParts: OrderedPartRef[]
  /** Active text/reasoning segment keys for adjacent deltas. */
  activeTextKey?: string
  activeReasoningKey?: string
  /** Kind of the most recently inserted ordered part. */
  lastOrderedKind?: OrderedPartRef['kind']
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
    orderedParts: [],
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

/** Record a part once while preserving the first position of updates. */
export function recordOrderedPart(state: TranslatorState, part: OrderedPartRef): void {
  const exists = state.orderedParts.some((existing) => existing.kind === part.kind && existing.key === part.key)
  if (!exists) {
    state.orderedParts.push(part)
    state.lastOrderedKind = part.kind
  }
}

/** Returns the active adjacent text/reasoning buffer, segmenting after other part kinds. */
export function getWritableTextBuffer(
  state: TranslatorState,
  kind: 'text' | 'reasoning',
): { partId: string; text: string } {
  const activeKey = kind === 'text' ? state.activeTextKey : state.activeReasoningKey
  const buffers = kind === 'text' ? state.textBuffers : state.reasoningBuffers
  if (activeKey && state.lastOrderedKind === kind) {
    const active = buffers.get(activeKey)
    if (active) return active
  }

  const key = `${kind}-${state.partCounter + 1}`
  const buffer = { partId: nextPartId(state), text: '' }
  buffers.set(key, buffer)
  if (kind === 'text') state.activeTextKey = key
  else state.activeReasoningKey = key
  recordOrderedPart(state, { kind, key })
  return buffer
}
