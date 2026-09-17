'use client'

/** React provider for the single authenticated user-shell subscription. */

import { createContext, useContext, useEffect, useRef, useSyncExternalStore } from 'react'
import type { ChatSession } from '@/lib/api/server'
import { ShellController, type ShellState } from './shell-store'

const ShellControllerContext = createContext<ShellController | null>(null)

/** Own exactly one shell controller for an authenticated application tree. */
export function ShellProvider({ sessions, children }: { sessions: ChatSession[]; children: React.ReactNode }) {
  const controllerRef = useRef<ShellController | null>(null)
  if (!controllerRef.current) controllerRef.current = new ShellController(sessions)

  useEffect(() => {
    const controller = controllerRef.current
    controller?.start()
    return () => controller?.stop()
  }, [])

  return <ShellControllerContext.Provider value={controllerRef.current}>{children}</ShellControllerContext.Provider>
}

/** Read the complete immutable shell snapshot. */
export function useShellState(): ShellState {
  const controller = useShellController()
  return useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot)
}

/** Access the provider-owned shell controller for imperative mutations. */
export function useShellController(): ShellController {
  const controller = useContext(ShellControllerContext)
  if (!controller) throw new Error('useShellController must be used within ShellProvider')
  return controller
}
