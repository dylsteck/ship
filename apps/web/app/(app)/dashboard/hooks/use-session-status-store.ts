'use client'

import { useSyncExternalStore } from 'react'

export interface SessionLiveStatus {
  status: string
  steps: string[]
  isRunning: boolean
  /** First snippet of assistant text for preview */
  contentPreview?: string
  /** Session title from agent or fallback generator */
  title?: string
  /** Current reasoning text snippet while agent is thinking */
  reasoningPreview?: string
}

/** Internal update shape — `step` is consumed and merged into `steps` */
type SessionLiveStatusUpdate = Partial<SessionLiveStatus> & { step?: string }

type Listener = () => void

const EMPTY_STATUS: SessionLiveStatus = { status: '', steps: [], isRunning: false }

function createSessionStatusStore() {
  const statuses = new Map<string, SessionLiveStatus>()
  const listeners = new Set<Listener>()
  let notifyQueued = false

  // Global version for full-store subscribers (dashboard-client cross-tab sync)
  let globalVersion = 0
  // Per-session versions for isolated card subscriptions
  const sessionVersions = new Map<string, number>()

  function notify() {
    notifyQueued = false
    for (const l of listeners) l()
  }

  function scheduleNotify() {
    if (notifyQueued) return
    notifyQueued = true
    queueMicrotask(notify)
  }

  function bumpSession(sessionId: string) {
    sessionVersions.set(sessionId, (sessionVersions.get(sessionId) ?? 0) + 1)
    globalVersion++
  }

  function commit(sessionId: string, next: SessionLiveStatus) {
    if (isSameStatus(statuses.get(sessionId), next)) return
    statuses.set(sessionId, next)
    bumpSession(sessionId)
    scheduleNotify()
  }

  return {
    subscribe(listener: Listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    /** Global snapshot — changes on ANY session update. Used by dashboard-client. */
    getSnapshot() {
      return globalVersion
    },
    /** Per-session snapshot factory. Returns a stable function per sessionId. */
    getSessionSnapshot(sessionId: string) {
      return () => sessionVersions.get(sessionId) ?? 0
    },
    /** Merge partial update. Optional `step` is appended to the steps list. */
    update(sessionId: string, partial: SessionLiveStatusUpdate) {
      const existing = statuses.get(sessionId) ?? EMPTY_STATUS
      const { step, ...rest } = partial
      const steps = step
        ? [...existing.steps, step].filter((s, i, arr) => arr.indexOf(s) === i).slice(-5)
        : existing.steps
      commit(sessionId, { ...existing, ...rest, steps })
    },
    addStep(sessionId: string, step: string) {
      const existing = statuses.get(sessionId) ?? EMPTY_STATUS
      const steps = [...existing.steps, step].filter((s, i, arr) => arr.indexOf(s) === i).slice(-5)
      commit(sessionId, { ...existing, steps })
    },
    get(sessionId: string): SessionLiveStatus | undefined {
      return statuses.get(sessionId)
    },
    getAll() {
      return statuses
    },
  }
}

// Singleton
const store = createSessionStatusStore()

/**
 * Subscribe to a single session's live status.
 * Store notifications are coalesced so high-frequency WebSocket events do not
 * force a React update for every raw event.
 */
export function useSessionStatus(sessionId: string): SessionLiveStatus | undefined {
  useSyncExternalStore(store.subscribe, store.getSessionSnapshot(sessionId), () => 0)

  return store.get(sessionId)
}

/**
 * Returns the global version counter.
 * Only use when you need to react to ANY session change (e.g. dashboard-client cross-tab sync).
 */
export function useSessionStatusVersion(): number {
  return useSyncExternalStore(store.subscribe, store.getSnapshot, () => 0)
}

export { store as sessionStatusStore }

function isSameStatus(left: SessionLiveStatus | undefined, right: SessionLiveStatus): boolean {
  if (!left) return false
  return (
    left.status === right.status &&
    left.isRunning === right.isRunning &&
    left.contentPreview === right.contentPreview &&
    left.title === right.title &&
    left.reasoningPreview === right.reasoningPreview &&
    areSameSteps(left.steps, right.steps)
  )
}

function areSameSteps(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((step, index) => step === right[index])
}
