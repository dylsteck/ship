'use client'

import { useCallback, useRef, useSyncExternalStore } from 'react'

export interface SessionLiveStatus {
  status: string
  steps: string[]
  isRunning: boolean
  /** First snippet of assistant text for preview */
  contentPreview?: string
}

type Listener = () => void

/**
 * Lightweight store for per-session live status on the homepage.
 * Each session that's started from the homepage gets its status tracked here
 * by reading the SSE stream in the background.
 */
function createSessionStatusStore() {
  const statuses = new Map<string, SessionLiveStatus>()
  const listeners = new Set<Listener>()

  function notify() {
    for (const l of listeners) l()
  }

  return {
    subscribe(listener: Listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    getSnapshot() {
      return statuses
    },
    update(sessionId: string, partial: Partial<SessionLiveStatus>) {
      const existing = statuses.get(sessionId) ?? { status: '', steps: [], isRunning: false }
      statuses.set(sessionId, { ...existing, ...partial })
      notify()
    },
    addStep(sessionId: string, step: string) {
      const existing = statuses.get(sessionId) ?? { status: '', steps: [], isRunning: false }
      // Keep last 5 steps
      const steps = [...existing.steps, step].slice(-5)
      statuses.set(sessionId, { ...existing, steps })
      notify()
    },
    get(sessionId: string): SessionLiveStatus | undefined {
      return statuses.get(sessionId)
    },
  }
}

// Singleton
const store = createSessionStatusStore()

export function useSessionStatusStore() {
  const storeRef = useRef(store)
  const map = useSyncExternalStore(
    storeRef.current.subscribe,
    storeRef.current.getSnapshot,
    storeRef.current.getSnapshot,
  )

  const getStatus = useCallback(
    (sessionId: string): SessionLiveStatus | undefined => map.get(sessionId),
    [map],
  )

  return {
    getStatus,
    update: storeRef.current.update,
    addStep: storeRef.current.addStep,
  }
}

export { store as sessionStatusStore }
