import { useCallback, useEffect, useRef, useState } from 'react'
import type { MutableRefObject } from 'react'
import {
  cleanupTerminalConnection,
  connectTerminalWebSocket,
  createTerminalInstance,
} from './terminal-tab-setup'

interface UseTerminalConnectionInput {
  sessionId?: string
  sandboxStatus?: string | null
  sandboxId?: string | null
}

export type TerminalStatus = 'connecting' | 'connected' | 'disconnected' | 'unavailable'

/** Owns xterm lifecycle and the session terminal WebSocket connection. */
export function useTerminalConnection({ sessionId, sandboxStatus, sandboxId }: UseTerminalConnectionInput) {
  const containerRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<import('@xterm/xterm').Terminal | null>(null)
  const fitRef = useRef<import('@xterm/addon-fit').FitAddon | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const timeoutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const retryCountRef = useRef(0)
  const exhaustedRef = useRef(false)
  const maxRetries = 3

  const isProvisioning = sandboxStatus === 'provisioning' || sandboxStatus === 'resuming'
  const hasNoSandbox =
    sandboxStatus === 'error' || (!sandboxId && sandboxStatus !== undefined && !isProvisioning)
  const canConnect = Boolean(sessionId && sandboxId && !isProvisioning && !hasNoSandbox)

  const [status, setStatus] = useState<TerminalStatus>(canConnect ? 'connecting' : 'unavailable')
  const [connectionFailed, setConnectionFailed] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    exhaustedRef.current = false
    setConnectionFailed(false)
    setErrorMessage(null)
  }, [sessionId, canConnect])

  useEffect(() => {
    if (!sessionId || hasNoSandbox || isProvisioning) {
      setStatus('unavailable')
      return
    }
    if (sandboxId && !exhaustedRef.current) setStatus('connecting')
  }, [sessionId, sandboxId, isProvisioning, hasNoSandbox])

  const cleanup = useCallback(() => {
    cleanupTerminalConnection(
      { wsRef, retryTimerRef, timeoutTimerRef, retryCountRef, exhaustedRef },
      termRef,
      fitRef,
    )
  }, [])

  useEffect(() => {
    if (!containerRef.current || !sessionId || !canConnect || status !== 'connecting') {
      if (!canConnect && sessionId) setStatus('unavailable')
      return
    }

    let cancelled = false
    retryCountRef.current = 0

    void initTerminal({
      container: containerRef.current,
      sessionId,
      refs: { wsRef, retryTimerRef, timeoutTimerRef, retryCountRef, exhaustedRef },
      termRef,
      fitRef,
      callbacks: { setStatus, setConnectionFailed, setErrorMessage, isCancelled: () => cancelled },
      maxRetries,
    })

    const resizeObserver = new ResizeObserver(() => fitRef.current?.fit())
    resizeObserver.observe(containerRef.current)

    return () => {
      cancelled = true
      resizeObserver.disconnect()
      cleanup()
    }
  }, [sessionId, canConnect, cleanup, status])

  return { containerRef, termRef, status, isProvisioning, hasNoSandbox, connectionFailed, errorMessage }
}

async function initTerminal(input: {
  container: HTMLDivElement
  sessionId: string
  refs: Parameters<typeof connectTerminalWebSocket>[2]
  termRef: MutableRefObject<import('@xterm/xterm').Terminal | null>
  fitRef: MutableRefObject<import('@xterm/addon-fit').FitAddon | null>
  callbacks: Parameters<typeof connectTerminalWebSocket>[3]
  maxRetries: number
}) {
  const { term, fit } = await createTerminalInstance(input.container)
  if (input.callbacks.isCancelled()) {
    term.dispose()
    return
  }
  input.termRef.current = term
  input.fitRef.current = fit
  connectTerminalWebSocket(input.sessionId, term, input.refs, input.callbacks, input.maxRetries)
}
