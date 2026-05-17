/**
 * Run a single chat turn end-to-end on the AI SDK + sandbox tools.
 *
 * The runner:
 *   1. Calls {@link runAgentStep} with the conversation history.
 *   2. Translates AI SDK chunks into Ship SSE events using
 *      {@link createAgentChunkTranslator}, writing them to the SSE stream
 *      and broadcasting them to DO websocket subscribers.
 *   3. After the turn finishes, persists the assistant message and emits
 *      `step-finish`, `session.idle`, and `done` events.
 *
 * Error handling is intentionally local: any thrown error becomes a Ship
 * `session.error` event; the caller decides whether to surface a separate
 * top-level error to the client.
 *
 * @packageDocumentation
 */

import { runAgentStep } from '@ship/agent'
import type { Sandbox } from '@ship/sandbox'
import type { ModelMessage } from 'ai'
import type { Env } from '../env.d'
import {
  createAgentChunkTranslator,
  makeStepFinishEvent,
  totalsFromUsage,
  type ShipSSEEvent,
} from './agent-chunks'
import { writeDone, writeSessionIdle, type SSEWriter } from './chat-stream-helpers'

/**
 * Inputs for {@link runChatTurn}.
 */
export interface RunChatTurnInput {
  /** Ship session id (for SSE part ids and DO routing). */
  sessionId: string
  /** Live sandbox handle for this turn. */
  sandbox: Sandbox
  /** Conversation history including the new user message. */
  messages: ModelMessage[]
  /** Model id (e.g. `anthropic/claude-3-7-sonnet-20250219`). */
  modelId?: string
  /** Plan-mode disables write/edit tools. */
  planMode?: boolean
  /** Worker env for API keys. */
  env: Env
  /** SSE response stream to the client. */
  stream: SSEWriter
  /** Durable Object stub for persistence + broadcast. */
  stub: { fetch: typeof fetch }
  /** Caller-controlled abort signal. */
  abortSignal?: AbortSignal
}

/**
 * Result of a chat turn — useful for the caller to drive auto-commit, etc.
 */
export interface ChatTurnResult {
  /** Final accumulated assistant text. */
  assistantText: string
  /** Total input/output token usage (across all loop steps). */
  totals: ReturnType<typeof totalsFromUsage>
  /** True if the loop emitted any tool call (reads/writes/bash/etc). */
  hadToolCalls: boolean
}

const DO_URL = 'https://do'

/**
 * Run one full chat turn.
 *
 * @returns Aggregate stats from the turn. Throws if the SSE stream itself
 *   fails to write; tool errors and model errors are surfaced via the
 *   stream as `session.error` events.
 */
export async function runChatTurn(input: RunChatTurnInput): Promise<ChatTurnResult> {
  const translator = createAgentChunkTranslator(input.sessionId)
  const result = runAgentStep({
    sandbox: input.sandbox,
    env: { ANTHROPIC_API_KEY: input.env.ANTHROPIC_API_KEY, OPENAI_API_KEY: input.env.OPENAI_API_KEY },
    messages: input.messages,
    ...(input.modelId ? { modelId: input.modelId } : {}),
    ...(input.planMode === true ? { planMode: true } : {}),
    ...(input.abortSignal ? { abortSignal: input.abortSignal } : {}),
  })

  let assistantText = ''
  let hadToolCalls = false

  for await (const chunk of result.toUIMessageStream()) {
    if (chunk.type === 'text-delta') assistantText += chunk.delta
    if (chunk.type === 'tool-input-start') hadToolCalls = true
    const events = translator.translate(chunk)
    for (const event of events) {
      await emitEvent(input, event)
    }
  }

  const usage = await safeResolve(result.totalUsage)
  const totals = totalsFromUsage(usage)
  await emitEvent(input, makeStepFinishEvent(input.sessionId, translator.messageId, totals))

  await persistAssistantMessage(input.stub, assistantText)
  await writeSessionIdle(input.stream)
  await writeDone(input.stream)

  return { assistantText, totals, hadToolCalls }
}

/** Stream an event to the client and broadcast it to DO subscribers. */
async function emitEvent(input: RunChatTurnInput, event: ShipSSEEvent): Promise<void> {
  await input.stream.writeSSE({ event: event.type, data: JSON.stringify(event) })
  // Best-effort broadcast — never let it break the user-facing stream.
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

/** Resolve a `PromiseLike` and swallow rejection. */
async function safeResolve<T>(promise: PromiseLike<T>): Promise<T | undefined> {
  try {
    return await promise
  } catch {
    return undefined
  }
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
