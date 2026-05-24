/**
 * Tool-call notification extraction for the ACP translator.
 *
 * @packageDocumentation
 */

import { deriveToolPresentation } from '@ship/contracts'
import type { ToolState } from '@ship/contracts'
import { makeMessagePartUpdated, type ShipSSEEvent } from './events'
import { nextPartId, type TranslatorState } from './state'

export interface ToolCallData {
  toolCallId: string
  name: string
  rawStatus: string
  input: Record<string, unknown>
  output: string | undefined
}

const TOOL_CALL_SESSION_UPDATES = new Set([
  'tool_call',
  'tool_call_update',
  'tool_use',
  'tool_use_update',
  'tool_use_start',
  'tool_use_stop',
  'tool_use_delta',
  'tool_call_start',
  'tool_call_end',
  'tool_call_delta',
])

const TOOL_CALL_METHODS = new Set([
  'tool_call',
  'tool_use',
  'tool/call',
  'tool/use',
  'session/tool',
  'session/tool_call',
  'session/tool_use',
])

/** Extract normalized tool-call fields from an ACP notification. */
export function tryExtractToolCall(
  update: Record<string, unknown>,
  method: string,
  params: Record<string, unknown>,
): ToolCallData | null {
  const sessionUpdate = typeof update.sessionUpdate === 'string' ? update.sessionUpdate : ''
  const isToolUpdate = TOOL_CALL_SESSION_UPDATES.has(sessionUpdate)
  const isToolMethod = TOOL_CALL_METHODS.has(method)
  if (!isToolUpdate && !isToolMethod) return null

  const src = isToolUpdate ? update : params
  const toolCallId =
    typeof src.toolCallId === 'string'
      ? src.toolCallId
      : typeof src.toolId === 'string'
        ? src.toolId
        : typeof src.callId === 'string'
          ? src.callId
          : typeof src.id === 'string'
            ? src.id
            : ''
  if (!toolCallId) return null

  const name =
    typeof src.title === 'string' && src.title
      ? src.title
      : typeof src.toolName === 'string' && src.toolName
        ? src.toolName
        : typeof src.name === 'string' && src.name
          ? src.name
          : typeof src.tool === 'string' && src.tool
            ? src.tool
            : 'tool'

  const rawStatus = typeof src.status === 'string' ? src.status : 'pending'
  const input: Record<string, unknown> =
    src.rawInput && typeof src.rawInput === 'object' && !Array.isArray(src.rawInput)
      ? (src.rawInput as Record<string, unknown>)
      : src.input && typeof src.input === 'object' && !Array.isArray(src.input)
        ? (src.input as Record<string, unknown>)
        : src.args && typeof src.args === 'object' && !Array.isArray(src.args)
          ? (src.args as Record<string, unknown>)
          : {}

  const output: string | undefined =
    typeof src.rawOutput === 'string'
      ? src.rawOutput
      : src.rawOutput && typeof src.rawOutput === 'object'
        ? JSON.stringify(src.rawOutput)
        : typeof src.output === 'string'
          ? src.output
          : src.output && typeof src.output === 'object'
            ? JSON.stringify(src.output)
            : typeof src.result === 'string'
              ? src.result
              : src.result && typeof src.result === 'object'
                ? JSON.stringify(src.result)
                : undefined

  return { toolCallId, name, rawStatus, input, output }
}

function mapToolStatus(rawStatus: string): ToolState['status'] {
  switch (rawStatus) {
    case 'pending':
      return 'pending'
    case 'in_progress':
    case 'running':
    case 'started':
      return 'running'
    case 'completed':
    case 'done':
    case 'success':
      return 'completed'
    case 'error':
    case 'failed':
    case 'failure':
      return 'error'
    default:
      return 'pending'
  }
}

/** Translate one tool notification into Ship SSE tool parts with presentation fields. */
export function translateToolCall(state: TranslatorState, data: ToolCallData): ShipSSEEvent[] {
  const status = mapToolStatus(data.rawStatus)
  let trace = state.toolCalls.get(data.toolCallId)
  if (!trace) {
    trace = {
      partId: nextPartId(state),
      callId: data.toolCallId,
      toolName: data.name,
      inputJson: JSON.stringify(data.input),
      status,
      startedAt: Date.now(),
    }
    state.toolCalls.set(data.toolCallId, trace)
  } else {
    trace.status = status
    if (Object.keys(data.input).length > 0) trace.inputJson = JSON.stringify(data.input)
    if (data.output !== undefined) {
      trace.outputJson = data.output
      trace.endedAt = Date.now()
    }
  }

  const toolState: ToolState = {
    status,
    input: data.input,
    title: trace.toolName,
    ...(data.output !== undefined ? { output: data.output } : {}),
    time: { start: trace.startedAt, ...(trace.endedAt ? { end: trace.endedAt } : {}) },
  }
  const presentation = deriveToolPresentation(trace.toolName, toolState)

  return [
    makeMessagePartUpdated(state, {
      id: trace.partId,
      type: 'tool',
      callID: data.toolCallId,
      tool: trace.toolName,
      displayLabel: presentation.summary,
      ...(presentation.detail ? { activityKind: presentation.detail } : {}),
      state: toolState,
    }),
  ]
}

/** Build persisted tool parts from accumulated traces. */
export function buildToolPartsFromState(state: TranslatorState): Record<string, unknown>[] {
  const base = { sessionID: state.sessionId, messageID: state.messageId }
  const parts: Record<string, unknown>[] = []

  for (const trace of state.toolCalls.values()) {
    const input = (() => {
      try {
        return JSON.parse(trace.inputJson) as Record<string, unknown>
      } catch {
        return {}
      }
    })()
    const toolState: ToolState = {
      status: trace.status,
      input,
      title: trace.toolName,
      ...(trace.outputJson !== undefined ? { output: trace.outputJson } : {}),
      time: { start: trace.startedAt, ...(trace.endedAt ? { end: trace.endedAt } : {}) },
    }
    const presentation = deriveToolPresentation(trace.toolName, toolState)
    parts.push({
      ...base,
      id: trace.partId,
      type: 'tool',
      callID: trace.callId,
      tool: trace.toolName,
      displayLabel: presentation.summary,
      ...(presentation.detail ? { activityKind: presentation.detail } : {}),
      state: toolState,
    })
  }

  return parts
}
