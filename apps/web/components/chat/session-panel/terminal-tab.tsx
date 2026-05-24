'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { cn } from '@ship/ui/utils'
import {
  createTerminalInstance,
  connectTerminalWebSocket,
  cleanupTerminalConnection,
} from './terminal-tab-setup'

interface TerminalTabProps {
  sessionId?: string
  sandboxStatus?: string | null
  sandboxId?: string | null
  connectionHint?: string
}

function TerminalPlaceholder({ message, showSpinner }: { message: string; showSpinner?: boolean }) {
  return (
    <div className="size-full bg-[#1e1e1e] rounded-sm flex flex-col p-3 font-mono text-sm">
      <div className="flex items-center gap-1">
        <span className="text-[#4ec9b0]">workspace</span>
        <span className="text-muted-foreground/60">$</span>
        {showSpinner && <span className="w-1.5 h-4 bg-foreground/70 animate-pulse inline-block" />}
      </div>
      <div className="mt-4 text-muted-foreground/40 text-xs">{message}</div>
    </div>
  )
}

function getUnavailableMessage(
  sessionId: string | undefined,
  isProvisioning: boolean,
  hasNoSandbox: boolean,
  connectionFailed: boolean,
  connectionHint?: string,
): string {
  if (!sessionId) return 'Terminal unavailable — no active session'
  if (isProvisioning) return 'Sandbox provisioning...'
  if (hasNoSandbox) return 'Sandbox unavailable — send a message to start the session'
  if (connectionFailed) {
    return connectionHint
      ? `Connection failed — ${connectionHint}`
      : 'Connection failed — fix any errors in the chat (e.g. GitHub access), then send a message to retry.'
  }
  return connectionHint ? `Terminal unavailable — ${connectionHint}` : 'Terminal unavailable'
}

export function TerminalTab({ sessionId, sandboxStatus, sandboxId, connectionHint }: TerminalTabProps) {
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
  const canConnect = sessionId && sandboxId && !isProvisioning && !hasNoSandbox

  const [status, setStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'unavailable'>('unavailable')
  const [connectionFailed, setConnectionFailed] = useState(false)

  useEffect(() => {
    exhaustedRef.current = false
    setConnectionFailed(false)
  }, [sessionId, canConnect])

  useEffect(() => {
    if (!sessionId) {
      setStatus('unavailable')
      return
    }
    if (hasNoSandbox || isProvisioning) {
      setStatus('unavailable')
      return
    }
    if (sandboxId && !exhaustedRef.current) {
      setStatus('connecting')
    }
  }, [sessionId, sandboxId, isProvisioning, hasNoSandbox])

  const cleanup = useCallback(() => {
    cleanupTerminalConnection(
      { wsRef, retryTimerRef, timeoutTimerRef, retryCountRef, exhaustedRef },
      termRef,
      fitRef,
    )
  }, [])

  useEffect(() => {
    if (!containerRef.current || !sessionId || !canConnect) {
      if (!canConnect && sessionId) setStatus('unavailable')
      return
    }

    let cancelled = false
    retryCountRef.current = 0

    async function initTerminal() {
      if (!containerRef.current) return
      const { term, fit } = await createTerminalInstance(containerRef.current)
      if (cancelled) {
        term.dispose()
        return
      }

      termRef.current = term
      fitRef.current = fit

      const refs = { wsRef, retryTimerRef, timeoutTimerRef, retryCountRef, exhaustedRef }
      const callbacks = {
        setStatus,
        setConnectionFailed,
        isCancelled: () => cancelled,
      }
      connectTerminalWebSocket(sessionId!, term, refs, callbacks, maxRetries)
    }

    void initTerminal()

    const resizeObserver = new ResizeObserver(() => {
      fitRef.current?.fit()
    })
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current)
    }

    return () => {
      cancelled = true
      resizeObserver.disconnect()
      cleanup()
    }
  }, [sessionId, canConnect, cleanup])

  if (status === 'unavailable') {
    const message = getUnavailableMessage(sessionId, isProvisioning, hasNoSandbox, connectionFailed, connectionHint)
    return <TerminalPlaceholder message={message} showSpinner={isProvisioning} />
  }

  return (
    <div className="size-full relative">
      <div
        ref={containerRef}
        className={cn('size-full', status === 'connecting' && !termRef.current && 'opacity-50')}
      />
      {status === 'connecting' && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#1e1e1e]/80">
          <span className="text-xs text-muted-foreground animate-pulse">Connecting to sandbox...</span>
        </div>
      )}
    </div>
  )
}
