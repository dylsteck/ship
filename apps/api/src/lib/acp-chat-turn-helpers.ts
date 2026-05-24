/**
 * DO meta read/write and SSE fan-out helpers for ACP chat turns.
 *
 * @packageDocumentation
 */

import type { ShipSSEEvent } from './agent-chunks'

export const DO_URL = 'https://do'

/** Input shape shared by chat turn orchestration modules. */
export interface ChatTurnContext {
  sessionId: string
  stub: { fetch: typeof fetch }
  stream: { writeSSE: (payload: { event: string; data: string }) => Promise<void> }
  abortSignal?: AbortSignal
}

export class AgentStoppedError extends Error {
  constructor() {
    super('Agent run stopped by user')
    this.name = 'AgentStoppedError'
  }
}

/** Delay helper for bridge spawn and stop grace periods. */
export function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

/** Patch SessionDO meta key-value pairs. */
export async function patchMeta(stub: { fetch: typeof fetch }, patch: Record<string, string>): Promise<void> {
  await stub.fetch(
    new Request(`${DO_URL}/meta`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    }),
  )
}

/** Read all SessionDO meta key-value pairs. */
export async function readMeta(stub: { fetch: typeof fetch }): Promise<Record<string, string>> {
  const res = await stub.fetch(new Request(`${DO_URL}/meta`))
  return (await res.json()) as Record<string, string>
}

/** Write one SSE event to the stream and fan out to the DO. */
export async function emitEvent(input: ChatTurnContext, event: ShipSSEEvent): Promise<void> {
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

/** Persist assistant text to SessionDO message history. */
export async function persistAssistantMessage(stub: { fetch: typeof fetch }, content: string): Promise<void> {
  if (!content.trim()) return
  await stub.fetch(
    new Request(`${DO_URL}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'assistant', content }),
    }),
  )
}

/** Persist a classified runner error as a system message. */
export async function persistRunnerErrorMessage(stub: { fetch: typeof fetch }, content: string): Promise<void> {
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

/** Poll SessionDO meta until the user requests a stop or the turn ends. */
export async function waitForStopRequest(
  input: ChatTurnContext,
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
