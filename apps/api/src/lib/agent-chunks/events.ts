/**
 * SSE event builders shared by chat streaming paths (`message.part.updated`, `session.error`, …).
 *
 * @packageDocumentation
 */

import type { TranslatorState } from './state'

/** Ship SSE event matching the frontend wire format. */
export interface ShipSSEEvent {
  type: string
  [key: string]: unknown
}

/** Token totals for one finished step. */
export interface StepFinishTotals {
  inputTokens: number
  outputTokens: number
  reasoningTokens: number
  cachedInputTokens: number
}

/**
 * Wrap a `part` payload as a `message.part.updated` Ship SSE event.
 */
export function makeMessagePartUpdated(
  state: TranslatorState,
  part: Record<string, unknown>,
  delta?: string,
): ShipSSEEvent {
  return {
    type: 'message.part.updated',
    properties: {
      part: { sessionID: state.sessionId, messageID: state.messageId, ...part },
      ...(delta !== undefined ? { delta } : {}),
    },
  }
}

/**
 * Build a `step-finish` part with token totals.
 */
export function makeStepFinishEvent(
  sessionId: string,
  messageId: string,
  totals: StepFinishTotals,
  reason: 'stop' | 'tool-calls' | 'unknown' = 'stop',
): ShipSSEEvent {
  return {
    type: 'message.part.updated',
    properties: {
      part: {
        sessionID: sessionId,
        messageID: messageId,
        id: `step-finish-${sessionId.slice(0, 8)}-${Date.now()}`,
        type: 'step-finish',
        reason,
        snapshot: '',
        cost: 0,
        tokens: {
          input: totals.inputTokens,
          output: totals.outputTokens,
          reasoning: totals.reasoningTokens,
          cache: { read: totals.cachedInputTokens, write: 0 },
        },
      },
    },
  }
}

/** Normalize usage-like structs into Ship totals (ACP backends rarely expose tokens — zeros are fine). */
export function totalsFromUsage(usage?: {
  inputTokens?: number
  outputTokens?: number
  reasoningTokens?: number
  cachedInputTokens?: number
}): StepFinishTotals {
  return {
    inputTokens: usage?.inputTokens ?? 0,
    outputTokens: usage?.outputTokens ?? 0,
    reasoningTokens: usage?.reasoningTokens ?? 0,
    cachedInputTokens: usage?.cachedInputTokens ?? 0,
  }
}

export function emptyStepTotals(): StepFinishTotals {
  return totalsFromUsage(undefined)
}

/** Build a `session.error` Ship SSE event. */
export function makeSessionErrorEvent(state: TranslatorState, message: string): ShipSSEEvent {
  return {
    type: 'session.error',
    properties: {
      sessionID: state.sessionId,
      error: { name: 'AgentError', data: { message } },
    },
  }
}
