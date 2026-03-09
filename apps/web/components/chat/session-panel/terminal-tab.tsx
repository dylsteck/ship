'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { cn } from '@ship/ui/utils'

interface TerminalTabProps {
  sessionId?: string
  agentUrl?: string
}

function TerminalPlaceholder({ message }: { message: string }) {
  return (
    <div className="size-full bg-[#1e1e1e] rounded-sm flex flex-col p-3 font-mono text-sm">
      <div className="flex items-center gap-1">
        <span className="text-[#4ec9b0]">workspace</span>
        <span className="text-muted-foreground/60">$</span>
        <span className="w-1.5 h-4 bg-foreground/70 animate-pulse inline-block" />
      </div>
      <div className="mt-4 text-muted-foreground/40 text-xs">{message}</div>
    </div>
  )
}

export function TerminalTab({ sessionId, agentUrl }: TerminalTabProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<import('@xterm/xterm').Terminal | null>(null)
  const fitRef = useRef<import('@xterm/addon-fit').FitAddon | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const [status, setStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'unavailable'>(
    agentUrl ? 'connecting' : 'unavailable',
  )

  const cleanup = useCallback(() => {
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
    if (!containerRef.current || !sessionId || !agentUrl) {
      setStatus('unavailable')
      return
    }

    let cancelled = false

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

      const apiBase = window.location.origin
      const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      const wsUrl = `${wsProtocol}//${window.location.host}/api/terminal/${sessionId}`

      try {
        const ws = new WebSocket(wsUrl)
        wsRef.current = ws

        ws.onopen = () => {
          if (!cancelled) {
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
          if (!cancelled) setStatus('disconnected')
        }

        ws.onerror = () => {
          if (!cancelled) setStatus('disconnected')
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
        if (!cancelled) setStatus('disconnected')
      }
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
  }, [sessionId, agentUrl, cleanup])

  if (status === 'unavailable') {
    return <TerminalPlaceholder message="Terminal unavailable — waiting for sandbox" />
  }

  if (status === 'disconnected' && !termRef.current) {
    return <TerminalPlaceholder message="Disconnected from terminal" />
  }

  return (
    <div className="size-full relative">
      <div
        ref={containerRef}
        className={cn('size-full', status === 'connecting' && 'opacity-50')}
      />
      {status === 'connecting' && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#1e1e1e]/80">
          <span className="text-xs text-muted-foreground animate-pulse">Connecting...</span>
        </div>
      )}
    </div>
  )
}
