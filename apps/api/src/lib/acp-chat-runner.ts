/**
 * Orchestrates one chat turn against an **ACP CLI running inside the E2B sandbox**.
 *
 * @remarks
 * The Worker never spawns subprocesses locally. {@link ensureAcpBridgeReady} starts
 * `ship-acp-bridge` in the VM; this module opens WSS, runs JSON-RPC (`initialize`,
 * `authenticate`, `session/prompt`), and streams {@link ShipSSEEvent}s for the web app.
 *
 * SessionDO meta used here: `acp_bridge_token`, `acp_relay_port`, `acp_backend_kind`,
 * `acp_protocol_session_id`, and the session `model` id (`ship-acp-*`).
 *
 * @packageDocumentation
 */

import type { Sandbox } from '@ship/sandbox'
import type { Env } from '../env.d'
import {
  createAcpNotificationTranslator,
  emptyStepTotals,
  makeStepFinishEvent,
  type ShipSSEEvent,
  type StepFinishTotals,
} from './agent-chunks'
import type { ChatTurnMessage } from './chat-history'
import { writeStatus, type SSEWriter } from './chat-stream-helpers'
import { ensureAcpBridgeReady, toBridgeWsUrl } from './acp-bridge-bootstrap'
import { createAcpMultiplexer, openBridgeWebSocket, sendCtl } from './acp-json-rpc'
import { DEFAULT_ACP_MODEL_ID, resolveAcpBackend, type AcpBackendKind } from './agent-registry'
import { parseAcpModelId } from './acp-types'

export interface RunChatTurnInput {
  sessionId: string
  sandbox: Sandbox
  messages: ChatTurnMessage[]
  /** Registry id (`ship-acp-*`) stored on SessionDO meta `model` */
  modelId?: string
  planMode?: boolean
  env: Env
  stream: SSEWriter
  stub: { fetch: typeof fetch }
  abortSignal?: AbortSignal
}

export interface ChatTurnResult {
  assistantText: string
  totals: StepFinishTotals
  /** Reserved — ACP tool spans may populate later. */
  hadToolCalls: boolean
}

const DO_URL = 'https://do'
const ACP_PROMPT_TIMEOUT_MS = 480_000

class AgentStoppedError extends Error {
  constructor() {
    super('Agent run stopped by user')
    this.name = 'AgentStoppedError'
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

async function patchMeta(stub: { fetch: typeof fetch }, patch: Record<string, string>): Promise<void> {
  await stub.fetch(
    new Request(`${DO_URL}/meta`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    }),
  )
}

async function readMeta(stub: { fetch: typeof fetch }): Promise<Record<string, string>> {
  const res = await stub.fetch(new Request(`${DO_URL}/meta`))
  return (await res.json()) as Record<string, string>
}

async function emitEvent(input: RunChatTurnInput, event: ShipSSEEvent): Promise<void> {
  await input.stream.writeSSE({ event: event.type, data: JSON.stringify(event) })
  const results = await Promise.allSettled([
    broadcastToDurableObject(input.stub, event),
    persistEventToDurableObject(input.stub, event),
  ])
  for (const result of results) {
    if (result.status === 'rejected') console.warn('[acp] failed to fan out event', result.reason)
  }
}

async function broadcastToDurableObject(stub: { fetch: typeof fetch }, event: ShipSSEEvent): Promise<void> {
  await stub.fetch(
    new Request(`${DO_URL}/broadcast`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'agent-event', event }),
    }),
  )
}

async function persistEventToDurableObject(stub: { fetch: typeof fetch }, event: ShipSSEEvent): Promise<void> {
  await stub.fetch(
    new Request(`${DO_URL}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        events: [
          {
            id: crypto.randomUUID(),
            type: event.type,
            timestamp: Date.now(),
            payload: event,
          },
        ],
      }),
    }),
  )
}

async function persistAssistantMessage(stub: { fetch: typeof fetch }, content: string): Promise<void> {
  if (!content.trim()) return
  await stub.fetch(
    new Request(`${DO_URL}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'assistant', content }),
    }),
  )
}

async function persistRunnerErrorMessage(stub: { fetch: typeof fetch }, content: string): Promise<void> {
  if (!content.trim()) return
  await stub.fetch(
    new Request(`${DO_URL}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        role: 'system',
        content,
        parts: JSON.stringify([{ type: 'error', category: 'persistent', retryable: true }]),
      }),
    }),
  )
}

function sessionIdFromResult(raw: unknown): string {
  const obj = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  return String(obj.sessionId ?? obj.session_id ?? obj.id ?? '')
}

function configOptionsFromResult(raw: unknown): unknown[] | undefined {
  const obj = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  return Array.isArray(obj.configOptions) ? obj.configOptions : undefined
}

function optionValue(option: unknown): string | undefined {
  if (typeof option === 'string') return option
  if (!option || typeof option !== 'object') return undefined
  const obj = option as Record<string, unknown>
  const value = obj.value ?? obj.id ?? obj.name
  return typeof value === 'string' ? value : undefined
}

function hasAuthMethod(init: Record<string, unknown>, methodId: string): boolean {
  const methods = Array.isArray(init.authMethods) ? init.authMethods : []
  return methods.some((method) => {
    if (!method || typeof method !== 'object') return false
    return (method as Record<string, unknown>).id === methodId
  })
}

function findModelConfigOption(configOptions: unknown[] | undefined, upstreamModelId: string): string | undefined {
  for (const option of configOptions ?? []) {
    if (!option || typeof option !== 'object') continue
    const obj = option as Record<string, unknown>
    const id = typeof obj.id === 'string' ? obj.id : ''
    if (!/model/i.test(id)) continue
    const options = Array.isArray(obj.options) ? obj.options : []
    if (options.length === 0 || options.some((candidate) => optionValue(candidate) === upstreamModelId)) return id
  }
  return undefined
}

async function setAdvertisedModelConfig(
  rpc: ReturnType<typeof createAcpMultiplexer>,
  sessionId: string,
  configOptions: unknown[] | undefined,
  upstreamModelId: string | undefined,
): Promise<void> {
  if (!upstreamModelId) return
  const configId = findModelConfigOption(configOptions, upstreamModelId)
  if (!configId) return
  await rpc.request('session/set_config_option', { sessionId, configId, value: upstreamModelId })
}

/**
 * `initialize` / `authenticate` / `session/new` | `session/load` sequence for one bridge connection.
 */
async function runHandshake(
  rpc: ReturnType<typeof createAcpMultiplexer>,
  backend: AcpBackendKind,
  env: Env,
  cwd: string,
  persistedSessionId: string | undefined,
  persistSessionId: (id: string) => Promise<void>,
  setSuppressNotifications: (value: boolean) => void,
): Promise<{ sessionId: string; loadedExisting: boolean; configOptions?: unknown[] }> {
  const initRaw = await rpc.request('initialize', {
    protocolVersion: 1,
    clientCapabilities: {},
    clientInfo: { name: 'Ship', version: '2.0.0' },
  })
  const init = initRaw && typeof initRaw === 'object' ? (initRaw as Record<string, unknown>) : {}
  const capabilities =
    init.agentCapabilities && typeof init.agentCapabilities === 'object'
      ? (init.agentCapabilities as Record<string, unknown>)
      : {}
  const canLoadSession = capabilities.loadSession === true

  switch (backend) {
    case 'cursor':
      if (env.CURSOR_API_KEY) {
        await rpc.request('authenticate', {
          methodId: 'cursor_login',
          credentials: { apiKey: env.CURSOR_API_KEY },
        })
      } else if (env.CURSOR_AUTH_TOKEN) {
        await rpc.request('authenticate', {
          methodId: 'cursor_login',
          credentials: { token: env.CURSOR_AUTH_TOKEN },
        })
      }
      break
    case 'codex':
      if (env.OPENAI_API_KEY) {
        await rpc.request('authenticate', {
          methodId: 'openai-api-key',
          credentials: { apiKey: env.OPENAI_API_KEY },
        })
      }
      break
    case 'claude':
      if (env.ANTHROPIC_API_KEY) {
        await rpc.request('authenticate', {
          methodId: 'anthropic-api-key',
          credentials: { apiKey: env.ANTHROPIC_API_KEY },
        })
      }
      break
    case 'opencode':
      if (env.OPENCODE_API_KEY && hasAuthMethod(init, 'opencode-api-key')) {
        await rpc.request('authenticate', {
          methodId: 'opencode-api-key',
          credentials: { apiKey: env.OPENCODE_API_KEY },
        })
      }
      break
    default:
      break
  }

  let sid = persistedSessionId
  let loadedExisting = false
  let configOptions: unknown[] | undefined
  if (!sid) {
    const raw = await rpc.request('session/new', { cwd, mcpServers: [] })
    sid = sessionIdFromResult(raw)
    configOptions = configOptionsFromResult(raw)
    if (!sid) throw new Error('ACP session/new missing session id')
    await persistSessionId(sid)
  } else if (canLoadSession) {
    try {
      setSuppressNotifications(true)
      const raw = await rpc.request('session/load', { sessionId: sid, cwd, mcpServers: [] })
      configOptions = configOptionsFromResult(raw)
      loadedExisting = true
    } catch {
      const raw = await rpc.request('session/new', { cwd, mcpServers: [] })
      sid = sessionIdFromResult(raw)
      configOptions = configOptionsFromResult(raw)
      if (!sid) throw new Error('ACP session/new missing session id after load failure')
      await persistSessionId(sid)
    } finally {
      setSuppressNotifications(false)
    }
  } else {
    const raw = await rpc.request('session/new', { cwd, mcpServers: [] })
    sid = sessionIdFromResult(raw)
    configOptions = configOptionsFromResult(raw)
    if (!sid) throw new Error('ACP session/new missing session id without load support')
    await persistSessionId(sid)
  }

  return { sessionId: sid, loadedExisting, configOptions }
}

async function waitForStopRequest(
  input: RunChatTurnInput,
  isActive: () => boolean,
  onStop: () => void | Promise<void>,
): Promise<never> {
  while (isActive()) {
    if (input.abortSignal?.aborted) {
      await onStop()
      throw new AgentStoppedError()
    }
    const meta = await readMeta(input.stub).catch((): Record<string, string> => ({}))
    if (meta['agent_should_stop'] === 'true') {
      await onStop()
      throw new AgentStoppedError()
    }
    await delay(1000)
  }
  return new Promise<never>(() => {})
}

/**
 * Executes one user prompt against the configured ACP backend inside the sandbox VM.
 */
export async function runChatTurn(input: RunChatTurnInput): Promise<ChatTurnResult> {
  const translator = createAcpNotificationTranslator(input.sessionId)
  let assistantText = ''
  let suppressAcpNotifications = false
  let sawVisibleAssistantOutput = false
  const acpLogTail: string[] = []

  const emitTranslated = async (note: Record<string, unknown>) => {
    if (suppressAcpNotifications) return
    const events = translator.translateNotification(note)
    for (const event of events) {
      if (event.type === 'message.part.updated') {
        const props = event.properties as {
          delta?: string
          part?: { type?: string; text?: string }
        }
        if (props.part?.type === 'text') {
          if (typeof props.delta === 'string') {
            assistantText += props.delta
          } else if (typeof props.part.text === 'string') {
            assistantText = props.part.text
          }
          sawVisibleAssistantOutput = true
        } else if (props.part?.type && props.part.type !== 'reasoning' && props.part.type !== 'step-finish') {
          sawVisibleAssistantOutput = true
        }
      }
      await emitEvent(input, event)
    }
  }

  const meta = await readMeta(input.stub)
  const pickerId = input.modelId || meta['model'] || DEFAULT_ACP_MODEL_ID
  const modelSelection = parseAcpModelId(pickerId)
  const backend = resolveAcpBackend(pickerId)
  const workingDirectory = input.sandbox.workingDirectory
  const canReuseProtocolSession =
    meta['acp_protocol_session_id'] &&
    meta['acp_protocol_session_backend'] === backend &&
    meta['acp_protocol_session_cwd'] === workingDirectory &&
    meta['model'] === pickerId
  if (meta['acp_backend_kind'] !== backend || !canReuseProtocolSession) {
    await patchMeta(input.stub, {
      acp_backend_kind: backend,
      ...(canReuseProtocolSession ? {} : { acp_protocol_session_id: '' }),
    })
  }
  await patchMeta(input.stub, { agent_should_stop: 'false', agent_paused: 'false', model: pickerId })

  const bridge = await ensureAcpBridgeReady({
    sandbox: input.sandbox,
    stub: input.stub,
    env: input.env,
    workingDirectory: input.sandbox.workingDirectory,
    stream: input.stream,
  })

  const wsUrl = toBridgeWsUrl(bridge.httpsOrigin, bridge.token)
  const ws = await openBridgeWebSocket(wsUrl)

  const rpc = createAcpMultiplexer(ws, {
    onAgentNotification: (note) => emitTranslated(note),
    onLog: (stream, data) => {
      const trimmed = data.trim()
      if (trimmed) {
        acpLogTail.push(trimmed.slice(0, 1000))
        if (acpLogTail.length > 8) acpLogTail.shift()
      }
      console.warn(`[acp:${stream}]`, data.slice(0, 500))
    },
  })
  let stoppedByRequest = false

  if (input.abortSignal?.aborted) {
    rpc.close()
    throw new DOMException('Aborted', 'AbortError')
  }

  try {
    sendCtl(ws, 'spawn', backend, modelSelection.upstreamModelId)
    await delay(450)

    const handshake = await runHandshake(
      rpc,
      backend,
      input.env,
      workingDirectory,
      canReuseProtocolSession ? meta['acp_protocol_session_id'] : undefined,
      async (id) =>
        patchMeta(input.stub, {
          acp_protocol_session_id: id,
          acp_protocol_session_backend: backend,
          acp_protocol_session_cwd: workingDirectory,
        }),
      (value) => {
        suppressAcpNotifications = value
      },
    )
    const sid = handshake.sessionId
    await setAdvertisedModelConfig(rpc, sid, handshake.configOptions, modelSelection.upstreamModelId).catch((err) => {
      console.warn('[acp] failed to set advertised model config', err)
    })

    const transcript = input.messages.map((m) => `${m.role.toUpperCase()}: ${m.content}`).join('\n---\n')
    const latestUserPrompt = [...input.messages].reverse().find((message) => message.role === 'user')?.content
    const planPrefix = input.planMode ? '[plan mode — describe steps; avoid edits]\n\n' : ''
    const promptText = handshake.loadedExisting && latestUserPrompt ? latestUserPrompt : transcript

    let waitingForPrompt = true
    const stopPromise = waitForStopRequest(
      input,
      () => waitingForPrompt,
      async () => {
        stoppedByRequest = true
        rpc.notify('session/cancel', { sessionId: sid })
        await delay(1500)
        try {
          sendCtl(ws, 'reset')
        } finally {
          rpc.close()
        }
      },
    )
    try {
      await Promise.race([
        rpc.request(
          'session/prompt',
          {
            sessionId: sid,
            prompt: [{ type: 'text', text: `${planPrefix}${promptText}` }],
          },
          { timeoutMs: ACP_PROMPT_TIMEOUT_MS },
        ),
        stopPromise,
      ])
    } finally {
      waitingForPrompt = false
    }

    if (!assistantText.trim() && !sawVisibleAssistantOutput) {
      const tail = acpLogTail.at(-1)
      const detail = tail ? ` Last backend log: ${tail}` : ''
      throw new Error(`ACP backend completed without returning assistant output.${detail}`)
    }

    await persistAssistantMessage(input.stub, assistantText)
    await emitEvent(input, makeStepFinishEvent(input.sessionId, translator.messageId, emptyStepTotals(), 'stop'))
    await emitEvent(input, { type: 'session.idle', properties: { sessionID: input.sessionId } })
    await emitEvent(input, { type: 'done' })

    return { assistantText, totals: emptyStepTotals(), hadToolCalls: false }
  } catch (error) {
    if (error instanceof AgentStoppedError || stoppedByRequest) {
      await patchMeta(input.stub, { agent_should_stop: 'false', agent_paused: 'false' })
      await writeStatus(input.stream, 'stopped', 'Agent stopped.')
      await emitEvent(input, { type: 'session.idle', properties: { sessionID: input.sessionId } })
      await emitEvent(input, { type: 'done' })
      return { assistantText, totals: emptyStepTotals(), hadToolCalls: false }
    }
    const msg = error instanceof Error ? error.message : String(error)
    await emitEvent(input, {
      type: 'session.error',
      properties: {
        sessionID: input.sessionId,
        error: { name: 'AgentError', data: { message: msg } },
      },
    })
    await persistRunnerErrorMessage(input.stub, msg).catch((persistError) => {
      console.warn('[acp] failed to persist runner error message', persistError)
    })
    await emitEvent(input, { type: 'session.idle', properties: { sessionID: input.sessionId } })
    await emitEvent(input, { type: 'done' })
    return { assistantText: '', totals: emptyStepTotals(), hadToolCalls: false }
  } finally {
    rpc.close()
  }
}
