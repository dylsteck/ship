'use client'

import { useEffect } from 'react'
import type { SessionInfo } from '@/lib/sse-types'
import type { StepCostInfo } from '../types'

export function useSessionLocalStorageSync(
  activeSessionId: string | null,
  totalCost: number,
  lastStepCost: StepCostInfo | null,
  sessionInfo: SessionInfo | null,
  sessionTitle: string,
  sandboxStatus: string,
  agentSessionId: string,
  setAgentUrl: (url: string) => void,
  setTotalCost: (n: number) => void,
  setLastStepCost: (v: StepCostInfo | null) => void,
  setSessionInfo: (v: SessionInfo | null) => void,
  setSessionTitle: (v: string) => void,
  setSandboxStatus: (v: string) => void,
  setAgentSessionId: (v: string) => void,
) {
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
  }, [
    activeSessionId,
    setAgentUrl,
    setAgentSessionId,
    setLastStepCost,
    setSandboxStatus,
    setSessionInfo,
    setSessionTitle,
    setTotalCost,
  ])

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
}
