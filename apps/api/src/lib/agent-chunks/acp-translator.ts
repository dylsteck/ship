/**
 * Maps ACP JSON-RPC notifications → Ship `message.part.updated` SSE events.
 *
 * @remarks
 * Vendors diverge on notification payloads — `extractDelta` stays intentionally permissive.
 * Tool call translation covers confirmed OpenCode fields and common variants used by
 * Cursor, Claude-agent, and Codex (field-name aliases handled via tryExtractToolCall).
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

// ---------------------------------------------------------------------------
// Tool call extraction — covers all four ACP backends
// ---------------------------------------------------------------------------

interface ToolCallData {
  toolCallId: string
  name: string
  rawStatus: string
  input: Record<string, unknown>
  output: string | undefined
}

const TOOL_CALL_SESSION_UPDATES = new Set([
  // OpenCode (confirmed from logs)
  'tool_call',
  'tool_call_update',
  // Common variants from other backends
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

function tryExtractToolCall(
  update: Record<string, unknown>,
  method: string,
  params: Record<string, unknown>,
): ToolCallData | null {
  const sessionUpdate = typeof update.sessionUpdate === 'string' ? update.sessionUpdate : ''
  const isToolUpdate = TOOL_CALL_SESSION_UPDATES.has(sessionUpdate)
  const isToolMethod = TOOL_CALL_METHODS.has(method)

  if (!isToolUpdate && !isToolMethod) return null

  // Resolve the data source — update block wins over top-level params for session/update notifications
  const src = isToolUpdate ? update : params

  // Tool call id — multiple field names across backends
  const toolCallId =
    typeof src.toolCallId === 'string' ? src.toolCallId :
    typeof src.toolId === 'string' ? src.toolId :
    typeof src.callId === 'string' ? src.callId :
    typeof src.id === 'string' ? src.id : ''

  if (!toolCallId) return null

  // Tool name — backends use title, toolName, name, tool; skip empty strings
  const name =
    (typeof src.title === 'string' && src.title) ? src.title :
    (typeof src.toolName === 'string' && src.toolName) ? src.toolName :
    (typeof src.name === 'string' && src.name) ? src.name :
    (typeof src.tool === 'string' && src.tool) ? src.tool : 'tool'

  // Status — OpenCode: "pending" / "in_progress" / "completed" / "error"
  const rawStatus = typeof src.status === 'string' ? src.status : 'pending'

  // Input — rawInput (OpenCode), input, args, parameters
  const input: Record<string, unknown> =
    (src.rawInput && typeof src.rawInput === 'object' && !Array.isArray(src.rawInput))
      ? (src.rawInput as Record<string, unknown>)
    : (src.input && typeof src.input === 'object' && !Array.isArray(src.input))
      ? (src.input as Record<string, unknown>)
    : (src.args && typeof src.args === 'object' && !Array.isArray(src.args))
      ? (src.args as Record<string, unknown>)
    : {}

  // Output — rawOutput, output, result (accept string or object, stringify objects)
  const output: string | undefined =
    typeof src.rawOutput === 'string' ? src.rawOutput :
    (src.rawOutput && typeof src.rawOutput === 'object') ? JSON.stringify(src.rawOutput) :
    typeof src.output === 'string' ? src.output :
    (src.output && typeof src.output === 'object') ? JSON.stringify(src.output) :
    typeof src.result === 'string' ? src.result :
    (src.result && typeof src.result === 'object') ? JSON.stringify(src.result) : undefined

  return { toolCallId, name, rawStatus, input, output }
}

function mapToolStatus(rawStatus: string): 'pending' | 'running' | 'completed' | 'error' {
  switch (rawStatus) {
    case 'pending': return 'pending'
    case 'in_progress': case 'running': case 'started': return 'running'
    case 'completed': case 'done': case 'success': return 'completed'
    case 'error': case 'failed': case 'failure': return 'error'
    default: return 'pending'
  }
}

function translateToolCall(state: TranslatorState, data: ToolCallData): ShipSSEEvent[] {
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
    if (Object.keys(data.input).length > 0) {
      trace.inputJson = JSON.stringify(data.input)
    }
  }

  const toolName = trace.toolName
  return [
    makeMessagePartUpdated(state, {
      id: trace.partId,
      type: 'tool',
      callID: data.toolCallId,
      tool: toolName,
      state: {
        status,
        input: data.input,
        title: toolName,
        ...(data.output !== undefined ? { output: data.output } : {}),
        time: { start: trace.startedAt },
      },
    }),
  ]
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

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
  if (method.includes('permission')) return []

  const params = note.params as Record<string, unknown> | undefined
  const update = params?.update as Record<string, unknown> | undefined
  const sessionUpdate = typeof update?.sessionUpdate === 'string' ? update.sessionUpdate : ''

  // Tool call events — all backends
  const toolData = tryExtractToolCall(update ?? {}, method, params ?? {})
  if (toolData) {
    return translateToolCall(state, toolData)
  }

  // Text / reasoning
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
