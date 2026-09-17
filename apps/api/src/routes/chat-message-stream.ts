/**
 * Legacy `POST /chat/:sessionId` SSE relay over canonical turn execution.
 *
 * @packageDocumentation
 */

import { streamSSE } from 'hono/streaming'
import {
  CreateTurnRequestSchema,
  SessionStreamFrameSchema,
  type SessionEventRecord,
  type SessionStreamFrame,
  type TurnId,
} from '@ship/contracts'
import type { Context } from 'hono'

import { chatPostBodySchema, parseJsonBody } from '../lib/api-schemas'
import { isKnownAcpModel } from '../lib/agent-registry'
import { publishShellSession } from '../lib/shell-summary'
import { requireSessionOwner, type AuthedEnv } from '../lib/session-authorization'

/** Accept a canonical turn, then relay only that turn's persisted records as legacy SSE. */
export async function handleChatMessageStream(c: Context<AuthedEnv>) {
  const sessionId = c.req.param('sessionId')
  if (!sessionId) return c.json({ error: 'Missing session id' }, 400)
  const owner = await requireSessionOwner(c, sessionId)
  if (!owner.ok) return owner.response
  const body = await parseJsonBody(c, chatPostBodySchema)
  if (body instanceof Response) return body
  if (body.model && !(await isKnownAcpModel(body.model))) return c.json({ error: 'Invalid model ID' }, 400)
  const requestedId = c.req.header('Idempotency-Key')
  const command = CreateTurnRequestSchema.parse({
    content: body.content,
    mode: body.mode || 'agent',
    ...(body.model ? { modelId: body.model } : {}),
    clientCommandId: requestedId && isUuid(requestedId) ? requestedId : crypto.randomUUID(),
  })
  const stub = c.env.SESSION_DO.getByName(sessionId)
  await stub.setSessionMeta('session_id', sessionId)
  await stub.setSessionMeta('userId', owner.userId)
  const accepted = await stub.beginAcceptedTurn(sessionId, command)
  if (!accepted.ok) return c.json({ error: 'session_busy', activeTurnId: accepted.activeTurnId }, 409)

  if (accepted.response.status === 'accepted') {
    try {
      await c.env.SHIP_CHAT_TURN_WORKFLOW.create({
        id: accepted.response.turnId,
        params: { sessionId, turnId: accepted.response.turnId, userId: owner.userId },
      })
    } catch (error) {
      if (!(await workflowExists(c.env, accepted.response.turnId))) {
        await stub.finalizeAcceptedTurn(sessionId, accepted.response.turnId, 'failed', 'Workflow creation failed')
        return c.json({ error: error instanceof Error ? error.message : 'Workflow creation failed' }, 503)
      }
    }
  }
  await publishShellSession(c.env, sessionId, {
    state: 'starting',
    latestTurnId: accepted.response.turnId as TurnId,
  })

  return streamSSE(c, async (stream) => {
    const response = await stub.fetch(new Request('https://do/stream', { headers: { Upgrade: 'websocket' } }))
    const socket = response.webSocket
    if (response.status !== 101 || !socket) {
      await stream.writeSSE({ event: 'error', data: JSON.stringify({ error: 'Realtime relay unavailable' }) })
      return
    }
    socket.accept()
    let writeChain = Promise.resolve()
    await new Promise<void>((resolve) => {
      let settled = false
      const finish = () => {
        if (settled) return
        settled = true
        resolve()
      }
      socket.addEventListener('message', (message) => {
        if (typeof message.data !== 'string') return
        writeChain = writeChain.then(async () => {
          const parsed = SessionStreamFrameSchema.safeParse(JSON.parse(message.data))
          if (!parsed.success) return
          if (await relayFrame(stream, parsed.data, accepted.response.turnId)) {
            socket.close(1000, 'Turn terminal')
            finish()
          }
        }).catch(finish)
      })
      socket.addEventListener('close', finish)
      socket.addEventListener('error', finish)
      socket.send(JSON.stringify({
        type: 'session.subscribe',
        afterSequence: accepted.response.acceptedSequence,
        requestCompletionMarker: true,
        turnLimit: 10,
      }))
      stream.onAbort(() => {
        socket.close(1000, 'SSE relay disconnected')
        finish()
      })
    })
    await writeChain
  })
}

async function relayFrame(
  stream: { writeSSE(payload: { event: string; data: string }): Promise<void> },
  frame: SessionStreamFrame,
  turnId: string,
): Promise<boolean> {
  if (frame.type === 'session.events') {
    for (const record of frame.records) {
      if (record.turnId && record.turnId !== turnId) continue
      await relayRecord(stream, record)
      if (isTerminalRecord(record, turnId)) {
        await emitLegacyTerminal(stream)
        return true
      }
    }
  }
  if (frame.type === 'session.snapshot') {
    const turn = frame.snapshot.turns[turnId]
    if (turn && turn.status !== 'running') {
      const assistant = Object.values(frame.snapshot.messages).find(
        (message) => message.turnId === turnId && message.role === 'assistant',
      )
      if (assistant?.content) {
        const event = {
          type: 'message.part.updated',
          properties: {
            part: {
              id: `relay-${assistant.id}`,
              sessionID: frame.snapshot.sessionId,
              messageID: assistant.id,
              type: 'text',
              text: assistant.content,
            },
          },
          sequence: frame.snapshot.snapshotSequence,
          turnId,
          occurredAt: Date.now(),
        }
        await stream.writeSSE({ event: event.type, data: JSON.stringify(event) })
      }
      await emitLegacyTerminal(stream)
      return true
    }
  }
  return false
}

async function relayRecord(
  stream: { writeSSE(payload: { event: string; data: string }): Promise<void> },
  record: SessionEventRecord,
): Promise<void> {
  if (record.event.type.startsWith('turn.') || record.event.type === 'session.runtime.updated') return
  const payload = { ...record.event, sequence: record.sequence, turnId: record.turnId, occurredAt: record.occurredAt }
  await stream.writeSSE({ event: record.event.type, data: JSON.stringify(payload) })
}

async function emitLegacyTerminal(
  stream: { writeSSE(payload: { event: string; data: string }): Promise<void> },
): Promise<void> {
  await stream.writeSSE({ event: 'session.idle', data: JSON.stringify({ type: 'session.idle' }) })
  await stream.writeSSE({ event: 'done', data: JSON.stringify({ type: 'done' }) })
}

function isTerminalRecord(record: SessionEventRecord, turnId: string): boolean {
  return record.turnId === turnId && ['turn.completed', 'turn.failed', 'turn.interrupted'].includes(record.event.type)
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

async function workflowExists(env: AuthedEnv['Bindings'], turnId: string): Promise<boolean> {
  try {
    const instance = await env.SHIP_CHAT_TURN_WORKFLOW.get(turnId)
    return (await instance.status()).status !== 'unknown'
  } catch {
    return false
  }
}
