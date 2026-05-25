'use client'

import { useEffect, useRef, useState } from 'react'

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

function createSessionStatusStore() {
  const statuses = new Map<string, SessionLiveStatus>()
  const listeners = new Set<Listener>()

  // Global version for full-store subscribers (dashboard-client cross-tab sync)
  let globalVersion = 0
  // Per-session versions for isolated card subscriptions
  const sessionVersions = new Map<string, number>()

  function notify() {
    for (const l of listeners) l()
  }

  function bumpSession(sessionId: string) {
    sessionVersions.set(sessionId, (sessionVersions.get(sessionId) ?? 0) + 1)
    globalVersion++
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
      const existing = statuses.get(sessionId) ?? { status: '', steps: [], isRunning: false }
      const { step, ...rest } = partial
      const steps = step
        ? [...existing.steps, step].filter((s, i, arr) => arr.indexOf(s) === i).slice(-5)
        : existing.steps
      statuses.set(sessionId, { ...existing, ...rest, steps })
      bumpSession(sessionId)
      notify()
    },
    addStep(sessionId: string, step: string) {
      const existing = statuses.get(sessionId) ?? { status: '', steps: [], isRunning: false }
      const steps = [...existing.steps, step].filter((s, i, arr) => arr.indexOf(s) === i).slice(-5)
      statuses.set(sessionId, { ...existing, steps })
      bumpSession(sessionId)
      notify()
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
 * Uses deferred useState instead of useSyncExternalStore to avoid incrementing React's
 * nestedUpdateCount on every high-frequency WebSocket event (which triggers the
 * "Maximum update depth exceeded" error when many sessions are subscribed simultaneously).
 */
export function useSessionStatus(sessionId: string): SessionLiveStatus | undefined {
  const [, setVersion] = useState(0)
  const sessionIdRef = useRef(sessionId)
  sessionIdRef.current = sessionId

  useEffect(() => {
    let lastVersion = store.getSessionSnapshot(sessionId)()
    return store.subscribe(() => {
      const next = store.getSessionSnapshot(sessionIdRef.current)()
      if (next !== lastVersion) {
        lastVersion = next
        setVersion((v) => v + 1)
      }
    })
  }, [sessionId])

  return store.get(sessionId)
}

/**
 * Returns the global version counter.
 * Only use when you need to react to ANY session change (e.g. dashboard-client cross-tab sync).
 */
export function useSessionStatusVersion(): number {
  const [version, setVersion] = useState(() => store.getSnapshot())

  useEffect(() => {
    return store.subscribe(() => setVersion(store.getSnapshot()))
  }, [])

  return version
}

export { store as sessionStatusStore }
