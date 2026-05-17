/**
 * Handlers for AI SDK tool-call chunks.
 *
 * @packageDocumentation
 */

import type { UIMessageChunk } from 'ai'
import { makeMessagePartUpdated, type ShipSSEEvent } from './events'
import { nextPartId, type ToolCallTrace, type TranslatorState } from './state'

/** Tool call started — model is constructing input. */
export function handleToolStart(
  chunk: Extract<UIMessageChunk, { type: 'tool-input-start' }>,
  state: TranslatorState,
): ShipSSEEvent[] {
  const trace: ToolCallTrace = {
    partId: nextPartId(state),
    callId: chunk.toolCallId,
    toolName: chunk.toolName,
    inputJson: '',
    status: 'pending',
    startedAt: Date.now(),
  }
  state.toolCalls.set(chunk.toolCallId, trace)
  return [emitToolPart(state, trace, {})]
}

/** Streaming JSON characters of the tool input. */
export function handleToolInputDelta(
  chunk: Extract<UIMessageChunk, { type: 'tool-input-delta' }>,
  state: TranslatorState,
): ShipSSEEvent[] {
  const trace = state.toolCalls.get(chunk.toolCallId)
  if (!trace) return []
  trace.inputJson += chunk.inputTextDelta
  trace.status = 'running'
  return [emitToolPart(state, trace, safeParseObject(trace.inputJson))]
}

/** Final, fully-parsed tool input. */
export function handleToolInputAvailable(
  chunk: Extract<UIMessageChunk, { type: 'tool-input-available' }>,
  state: TranslatorState,
): ShipSSEEvent[] {
  const trace = ensureTrace(chunk.toolCallId, chunk.toolName, state)
  trace.inputJson = JSON.stringify(chunk.input ?? {})
  trace.status = 'running'
  return [emitToolPart(state, trace, (chunk.input ?? {}) as Record<string, unknown>)]
}

/** Tool returned a result. */
export function handleToolOutput(
  chunk: Extract<UIMessageChunk, { type: 'tool-output-available' }>,
  state: TranslatorState,
): ShipSSEEvent[] {
  const trace = state.toolCalls.get(chunk.toolCallId)
  if (!trace) return []
  trace.status = 'completed'
  return [
    emitToolPart(state, trace, safeParseObject(trace.inputJson), {
      output: serializeOutput(chunk.output),
      endedAt: Date.now(),
    }),
  ]
}

/** Tool threw / returned error text. */
export function handleToolError(
  chunk: Extract<UIMessageChunk, { type: 'tool-output-error' }>,
  state: TranslatorState,
): ShipSSEEvent[] {
  const trace = state.toolCalls.get(chunk.toolCallId)
  if (!trace) return []
  trace.status = 'error'
  return [
    emitToolPart(state, trace, safeParseObject(trace.inputJson), {
      output: chunk.errorText ?? 'Tool error',
      endedAt: Date.now(),
    }),
  ]
}

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

interface ToolPartExtras {
  output?: string
  endedAt?: number
}

function emitToolPart(
  state: TranslatorState,
  trace: ToolCallTrace,
  input: Record<string, unknown>,
  extras: ToolPartExtras = {},
): ShipSSEEvent {
  const time: { start: number; end?: number } = { start: trace.startedAt }
  if (extras.endedAt !== undefined) time.end = extras.endedAt
  return makeMessagePartUpdated(state, {
    id: trace.partId,
    type: 'tool',
    callID: trace.callId,
    tool: trace.toolName,
    state: {
      status: trace.status,
      input,
      ...(extras.output !== undefined ? { output: extras.output } : {}),
      title: trace.toolName,
      time,
    },
  })
}

function ensureTrace(callId: string, toolName: string, state: TranslatorState): ToolCallTrace {
  const existing = state.toolCalls.get(callId)
  if (existing) return existing
  const trace: ToolCallTrace = {
    partId: nextPartId(state),
    callId,
    toolName,
    inputJson: '',
    status: 'pending',
    startedAt: Date.now(),
  }
  state.toolCalls.set(callId, trace)
  return trace
}

function safeParseObject(raw: string): Record<string, unknown> {
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw)
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {}
  } catch {
    return {}
  }
}

function serializeOutput(output: unknown): string {
  if (output === undefined || output === null) return ''
  if (typeof output === 'string') return output
  try {
    return JSON.stringify(output)
  } catch {
    return String(output)
  }
}
