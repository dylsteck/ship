'use client'

import { useEffect } from 'react'
import { API_URL } from '@/lib/config'
import type { AgentStatus } from '@/components/session/status-indicator'
import { handleSessionWebSocketMessage } from './session-page-websocket-handler'

export function useSessionWebSocket(
  sessionId: string,
  sandboxStatusRef: React.MutableRefObject<'provisioning' | 'ready' | 'error' | 'none'>,
  setAgentStatus: (s: AgentStatus) => void,
  setCurrentTool: (t: string | undefined) => void,
  setSandboxId: (id: string | null) => void,
  setSandboxStatus: (s: 'provisioning' | 'ready' | 'error' | 'none') => void,
  setSandboxProgress: (p: string | null) => void,
  setOpencodeUrl: (url: string | null) => void,
  setOpencodeSessionId: (id: string | null) => void,
  setSessionTitle: (title: string | undefined) => void,
  setWsConnected: (connected: boolean) => void,
) {
  useEffect(() => {
    const setters = {
      setAgentStatus,
      setCurrentTool,
      setSandboxId,
      setSandboxStatus,
      setSandboxProgress,
      setOpencodeUrl,
      setOpencodeSessionId,
      setSessionTitle,
    }

    const ws = new WebSocket(`${API_URL.replace('http', 'ws')}/sessions/${sessionId}/websocket`)

    ws.onopen = () => setWsConnected(true)
    ws.onclose = () => setWsConnected(false)
    ws.onerror = () => setWsConnected(false)
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as Record<string, unknown>
        handleSessionWebSocketMessage(data, setters, sandboxStatusRef)
      } catch {
        // Ignore parse errors
      }
    }

    return () => ws.close()
  }, [
    sessionId,
    sandboxStatusRef,
    setAgentStatus,
    setCurrentTool,
    setOpencodeSessionId,
    setOpencodeUrl,
    setSandboxId,
    setSandboxProgress,
    setSandboxStatus,
    setSessionTitle,
    setWsConnected,
  ])
}
