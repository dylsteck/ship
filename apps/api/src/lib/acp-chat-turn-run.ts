/**
 * Prompt execution and turn completion phases for ACP chat runs.
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
import { runAcpHandshake, setAdvertisedModelConfig, type AcpHandshakeResult } from './acp-handshake'
import {
  AgentStoppedError,
  delay,
  emitEvent,
  patchMeta,
  persistAssistantMessage,
  persistRunnerErrorMessage,
  readMeta,
  waitForStopRequest,
  type ChatTurnContext,
} from './acp-chat-turn-helpers'

export interface RunChatTurnInput extends ChatTurnContext {
  sandbox: Sandbox
  messages: ChatTurnMessage[]
  /** Registry id (`ship-acp-*`) stored on SessionDO meta `model` */
  modelId?: string
  planMode?: boolean
  env: Env
  stream: SSEWriter
}

export interface ChatTurnResult {
  assistantText: string
  totals: StepFinishTotals
  /** Reserved — ACP tool spans may populate later. */
  hadToolCalls: boolean
}

const ACP_PROMPT_TIMEOUT_MS = 480_000

interface TurnRuntime {
  translator: ReturnType<typeof createAcpNotificationTranslator>
  assistantText: string
  suppressAcpNotifications: boolean
  sawVisibleAssistantOutput: boolean
  acpLogTail: string[]
  stoppedByRequest: boolean
}

function createTurnRuntime(sessionId: string): TurnRuntime {
  return {
    translator: createAcpNotificationTranslator(sessionId),
    assistantText: '',
    suppressAcpNotifications: false,
    sawVisibleAssistantOutput: false,
    acpLogTail: [],
    stoppedByRequest: false,
  }
}

function createEmitTranslated(input: RunChatTurnInput, runtime: TurnRuntime) {
  return async (note: Record<string, unknown>) => {
    if (runtime.suppressAcpNotifications) return
    const events = runtime.translator.translateNotification(note)
    for (const event of events) {
      if (event.type === 'message.part.updated') {
        const props = event.properties as {
          delta?: string
          part?: { type?: string; text?: string }
        }
        if (props.part?.type === 'text') {
          if (typeof props.delta === 'string') {
            runtime.assistantText += props.delta
          } else if (typeof props.part.text === 'string') {
            runtime.assistantText = props.part.text
          }
          runtime.sawVisibleAssistantOutput = true
        } else if (props.part?.type && props.part.type !== 'reasoning' && props.part.type !== 'step-finish') {
          runtime.sawVisibleAssistantOutput = true
        }
      }
      await emitEvent(input, event)
    }
  }
}

async function prepareTurnMeta(input: RunChatTurnInput): Promise<{
  pickerId: string
  backend: AcpBackendKind
  workingDirectory: string
  canReuseProtocolSession: boolean
  meta: Record<string, string>
}> {
  const meta = await readMeta(input.stub)
  const pickerId = input.modelId || meta['model'] || DEFAULT_ACP_MODEL_ID
  const backend = resolveAcpBackend(pickerId)
  const workingDirectory = input.sandbox.workingDirectory
  const canReuseProtocolSession = !!(
    meta['acp_protocol_session_id'] &&
    meta['acp_protocol_session_backend'] === backend &&
    meta['acp_protocol_session_cwd'] === workingDirectory &&
    meta['model'] === pickerId
  )

  if (meta['acp_backend_kind'] !== backend || !canReuseProtocolSession) {
    await patchMeta(input.stub, {
      acp_backend_kind: backend,
      ...(canReuseProtocolSession ? {} : { acp_protocol_session_id: '' }),
    })
  }
  await patchMeta(input.stub, { agent_should_stop: 'false', agent_paused: 'false', model: pickerId })

  return { pickerId, backend, workingDirectory, canReuseProtocolSession, meta }
}

async function runPromptPhase(
  input: RunChatTurnInput,
  runtime: TurnRuntime,
  backend: AcpBackendKind,
  workingDirectory: string,
  meta: Record<string, string>,
  canReuseProtocolSession: boolean,
  modelSelection: ReturnType<typeof parseAcpModelId>,
): Promise<void> {
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
    onAgentNotification: (note) => createEmitTranslated(input, runtime)(note),
    onLog: (stream, data) => {
      const trimmed = data.trim()
      if (trimmed) {
        runtime.acpLogTail.push(trimmed.slice(0, 1000))
        if (runtime.acpLogTail.length > 8) runtime.acpLogTail.shift()
      }
      console.warn(`[acp:${stream}]`, data.slice(0, 500))
    },
  })

  if (input.abortSignal?.aborted) {
    rpc.close()
    throw new DOMException('Aborted', 'AbortError')
  }

  try {
    sendCtl(ws, 'spawn', backend, modelSelection.upstreamModelId)
    await delay(450)

    const handshake = await runAcpHandshake(
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
        runtime.suppressAcpNotifications = value
      },
    )

    await setAdvertisedModelConfig(rpc, handshake.sessionId, handshake.configOptions, modelSelection.upstreamModelId).catch(
      (err) => {
        console.warn('[acp] failed to set advertised model config', err)
      },
    )

    await sendPrompt(rpc, ws, input, runtime, handshake)
  } finally {
    rpc.close()
  }
}

async function sendPrompt(
  rpc: ReturnType<typeof createAcpMultiplexer>,
  ws: WebSocket,
  input: RunChatTurnInput,
  runtime: TurnRuntime,
  handshake: AcpHandshakeResult,
): Promise<void> {
  const transcript = input.messages.map((m) => `${m.role.toUpperCase()}: ${m.content}`).join('\n---\n')
  const latestUserPrompt = [...input.messages].reverse().find((m) => m.role === 'user')?.content
  const planPrefix = input.planMode ? '[plan mode — describe steps; avoid edits]\n\n' : ''
  const promptText = handshake.loadedExisting && latestUserPrompt ? latestUserPrompt : transcript

  let waitingForPrompt = true
  const stopPromise = waitForStopRequest(
    input,
    () => waitingForPrompt,
    async () => {
      runtime.stoppedByRequest = true
      rpc.notify('session/cancel', { sessionId: handshake.sessionId })
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
        { sessionId: handshake.sessionId, prompt: [{ type: 'text', text: `${planPrefix}${promptText}` }] },
        { timeoutMs: ACP_PROMPT_TIMEOUT_MS },
      ),
      stopPromise,
    ])
  } finally {
    waitingForPrompt = false
  }

  if (!runtime.assistantText.trim() && !runtime.sawVisibleAssistantOutput) {
    const tail = runtime.acpLogTail.at(-1)
    const detail = tail ? ` Last backend log: ${tail}` : ''
    throw new Error(`ACP backend completed without returning assistant output.${detail}`)
  }
}

async function finalizeSuccessfulTurn(input: RunChatTurnInput, runtime: TurnRuntime): Promise<ChatTurnResult> {
  await persistAssistantMessage(input.stub, runtime.assistantText)
  await emitEvent(input, makeStepFinishEvent(input.sessionId, runtime.translator.messageId, emptyStepTotals(), 'stop'))
  await emitEvent(input, { type: 'session.idle', properties: { sessionID: input.sessionId } })
  await emitEvent(input, { type: 'done' })
  return { assistantText: runtime.assistantText, totals: emptyStepTotals(), hadToolCalls: false }
}

async function handleStoppedTurn(input: RunChatTurnInput, runtime: TurnRuntime): Promise<ChatTurnResult> {
  await patchMeta(input.stub, { agent_should_stop: 'false', agent_paused: 'false' })
  await writeStatus(input.stream, 'stopped', 'Agent stopped.')
  await emitEvent(input, { type: 'session.idle', properties: { sessionID: input.sessionId } })
  await emitEvent(input, { type: 'done' })
  return { assistantText: runtime.assistantText, totals: emptyStepTotals(), hadToolCalls: false }
}

async function handleFailedTurn(input: RunChatTurnInput, error: unknown): Promise<ChatTurnResult> {
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
}

/**
 * Executes one user prompt against the configured ACP backend inside the sandbox VM.
 * Retries once on bridge WebSocket disconnects that happen before any visible output.
 */
export async function runChatTurn(input: RunChatTurnInput): Promise<ChatTurnResult> {
  let lastError: unknown

  for (let attempt = 0; attempt <= 1; attempt++) {
    const runtime = createTurnRuntime(input.sessionId)

    try {
      const { backend, workingDirectory, canReuseProtocolSession, meta } = await prepareTurnMeta(input)
      const modelSelection = parseAcpModelId(input.modelId || meta['model'] || DEFAULT_ACP_MODEL_ID)

      await runPromptPhase(input, runtime, backend, workingDirectory, meta, canReuseProtocolSession, modelSelection)
      return finalizeSuccessfulTurn(input, runtime)
    } catch (error) {
      if (error instanceof AgentStoppedError || runtime.stoppedByRequest) {
        return handleStoppedTurn(input, runtime)
      }

      const isBridgeDisconnect =
        error instanceof Error &&
        (error.message.startsWith('ACP bridge WebSocket') || error.message.startsWith('ACP bridge closed'))

      if (isBridgeDisconnect && attempt === 0 && !runtime.sawVisibleAssistantOutput) {
        await writeStatus(input.stream, 'reconnecting', 'Reconnecting to agent…')
        await delay(2_000)
        await patchMeta(input.stub, { acp_protocol_session_id: '' })
        continue
      }

      lastError = error
    }
  }

  return handleFailedTurn(input, lastError ?? new Error('Unexpected retry loop exit'))
}

/** Re-export for stable import path via chat-runner facade. */
export type { ShipSSEEvent }
