'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import type { SessionInfo } from '@/lib/sse-types'
import type { TodoItem, FileDiff, StepCostInfo } from '../types'
import { sessionStatusStore } from './use-session-status-store'

export function useSessionPersistence(activeSessionId: string | null) {
  const [agentUrl, setAgentUrl] = useState<string>('')
  const [agentSessionId, setAgentSessionId] = useState<string>('')
  const [sessionTodos, setSessionTodos] = useState<TodoItem[]>([])
  const [fileDiffs, setFileDiffs] = useState<FileDiff[]>([])
  const [totalCost, setTotalCost] = useState<number>(0)
  const [lastStepCost, setLastStepCost] = useState<StepCostInfo | null>(null)
  const [sessionTitle, setSessionTitle] = useState<string>('')
  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null)
  const [streamStartTime, setStreamStartTime] = useState<number | null>(null)
  const [sandboxStatus, setSandboxStatus] = useState<string>('unknown')
  const [streamingStatus, setStreamingStatus] = useState<string>('')
  const [streamingStatusSteps, setStreamingStatusSteps] = useState<string[]>([])
  const streamingStatusStepsRef = useRef<string[]>([])

  const setStreamingStatusWithSteps = useCallback((msg: string, appendToSteps = true) => {
    setStreamingStatus(msg)
    if (msg && appendToSteps) {
      setStreamingStatusSteps((prev) => {
        if (prev.length > 0 && prev[prev.length - 1] === msg) return prev
        const next = [...prev, msg]
        streamingStatusStepsRef.current = next
        return next
      })
    }
  }, [])

  const clearStreamingStatusSteps = useCallback(() => {
    setStreamingStatusSteps([])
    streamingStatusStepsRef.current = []
  }, [])

  // Sync from sessionStatusStore when navigating to a session that's already streaming
  // (e.g. created from homepage with streamSessionInBackground)
  useEffect(() => {
    if (!activeSessionId) return
    const syncFromStore = () => {
      const live = sessionStatusStore.get(activeSessionId)
      if (live?.isRunning && (live.status || live.steps.length > 0)) {
        if (live.status) setStreamingStatus(live.status)
        if (live.steps.length > 0) {
          // Filter out heartbeat "Waiting (Xs)" steps — they replace real progress
          const steps = live.steps.filter((s) => !/^Waiting \(\d+s\)$/.test(s))
          setStreamingStatusSteps(steps)
          streamingStatusStepsRef.current = steps
        }
      }
    }
    syncFromStore()
    const unsubscribe = sessionStatusStore.subscribe(syncFromStore)
    return () => {
      unsubscribe()
    }
  }, [activeSessionId])

  // Restore persisted sidebar data from localStorage when session changes
  useEffect(() => {
    if (!activeSessionId) return
    try {
      const savedUrl = localStorage.getItem(`agent-url-${activeSessionId}`)
      if (savedUrl) setAgentUrl(savedUrl)

      const savedCost = localStorage.getItem(`total-cost-${activeSessionId}`)
      if (savedCost) setTotalCost(Number(savedCost))

      const savedStepCost = localStorage.getItem(`step-cost-${activeSessionId}`)
      if (savedStepCost) setLastStepCost(JSON.parse(savedStepCost))

      const savedSessionInfo = localStorage.getItem(`session-info-${activeSessionId}`)
      if (savedSessionInfo) setSessionInfo(JSON.parse(savedSessionInfo))

      const savedTitle = localStorage.getItem(`session-title-${activeSessionId}`)
      if (savedTitle) setSessionTitle(savedTitle)

      const savedSandboxStatus = localStorage.getItem(`sandbox-status-${activeSessionId}`)
      if (savedSandboxStatus) setSandboxStatus(savedSandboxStatus)

      const savedAgentSessionId = localStorage.getItem(`agent-session-id-${activeSessionId}`)
      if (savedAgentSessionId) setAgentSessionId(savedAgentSessionId)
    } catch {}
  }, [activeSessionId])

  // Persist sidebar stats to localStorage when they change
  useEffect(() => {
    if (!activeSessionId) return
    try {
      if (totalCost > 0) localStorage.setItem(`total-cost-${activeSessionId}`, String(totalCost))
      if (lastStepCost) localStorage.setItem(`step-cost-${activeSessionId}`, JSON.stringify(lastStepCost))
      if (sessionInfo) localStorage.setItem(`session-info-${activeSessionId}`, JSON.stringify(sessionInfo))
      if (sessionTitle) localStorage.setItem(`session-title-${activeSessionId}`, sessionTitle)
      if (sandboxStatus) localStorage.setItem(`sandbox-status-${activeSessionId}`, sandboxStatus)
      if (agentSessionId) localStorage.setItem(`agent-session-id-${activeSessionId}`, agentSessionId)
    } catch {}
  }, [activeSessionId, totalCost, lastStepCost, sessionInfo, sessionTitle, sandboxStatus, agentSessionId])

  return {
    agentUrl,
    setAgentUrl,
    agentSessionId,
    setAgentSessionId,
    sessionTodos,
    setSessionTodos,
    fileDiffs,
    setFileDiffs,
    totalCost,
    setTotalCost,
    lastStepCost,
    setLastStepCost,
    sessionTitle,
    setSessionTitle,
    sessionInfo,
    setSessionInfo,
    streamStartTime,
    setStreamStartTime,
    sandboxStatus,
    setSandboxStatus,
    streamingStatus,
    setStreamingStatus: setStreamingStatusWithSteps,
    streamingStatusSteps,
    streamingStatusStepsRef,
    clearStreamingStatusSteps,
  }
}
