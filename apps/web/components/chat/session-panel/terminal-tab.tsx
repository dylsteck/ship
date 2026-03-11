'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { cn } from '@ship/ui/utils'
import { API_URL } from '@/lib/config'

interface TerminalTabProps {
  sessionId?: string
  sandboxStatus?: string | null
  sandboxId?: string | null
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

const RETRY_INTERVAL = 5000
const CONNECTION_TIMEOUT_MS = 15000

export function TerminalTab({ sessionId, sandboxStatus, sandboxId }: TerminalTabProps) {
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

  const [status, setStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'unavailable'>(
    'unavailable',
  )
  const [connectionFailed, setConnectionFailed] = useState(false)

  // Reset exhausted when session or sandbox eligibility changes (e.g. new session, sandbox just provisioned)
  useEffect(() => {
    exhaustedRef.current = false
    setConnectionFailed(false)
  }, [sessionId, canConnect])

  // Update status when sandbox state changes — don't override 'unavailable' if we've exhausted retries
  useEffect(() => {
    if (!sessionId) {
      setStatus('unavailable')
      return
    }
    if (hasNoSandbox) {
      setStatus('unavailable')
      return
    }
    if (isProvisioning) {
      setStatus('unavailable')
      return
    }
    if (sandboxId && !exhaustedRef.current) {
      setStatus('connecting')
    }
  }, [sessionId, sandboxId, isProvisioning, hasNoSandbox])

  const cleanup = useCallback(() => {
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current)
      retryTimerRef.current = null
    }
    if (timeoutTimerRef.current) {
      clearTimeout(timeoutTimerRef.current)
      timeoutTimerRef.current = null
    }
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
    if (termRef.current) {
      termRef.current.dispose()
      termRef.current = null
    }
    fitRef.current = null
  }, [])

  useEffect(() => {
    if (!containerRef.current || !sessionId || !canConnect) {
      if (!canConnect && sessionId) setStatus('unavailable')
      return
    }

    let cancelled = false
    retryCountRef.current = 0

    async function initTerminal() {
      const [{ Terminal }, { FitAddon }, { WebLinksAddon }] = await Promise.all([
        import('@xterm/xterm'),
        import('@xterm/addon-fit'),
        import('@xterm/addon-web-links'),
      ])

      if (cancelled || !containerRef.current) return

      const fit = new FitAddon()
      const webLinks = new WebLinksAddon()
      const term = new Terminal({
        cursorBlink: true,
        fontSize: 13,
        fontFamily: 'Menlo, Monaco, "Courier New", monospace',
        theme: {
          background: '#1e1e1e',
          foreground: '#cccccc',
          cursor: '#cccccc',
          selectionBackground: '#264f78',
        },
        allowProposedApi: true,
      })

      term.loadAddon(fit)
      term.loadAddon(webLinks)
      term.open(containerRef.current)
      fit.fit()

      termRef.current = term
      fitRef.current = fit

      connectWebSocket(term)
    }

    function connectWebSocket(term: import('@xterm/xterm').Terminal) {
      if (cancelled) return

      const wsUrl = `${API_URL.replace('http', 'ws')}/terminal/${sessionId}`

      // Connection timeout: if we don't connect in 15s, give up
      timeoutTimerRef.current = setTimeout(() => {
        if (cancelled) return
        if (wsRef.current?.readyState !== WebSocket.OPEN) {
          retryCountRef.current = maxRetries
          exhaustedRef.current = true
          setConnectionFailed(true)
          setStatus('unavailable')
          if (wsRef.current) {
            wsRef.current.close()
            wsRef.current = null
          }
        }
      }, CONNECTION_TIMEOUT_MS)

      try {
        const ws = new WebSocket(wsUrl)
        wsRef.current = ws

        ws.onopen = () => {
          if (!cancelled) {
            if (timeoutTimerRef.current) {
              clearTimeout(timeoutTimerRef.current)
              timeoutTimerRef.current = null
            }
            setStatus('connected')
            const dims = { cols: term.cols, rows: term.rows }
            ws.send(JSON.stringify({ type: 'resize', ...dims }))
          }
        }

        ws.onmessage = (event) => {
          if (typeof event.data === 'string') {
            term.write(event.data)
          }
        }

        ws.onclose = () => {
          if (!cancelled) {
            if (timeoutTimerRef.current) {
              clearTimeout(timeoutTimerRef.current)
              timeoutTimerRef.current = null
            }
            retryCountRef.current += 1
            if (retryCountRef.current >= maxRetries) {
              exhaustedRef.current = true
              setConnectionFailed(true)
              setStatus('unavailable')
            } else {
              setStatus('disconnected')
              scheduleRetry(term)
            }
          }
        }

        ws.onerror = () => {
          if (!cancelled) {
            setStatus('disconnected')
            // onclose will fire after onerror, retry handled there
          }
        }

        term.onData((data) => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'input', data }))
          }
        })

        term.onResize(({ cols, rows }) => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'resize', cols, rows }))
          }
        })
      } catch {
        if (!cancelled) {
          setStatus('connecting')
          scheduleRetry(term)
        }
      }
    }

    function scheduleRetry(term: import('@xterm/xterm').Terminal) {
      if (cancelled) return
      retryTimerRef.current = setTimeout(() => {
        if (!cancelled) {
          // Close old ws if still around
          if (wsRef.current) {
            wsRef.current.close()
            wsRef.current = null
          }
          connectWebSocket(term)
        }
      }, RETRY_INTERVAL)
    }

    initTerminal()

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
    const message = !sessionId
      ? 'Terminal unavailable — no active session'
      : isProvisioning
        ? 'Sandbox provisioning...'
        : hasNoSandbox
          ? 'Sandbox unavailable — send a message to start the session'
          : connectionFailed
            ? 'Connection failed — send a message to restart the session'
            : 'Terminal unavailable'
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
