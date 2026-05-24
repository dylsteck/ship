'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import type { SessionInfo } from '@/lib/sse-types'
import type { TodoItem, FileDiff, StepCostInfo } from '../types'
import { sessionStatusStore } from './use-session-status-store'
import { useSessionLocalStorageSync } from './session-persistence-storage'

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

  useEffect(() => {
    if (!activeSessionId) return
    const syncFromStore = () => {
      const live = sessionStatusStore.get(activeSessionId)
      if (live?.isRunning && (live.status || live.steps.length > 0)) {
        if (live.status) setStreamingStatus(live.status)
        if (live.steps.length > 0) {
          const steps = live.steps.filter((s) => !/^Waiting \(\d+s\)$/.test(s))
          setStreamingStatusSteps(steps)
          streamingStatusStepsRef.current = steps
        }
      }
    }
    syncFromStore()
    const unsubscribe = sessionStatusStore.subscribe(syncFromStore)
    return unsubscribe
  }, [activeSessionId])

  useSessionLocalStorageSync(
    activeSessionId,
    totalCost,
    lastStepCost,
    sessionInfo,
    sessionTitle,
    sandboxStatus,
    agentSessionId,
    setAgentUrl,
    setTotalCost,
    setLastStepCost,
    setSessionInfo,
    setSessionTitle,
    setSandboxStatus,
    setAgentSessionId,
  )

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
