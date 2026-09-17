/** Sequence-aware active-session controller with cached normalized state. */

import {
  TranscriptPageSchema,
  type CreateTurnRequest,
  type SessionStreamFrame,
  type TranscriptPage,
  type TurnAcceptedResponse,
} from '@ship/contracts'
import {
  createSessionTurn,
  getSessionsBySessionIdTranscript,
  stopSessionTurn,
  subscribeToSession,
  unwrapSdkData,
} from '@ship/sdk'
import {
  createEmptySessionState,
  mergeTranscriptPage,
  reduceSessionFrame,
  type SessionControllerState,
} from './session-state'

const RECONNECT_DELAYS = [500, 1_000, 2_000, 4_000, 8_000, 15_000] as const

/** Controller for exactly one Ship session. */
export class SessionController {
  private state: SessionControllerState
  private readonly listeners = new Set<() => void>()
  private socket: WebSocket | null = null
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null
  private flushTimer: ReturnType<typeof setTimeout> | null = null
  private readonly pendingFrames: SessionStreamFrame[] = []
  private reconnectAttempt = 0
  private generation = 0
  private lastSeenAt = Date.now()
  private active = false
  private pendingCursor: string | null = null

  constructor(readonly sessionId: string) {
    this.state = createEmptySessionState(sessionId)
  }

  /** Return the current immutable controller state. */
  getSnapshot = (): SessionControllerState => this.state

  /** Subscribe to controller commits. */
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  /** Attach the controller to the visible session and resume from its cursor. */
  start(): void {
    if (this.active) return
    this.active = true
    window.addEventListener('online', this.handleOnline)
    document.addEventListener('visibilitychange', this.handleVisibility)
    this.connect()
  }

  /** Detach its socket while preserving the normalized cache. */
  suspend(): void {
    if (!this.active) return
    this.active = false
    this.generation += 1
    window.removeEventListener('online', this.handleOnline)
    document.removeEventListener('visibilitychange', this.handleVisibility)
    this.clearTimers()
    this.flushFrames()
    this.socket?.close(1000, 'session hidden')
    this.socket = null
  }

  /** Permanently release browser resources before registry eviction. */
  dispose(): void {
    this.suspend()
    this.listeners.clear()
  }

  /** Submit a canonical idempotent command independent of this socket. */
  createTurn(command: CreateTurnRequest): Promise<TurnAcceptedResponse> {
    return createSessionTurn(this.sessionId, command)
  }

  /** Stop the newest running turn, if one is known. */
  async stopActiveTurn(): Promise<void> {
    const turnId = [...this.state.orderedTurnIds]
      .reverse()
      .find((id) => this.state.turnsById.get(id)?.status === 'running')
    if (!turnId) return
    await stopSessionTurn(this.sessionId, turnId)
  }

  /** Fetch and prepend one stable page of older turns. */
  async loadEarlier(limit = 20): Promise<void> {
    const cursor = this.state.beforeCursor
    if (!this.state.hasMore || !cursor || this.pendingCursor === cursor) return
    const requestEpoch = this.state.snapshotEpoch
    this.pendingCursor = cursor
    this.patch({ historyLoading: true, historyError: undefined })
    try {
      const raw = unwrapSdkData(
        await getSessionsBySessionIdTranscript({
          path: { sessionId: this.sessionId },
          query: { before: cursor, limit },
        }),
      )
      const page = TranscriptPageSchema.parse(raw) as TranscriptPage
      this.state = mergeTranscriptPage(this.state, page, requestEpoch)
      this.emit()
    } catch (error) {
      if (this.state.snapshotEpoch === requestEpoch) {
        this.patch({ historyLoading: false, historyError: error instanceof Error ? error.message : String(error) })
      }
    } finally {
      if (this.pendingCursor === cursor) this.pendingCursor = null
    }
  }

  private connect(): void {
    if (!this.active || !navigator.onLine) {
      this.patch({ phase: 'offline' })
      return
    }
    const generation = ++this.generation
    this.patch({ phase: 'synchronizing', error: undefined })
    void subscribeToSession({
      sessionId: this.sessionId,
      afterSequence: this.state.hasSnapshot ? this.state.lastSequence : undefined,
      turnLimit: 10,
      onFrame: (frame) => this.queueFrame(frame),
      onProtocolError: (error) => this.patch({ phase: 'error', error: error.message }),
    })
      .then((socket) => {
        if (!this.active || generation !== this.generation) {
          socket.close(1000, 'superseded')
          return
        }
        this.socket = socket
        this.lastSeenAt = Date.now()
        socket.addEventListener('open', () => this.beginHeartbeat())
        socket.addEventListener('close', (event) => {
          if (this.socket === socket) this.socket = null
          this.flushFrames()
          if (!this.active || event.code === 1000) return
          this.patch({ phase: navigator.onLine ? 'synchronizing' : 'offline' })
          this.scheduleReconnect()
        })
        socket.addEventListener('error', () => socket.close())
      })
      .catch((error: unknown) => {
        if (!this.active || generation !== this.generation) return
        this.patch({ phase: navigator.onLine ? 'error' : 'offline', error: String(error) })
        this.scheduleReconnect()
      })
  }

  private queueFrame(frame: SessionStreamFrame): void {
    this.lastSeenAt = Date.now()
    if (frame.type === 'pong') return
    this.pendingFrames.push(frame)
    if (!this.flushTimer) this.flushTimer = setTimeout(() => this.flushFrames(), 33)
  }

  private flushFrames(): void {
    if (this.flushTimer) clearTimeout(this.flushTimer)
    this.flushTimer = null
    if (this.pendingFrames.length === 0) return
    const frames = this.pendingFrames.splice(0)
    const next = frames.reduce(reduceSessionFrame, this.state)
    if (next !== this.state) {
      this.state = next
      this.emit()
    }
  }

  private beginHeartbeat(): void {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer)
    this.heartbeatTimer = setInterval(() => {
      const socket = this.socket
      if (!socket || socket.readyState !== WebSocket.OPEN) return
      if (Date.now() - this.lastSeenAt > 60_000) {
        socket.close(4000, 'stale')
        return
      }
      socket.send(JSON.stringify({ type: 'ping', occurredAt: Date.now() }))
    }, 25_000)
  }

  private scheduleReconnect(): void {
    if (!this.active || this.reconnectTimer) return
    const base = RECONNECT_DELAYS[Math.min(this.reconnectAttempt, RECONNECT_DELAYS.length - 1)]
    this.reconnectAttempt += 1
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      this.connect()
    }, Math.round(base * (0.8 + Math.random() * 0.4)))
  }

  private reconnectNow(): void {
    if (!this.active || !navigator.onLine) return
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
    this.reconnectTimer = null
    this.socket?.close(4001, 'refresh')
    this.socket = null
    this.connect()
  }

  private handleOnline = (): void => this.reconnectNow()
  private handleVisibility = (): void => {
    if (document.visibilityState === 'visible' && Date.now() - this.lastSeenAt > 60_000) this.reconnectNow()
  }

  private patch(patch: Partial<SessionControllerState>): void {
    this.state = { ...this.state, ...patch }
    this.emit()
  }

  private emit(): void {
    for (const listener of this.listeners) listener()
  }

  private clearTimers(): void {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer)
    if (this.flushTimer) clearTimeout(this.flushTimer)
    this.reconnectTimer = null
    this.heartbeatTimer = null
    this.flushTimer = null
  }
}
