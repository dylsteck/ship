'use client'

import { useState, useEffect, useRef } from 'react'
import { getSession, getSessionSandbox } from '@/lib/api'
import { normalizeSandboxStatus } from './session-sandbox-utils'

export function useSessionSandbox(sessionId: string) {
  const [sandboxId, setSandboxId] = useState<string | null>(null)
  const [sandboxStatus, setSandboxStatus] = useState<'provisioning' | 'ready' | 'error' | 'none'>('none')
  const [sandboxProgress, setSandboxProgress] = useState<string | null>(null)
  const [opencodeUrl, setOpencodeUrl] = useState<string | null>(null)
  const [opencodeSessionId, setOpencodeSessionId] = useState<string | null>(null)
  const [sessionInfo, setSessionInfo] = useState({
    repoOwner: '',
    repoName: '',
    branch: undefined as string | undefined,
    model: undefined as string | undefined,
  })

  const sandboxStatusRef = useRef(sandboxStatus)
  const opencodeUrlRef = useRef(opencodeUrl)
  const wsConnectedRef = useRef(false)

  useEffect(() => {
    sandboxStatusRef.current = sandboxStatus
  }, [sandboxStatus])
  useEffect(() => {
    opencodeUrlRef.current = opencodeUrl
  }, [opencodeUrl])

  useEffect(() => {
    async function loadSession() {
      try {
        const data = await getSession(sessionId)
        setSessionInfo({
          repoOwner: data.repoOwner,
          repoName: data.repoName,
          branch: (data as { branch?: string }).branch,
          model: data.model,
        })
      } catch (err) {
        console.error('Failed to load session:', err)
      }
    }

    async function loadSandbox() {
      try {
        const data = await getSessionSandbox(sessionId)
        setSandboxId(data?.sandboxId || null)
        setSandboxStatus(normalizeSandboxStatus(data?.status))
        if (data?.opencodeUrl) setOpencodeUrl(data.opencodeUrl)
        if (data?.opencodeSessionId) setOpencodeSessionId(data.opencodeSessionId)
      } catch (err) {
        console.error('[page-client] Failed to load sandbox:', err)
        setSandboxStatus('error')
      }
    }

    loadSession()
    loadSandbox()

    const interval = setInterval(() => {
      if (!wsConnectedRef.current && (sandboxStatusRef.current !== 'ready' || !opencodeUrlRef.current)) {
        loadSandbox()
      }
    }, 2000)

    return () => clearInterval(interval)
  }, [sessionId])

  return {
    sandboxId,
    setSandboxId,
    sandboxStatus,
    setSandboxStatus,
    sandboxProgress,
    setSandboxProgress,
    opencodeUrl,
    setOpencodeUrl,
    opencodeSessionId,
    setOpencodeSessionId,
    sessionInfo,
    sandboxStatusRef,
    wsConnectedRef,
    setWsConnected: (connected: boolean) => {
      wsConnectedRef.current = connected
    },
  }
}
