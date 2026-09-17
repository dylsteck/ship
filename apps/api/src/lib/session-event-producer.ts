/**
 * Batched Workflow-to-SessionDO event producer over one internal websocket.
 *
 * @packageDocumentation
 */

import {
  SessionProducerAckSchema,
  SessionRealtimeEventSchema,
  type SessionProducerEvent,
  type SessionRealtimeEvent,
} from '@ship/contracts'

import type { SSEWriter } from './chat-stream-helpers'

interface SessionProducerStub {
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>
}

interface PendingAck {
  resolve: () => void
  reject: (error: Error) => void
}

const BATCH_DELAY_MS = 25
const MAX_BATCH_SIZE = 32

/** Batches logical agent events and retries ambiguous acknowledgements idempotently. */
export class SessionEventProducer {
  private socket: WebSocket | null = null
  private readonly queue: SessionProducerEvent[] = []
  private readonly acknowledgements = new Map<string, PendingAck>()
  private timer: ReturnType<typeof setTimeout> | null = null
  private flushChain: Promise<void> = Promise.resolve()
  private counter = 0

  constructor(
    private readonly stub: SessionProducerStub,
    private readonly secret: string,
    private readonly turnId: string,
    private readonly attemptId: string,
  ) {}

  /** Open the internal producer socket and attach acknowledgement handlers. */
  async connect(): Promise<void> {
    this.socket?.close(1000, 'Reconnecting')
    const response = await this.stub.fetch(
      new Request(
        `https://do/internal/producer?turnId=${encodeURIComponent(this.turnId)}&attemptId=${encodeURIComponent(this.attemptId)}`,
        { headers: { Upgrade: 'websocket', 'X-Ship-Producer-Secret': this.secret } },
      ),
    )
    const socket = response.webSocket
    if (response.status !== 101 || !socket) throw new Error('Session event producer upgrade failed')
    socket.accept()
    socket.addEventListener('message', (event) => this.handleMessage(event))
    socket.addEventListener('close', () => this.rejectPending('Session event producer closed'))
    socket.addEventListener('error', () => this.rejectPending('Session event producer failed'))
    this.socket = socket
  }

  /** Queue one canonical event with a deterministic attempt-local event id. */
  async emit(event: SessionRealtimeEvent): Promise<void> {
    const record: SessionProducerEvent = {
      eventId: `${this.turnId}:${this.attemptId}:${this.counter++}`,
      turnId: this.turnId as SessionProducerEvent['turnId'],
      occurredAt: Date.now(),
      event,
    }
    this.queue.push(record)
    if (this.queue.length >= MAX_BATCH_SIZE || isBoundary(event)) {
      await this.flush()
      return
    }
    if (!this.timer) this.timer = setTimeout(() => void this.flush(), BATCH_DELAY_MS)
  }

  /** Flush every queued event and wait for the SessionDO acknowledgement. */
  async flush(): Promise<void> {
    if (this.timer) clearTimeout(this.timer)
    this.timer = null
    if (this.queue.length === 0) return this.flushChain
    const records = this.queue.splice(0, MAX_BATCH_SIZE)
    const batchId = `${this.turnId}:${this.attemptId}:batch:${records[0]?.eventId.split(':').at(-1)}`
    this.flushChain = this.flushChain.then(() => this.sendWithReconnect(batchId, records))
    await this.flushChain
    if (this.queue.length > 0) await this.flush()
  }

  /** Flush and close the producer socket. */
  async close(): Promise<void> {
    await this.flush()
    this.socket?.close(1000, 'Turn complete')
    this.socket = null
  }

  /** SSE-compatible writer used by the existing ACP runner. */
  writer(sessionId: string): SSEWriter {
    return {
      writeSSE: async ({ event, data }) => {
        const canonical = normalizeSseEvent(sessionId, event, data)
        if (canonical) await this.emit(canonical)
      },
    }
  }

  private async sendWithReconnect(batchId: string, records: SessionProducerEvent[]): Promise<void> {
    try {
      await this.sendBatch(batchId, records)
    } catch {
      await this.connect()
      await this.sendBatch(batchId, records)
    }
  }

  private async sendBatch(batchId: string, records: SessionProducerEvent[]): Promise<void> {
    if (!this.socket) await this.connect()
    const acknowledgement = new Promise<void>((resolve, reject) => {
      this.acknowledgements.set(batchId, { resolve, reject })
      setTimeout(() => {
        if (!this.acknowledgements.delete(batchId)) return
        reject(new Error('Session event producer acknowledgement timed out'))
      }, 15_000)
    })
    this.socket?.send(JSON.stringify({ type: 'producer.batch', batchId, records }))
    await acknowledgement
  }

  private handleMessage(event: MessageEvent): void {
    if (typeof event.data !== 'string') return
    try {
      const ack = SessionProducerAckSchema.parse(JSON.parse(event.data))
      const pending = this.acknowledgements.get(ack.batchId)
      if (!pending) return
      this.acknowledgements.delete(ack.batchId)
      pending.resolve()
    } catch {
      // Ignore unrelated or malformed producer frames; timeout drives retry.
    }
  }

  private rejectPending(message: string): void {
    for (const pending of this.acknowledgements.values()) pending.reject(new Error(message))
    this.acknowledgements.clear()
  }
}

function normalizeSseEvent(sessionId: string, eventName: string, data: string): SessionRealtimeEvent | null {
  let value: unknown
  try {
    value = JSON.parse(data)
  } catch {
    return null
  }
  if (eventName === 'done' || eventName === 'session.idle') return null
  if (eventName === 'error') {
    const error = value as { error?: unknown; retryable?: unknown }
    return {
      type: 'session.error',
      properties: {
        sessionID: sessionId,
        error: { name: 'AgentError', data: { message: String(error.error || 'Agent execution failed') } },
        ...(typeof error.retryable === 'boolean' ? { retryable: error.retryable } : {}),
      },
    }
  }
  const candidate = typeof value === 'object' && value && !('type' in value)
    ? { ...(value as Record<string, unknown>), type: eventName }
    : value
  const parsed = SessionRealtimeEventSchema.safeParse(candidate)
  return parsed.success ? parsed.data : null
}

function isBoundary(event: SessionRealtimeEvent): boolean {
  if (event.type === 'session.error') return true
  if (event.type !== 'message.part.updated') return event.type !== 'status'
  return event.properties.part.type === 'tool' || event.properties.part.type === 'step-finish'
}
