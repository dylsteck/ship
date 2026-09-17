'use client'

/** Provider-owned registry for visible and recently visited session controllers. */

import { createContext, useContext, useEffect, useMemo, useRef, useSyncExternalStore } from 'react'
import { SessionController } from './session-controller'
import { createEmptySessionState, type SessionControllerState } from './session-state'

const RETENTION_MS = 5 * 60 * 1_000

class SessionControllerRegistry {
  private readonly controllers = new Map<string, SessionController>()
  private readonly disposalTimers = new Map<string, ReturnType<typeof setTimeout>>()

  get(sessionId: string): SessionController {
    const existing = this.controllers.get(sessionId)
    if (existing) return existing
    const controller = new SessionController(sessionId)
    this.controllers.set(sessionId, controller)
    return controller
  }

  retain(sessionId: string): SessionController {
    const timer = this.disposalTimers.get(sessionId)
    if (timer) clearTimeout(timer)
    this.disposalTimers.delete(sessionId)
    const controller = this.get(sessionId)
    controller.start()
    return controller
  }

  release(sessionId: string): void {
    const controller = this.controllers.get(sessionId)
    if (!controller) return
    controller.suspend()
    const existing = this.disposalTimers.get(sessionId)
    if (existing) clearTimeout(existing)
    this.disposalTimers.set(
      sessionId,
      setTimeout(() => {
        controller.dispose()
        this.controllers.delete(sessionId)
        this.disposalTimers.delete(sessionId)
      }, RETENTION_MS),
    )
  }

  dispose(): void {
    for (const timer of this.disposalTimers.values()) clearTimeout(timer)
    for (const controller of this.controllers.values()) controller.dispose()
    this.disposalTimers.clear()
    this.controllers.clear()
  }
}

const RegistryContext = createContext<SessionControllerRegistry | null>(null)

/** Scope controller caches to the authenticated React application. */
export function SessionControllerProvider({ children }: { children: React.ReactNode }) {
  const registryRef = useRef<SessionControllerRegistry | null>(null)
  if (!registryRef.current) registryRef.current = new SessionControllerRegistry()

  useEffect(() => {
    const registry = registryRef.current
    return () => registry?.dispose()
  }, [])

  return <RegistryContext.Provider value={registryRef.current}>{children}</RegistryContext.Provider>
}

/** Retain the controller for a currently rendered session. */
export function useSessionController(sessionId: string): SessionController {
  const registry = useRegistry()
  const controller = useMemo(() => registry.get(sessionId), [registry, sessionId])
  useEffect(() => {
    registry.retain(sessionId)
    return () => registry.release(sessionId)
  }, [registry, sessionId])
  return controller
}

/** Subscribe to the normalized state for one currently visible session. */
export function useSessionControllerState(sessionId: string): SessionControllerState {
  const controller = useSessionController(sessionId)
  return useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot)
}

/** Retain at most one visible session while permitting an empty home state. */
export function useActiveSessionController(sessionId: string | null): {
  controller: SessionController | null
  state: SessionControllerState
} {
  const registry = useRegistry()
  const controller = useMemo(() => (sessionId ? registry.get(sessionId) : null), [registry, sessionId])
  const emptyState = useMemo(() => createEmptySessionState(sessionId ?? ''), [sessionId])
  useEffect(() => {
    if (!sessionId) return
    registry.retain(sessionId)
    return () => registry.release(sessionId)
  }, [registry, sessionId])
  const state = useSyncExternalStore(
    controller?.subscribe ?? subscribeNoop,
    controller?.getSnapshot ?? (() => emptyState),
    controller?.getSnapshot ?? (() => emptyState),
  )
  return { controller, state }
}

/** Access the registry for background commands without opening a consumer socket. */
export function useSessionControllerRegistry(): Pick<SessionControllerRegistry, 'get'> {
  return useRegistry()
}

function useRegistry(): SessionControllerRegistry {
  const registry = useContext(RegistryContext)
  if (!registry) throw new Error('useSessionController must be used within SessionControllerProvider')
  return registry
}

function subscribeNoop(): () => void {
  return () => undefined
}
