/** User-shell external store and resilient WebSocket lifecycle. */

import { subscribeToShell } from '@ship/sdk'
import type { ShellEventRecord, ShellSessionSummary, ShellStreamFrame } from '@ship/contracts'
import type { ChatSession } from '@/lib/api/server'

/** Connection phase shown without discarding cached sidebar content. */
export type RealtimePhase = 'empty' | 'synchronizing' | 'live' | 'offline' | 'error'

/** Immutable shell state consumed with `useSyncExternalStore`. */
export interface ShellState {
  phase: RealtimePhase
  hasSnapshot: boolean
  lastSequence: number
  sessionsById: ReadonlyMap<string, ShellSessionSummary>
  orderedSessionIds: readonly string[]
  synchronizedAt?: number
  error?: string
}

const RECONNECT_DELAYS = [500, 1_000, 2_000, 4_000, 8_000, 15_000] as const

/** Convert SSR/REST session rows into a non-authoritative visible bootstrap. */
export function bootstrapShellState(sessions: ChatSession[]): ShellState {
  const sessionsById = new Map<string, ShellSessionSummary>()
  for (const session of sessions) {
    sessionsById.set(session.id, {
      id: session.id as ShellSessionSummary['id'],
      repoOwner: session.repoOwner,
      repoName: session.repoName,
      title: session.title || `${session.repoOwner}/${session.repoName}`,
      status: session.status,
      createdAt: session.createdAt,
      lastActivity: session.lastActivity,
      archivedAt: session.archivedAt,
      revision: session.revision ?? 1,
      agentId: session.agentType || 'opencode',
      modelId: session.model || 'ship-acp-opencode',
      runtime: { state: 'idle' },
      diffStats: { additions: 0, deletions: 0, files: 0 },
    })
  }
  return buildShellState('synchronizing', false, 0, sessionsById)
}

/** Provider-owned controller; no correctness state lives at module scope. */
export class ShellController {
  private state: ShellState
  private readonly listeners = new Set<() => void>()
  private socket: WebSocket | null = null
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null
  private coalesceTimer: ReturnType<typeof setTimeout> | null = null
  private readonly pendingUpserts = new Map<string, ShellEventRecord>()
  private reconnectAttempt = 0
  private generation = 0
  private lastSeenAt = Date.now()
  private started = false

  constructor(initialSessions: ChatSession[]) {
    this.state = bootstrapShellState(initialSessions)
  }

  /** Return the current immutable store snapshot. */
  getSnapshot = (): ShellState => this.state

  /** Subscribe React or imperative consumers to state changes. */
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  /** Start online/visibility listeners and connect once. */
  start(): void {
    if (this.started) return
    this.started = true
    window.addEventListener('online', this.handleOnline)
    window.addEventListener('offline', this.handleOffline)
    document.addEventListener('visibilitychange', this.handleVisibility)
    this.connect()
  }

  /** Deliberately close and release every browser resource. */
  stop(): void {
    if (!this.started) return
    this.started = false
    this.generation += 1
    window.removeEventListener('online', this.handleOnline)
    window.removeEventListener('offline', this.handleOffline)
    document.removeEventListener('visibilitychange', this.handleVisibility)
    this.clearTimers()
    this.socket?.close(1000, 'provider unmounted')
    this.socket = null
  }

  private connect(): void {
    if (!this.started || !navigator.onLine) {
      this.patch({ phase: 'offline' })
      return
    }
    const generation = ++this.generation
    this.patch({ phase: 'synchronizing', error: undefined })
    void subscribeToShell({
      afterSequence: this.state.hasSnapshot ? this.state.lastSequence : undefined,
      onFrame: (frame) => this.applyFrame(frame),
      onProtocolError: (error) => this.patch({ phase: 'error', error: error.message }),
    })
      .then((socket) => {
        if (!this.started || generation !== this.generation) {
          socket.close(1000, 'superseded')
          return
        }
        this.socket = socket
        this.lastSeenAt = Date.now()
        socket.addEventListener('open', () => this.beginHeartbeat())
        socket.addEventListener('close', (event) => {
          if (this.socket === socket) this.socket = null
          if (!this.started || event.code === 1000) return
          this.patch({ phase: navigator.onLine ? 'synchronizing' : 'offline' })
          this.scheduleReconnect()
        })
        socket.addEventListener('error', () => socket.close())
      })
      .catch((error: unknown) => {
        if (!this.started || generation !== this.generation) return
        this.patch({ phase: navigator.onLine ? 'error' : 'offline', error: String(error) })
        this.scheduleReconnect()
      })
  }

  private applyFrame(frame: ShellStreamFrame): void {
    this.lastSeenAt = Date.now()
    if (frame.type === 'pong') return
    if (frame.type === 'shell.error') {
      this.patch({ phase: 'error', error: frame.code })
      if (frame.retryable) this.scheduleReconnect()
      return
    }
    if (frame.type === 'shell.snapshot') {
      this.pendingUpserts.clear()
      const sessionsById = new Map(frame.sessions.map((summary) => [summary.id, summary]))
      this.state = buildShellState('synchronizing', true, frame.snapshotSequence, sessionsById)
      this.emit()
      return
    }
    if (frame.type === 'shell.synchronized') {
      this.reconnectAttempt = 0
      this.patch({ phase: 'live', lastSequence: frame.sequence, synchronizedAt: Date.now(), error: undefined })
      return
    }
    for (const record of frame.records) this.queueRecord(record)
  }

  private queueRecord(record: ShellEventRecord): void {
    if (record.sequence <= this.state.lastSequence) return
    if (record.event.type === 'session.removed') {
      this.flushPendingUpserts()
      this.applyRecord(record)
      return
    }
    const previous = this.state.sessionsById.get(record.event.summary.id)
    const runtime = record.event.summary.runtime.state
    const immediate = !previous || runtime === 'failed' || (previous.runtime.state !== 'idle' && runtime === 'idle')
    if (immediate) {
      this.flushPendingUpserts()
      this.applyRecord(record)
      return
    }
    this.pendingUpserts.set(record.event.summary.id, record)
    if (!this.coalesceTimer) {
      this.coalesceTimer = setTimeout(() => this.flushPendingUpserts(), 100)
    }
  }

  private flushPendingUpserts(): void {
    if (this.coalesceTimer) clearTimeout(this.coalesceTimer)
    this.coalesceTimer = null
    const records = [...this.pendingUpserts.values()].sort((a, b) => a.sequence - b.sequence)
    this.pendingUpserts.clear()
    for (const record of records) this.applyRecord(record)
  }

  private applyRecord(record: ShellEventRecord): void {
    if (record.sequence <= this.state.lastSequence) return
    const sessionsById = new Map(this.state.sessionsById)
    if (record.event.type === 'session.removed') sessionsById.delete(record.event.sessionId)
    else {
      const previous = sessionsById.get(record.event.summary.id)
      if (!previous || record.event.summary.revision >= previous.revision) {
        sessionsById.set(record.event.summary.id, record.event.summary)
      }
    }
    this.state = buildShellState(this.state.phase, true, record.sequence, sessionsById, this.state)
    this.emit()
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
    if (!this.started || this.reconnectTimer) return
    const base = RECONNECT_DELAYS[Math.min(this.reconnectAttempt, RECONNECT_DELAYS.length - 1)]
    this.reconnectAttempt += 1
    const delay = Math.round(base * (0.8 + Math.random() * 0.4))
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      this.connect()
    }, delay)
  }

  private reconnectNow(): void {
    if (!this.started || !navigator.onLine) return
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
    this.reconnectTimer = null
    this.socket?.close(4001, 'refresh')
    this.socket = null
    this.connect()
  }

  private handleOnline = (): void => this.reconnectNow()
  private handleOffline = (): void => this.patch({ phase: 'offline' })
  private handleVisibility = (): void => {
    if (document.visibilityState === 'visible' && Date.now() - this.lastSeenAt > 60_000) this.reconnectNow()
  }

  private patch(patch: Partial<ShellState>): void {
    this.state = { ...this.state, ...patch }
    this.emit()
  }

  private emit(): void {
    for (const listener of this.listeners) listener()
  }

  private clearTimers(): void {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer)
    if (this.coalesceTimer) clearTimeout(this.coalesceTimer)
    this.reconnectTimer = null
    this.heartbeatTimer = null
    this.coalesceTimer = null
  }
}

function buildShellState(
  phase: RealtimePhase,
  hasSnapshot: boolean,
  lastSequence: number,
  sessionsById: ReadonlyMap<string, ShellSessionSummary>,
  previous?: ShellState,
): ShellState {
  const orderedSessionIds = [...sessionsById.values()]
    .sort((a, b) => b.lastActivity - a.lastActivity || b.revision - a.revision || a.id.localeCompare(b.id))
    .map((session) => session.id)
  return {
    phase,
    hasSnapshot,
    lastSequence,
    sessionsById,
    orderedSessionIds,
    synchronizedAt: previous?.synchronizedAt,
    error: previous?.error,
  }
}
