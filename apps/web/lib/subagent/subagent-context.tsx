'use client'

/**
 * Subagent Context
 *
 * Provides global state management for viewing subagent sessions.
 * Allows any component to open/close the subagent detail sheet.
 */

import * as React from 'react'
import type { SubagentViewState } from './types'

interface SubagentContextValue {
  // Current view state
  viewState: SubagentViewState

  // Actions
  openSubagent: (sessionId: string, parentToolCallId: string, toolName?: string) => void
  closeSubagent: () => void
  toggleSubagent: (sessionId: string, parentToolCallId: string, toolName?: string) => void
}

const SubagentContext = React.createContext<SubagentContextValue | null>(null)

export function SubagentProvider({ children }: { children: React.ReactNode }) {
  const [viewState, setViewState] = React.useState<SubagentViewState>({
    sessionId: null,
    isOpen: false,
    parentToolCallId: null,
    toolName: null,
  })

  const openSubagent = React.useCallback((sessionId: string, parentToolCallId: string, toolName?: string) => {
    setViewState({
      sessionId,
      parentToolCallId,
      toolName: toolName || null,
      isOpen: true,
    })
  }, [])

  const closeSubagent = React.useCallback(() => {
    setViewState((prev) => ({
      ...prev,
      isOpen: false,
    }))
    // Clear session after animation
    setTimeout(() => {
      setViewState({
        sessionId: null,
        isOpen: false,
        parentToolCallId: null,
        toolName: null,
      })
    }, 200)
  }, [])

  const toggleSubagent = React.useCallback((sessionId: string, parentToolCallId: string, toolName?: string) => {
    setViewState((prev) => {
      if (prev.sessionId === sessionId && prev.isOpen) {
        return { sessionId: null, parentToolCallId: null, toolName: null, isOpen: false }
      }
      return { sessionId, parentToolCallId, toolName: toolName || null, isOpen: true }
    })
  }, [])

  const value = React.useMemo(
    () => ({
      viewState,
      openSubagent,
      closeSubagent,
      toggleSubagent,
    }),
    [viewState, openSubagent, closeSubagent, toggleSubagent],
  )

  return <SubagentContext.Provider value={value}>{children}</SubagentContext.Provider>
}

export function useSubagent() {
  const context = React.useContext(SubagentContext)
  if (!context) {
    throw new Error('useSubagent must be used within SubagentProvider')
  }
  return context
}

export function useSubagentViewState() {
  const { viewState } = useSubagent()
  return viewState
}
