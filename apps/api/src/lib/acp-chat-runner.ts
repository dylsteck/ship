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
import { writeDone, writeSessionIdle, type SSEWriter } from './chat-stream-helpers'
import { ensureAcpBridgeReady, toBridgeWsUrl } from './acp-bridge-bootstrap'
import { createAcpMultiplexer, openBridgeWebSocket, sendCtl } from './acp-json-rpc'
import { DEFAULT_ACP_MODEL_ID, resolveAcpBackend, type AcpBackendKind } from './agent-registry'

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
  void broadcastToDurableObject(input.stub, event).catch(() => {})
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
): Promise<string> {
  await rpc.request('initialize', {
    protocolVersion: '2025-06-23',
    clientCapabilities: {},
    clientInfo: { name: 'Ship', version: '2.0.0' },
  })

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
      if (env.OPENCODE_API_KEY) {
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
  if (!sid) {
    const raw = await rpc.request('session/new', { cwd })
    const obj = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
    sid = String(obj.sessionId ?? obj.session_id ?? obj.id ?? '')
    if (!sid) throw new Error('ACP session/new missing session id')
    await persistSessionId(sid)
  } else {
    try {
      await rpc.request('session/load', { sessionId: sid })
    } catch {
      /* backends may omit session/load */
    }
  }

  return sid
}

/**
 * Executes one user prompt against the configured ACP backend inside the sandbox VM.
 */
export async function runChatTurn(input: RunChatTurnInput): Promise<ChatTurnResult> {
  const translator = createAcpNotificationTranslator(input.sessionId)
  let assistantText = ''

  const emitTranslated = async (note: Record<string, unknown>) => {
    const events = translator.translateNotification(note)
    for (const event of events) {
      if (event.type === 'message.part.updated') {
        const props = event.properties as {
          delta?: string
          part?: { type?: string; text?: string }
        }
        if (typeof props.delta === 'string') {
          assistantText += props.delta
        } else if (props.part?.type === 'text' && typeof props.part.text === 'string') {
          assistantText = props.part.text
        }
      }
      await emitEvent(input, event)
    }
  }

  const meta = await readMeta(input.stub)
  const pickerId = input.modelId || meta['model'] || DEFAULT_ACP_MODEL_ID
  const backend = resolveAcpBackend(pickerId)
  if (!meta['acp_backend_kind']) {
    await patchMeta(input.stub, { acp_backend_kind: backend })
  }

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
      console.warn(`[acp:${stream}]`, data.slice(0, 500))
    },
  })

  if (input.abortSignal?.aborted) {
    rpc.close()
    throw new DOMException('Aborted', 'AbortError')
  }

  try {
    sendCtl(ws, 'spawn', backend)
    await delay(450)

    const sid = await runHandshake(
      rpc,
      backend,
      input.env,
      input.sandbox.workingDirectory,
      meta['acp_protocol_session_id'],
      async (id) => patchMeta(input.stub, { acp_protocol_session_id: id }),
    )

    const transcript = input.messages
      .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
      .join('\n---\n')
    const planPrefix = input.planMode ? '[plan mode — describe steps; avoid edits]\n\n' : ''

    await rpc.request('session/prompt', {
      sessionId: sid,
      prompt: `${planPrefix}${transcript}`,
    })

    await emitEvent(
      input,
      makeStepFinishEvent(input.sessionId, translator.messageId, emptyStepTotals(), 'stop'),
    )

    await persistAssistantMessage(input.stub, assistantText)
    await writeSessionIdle(input.stream)
    await writeDone(input.stream)

    return { assistantText, totals: emptyStepTotals(), hadToolCalls: false }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    await emitEvent(input, {
      type: 'session.error',
      properties: {
        sessionID: input.sessionId,
        error: { name: 'AgentError', data: { message: msg } },
      },
    })
    await writeSessionIdle(input.stream)
    await writeDone(input.stream)
    return { assistantText: '', totals: emptyStepTotals(), hadToolCalls: false }
  } finally {
    rpc.close()
  }
}
