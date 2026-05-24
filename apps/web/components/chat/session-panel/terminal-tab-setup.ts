import type { MutableRefObject } from 'react'
import { API_URL } from '@/lib/config'
import { getApiToken } from '@/lib/api/client'

export const RETRY_INTERVAL = 5000
export const CONNECTION_TIMEOUT_MS = 15000

export interface TerminalConnectionRefs {
  wsRef: MutableRefObject<WebSocket | null>
  retryTimerRef: MutableRefObject<ReturnType<typeof setTimeout> | null>
  timeoutTimerRef: MutableRefObject<ReturnType<typeof setTimeout> | null>
  retryCountRef: MutableRefObject<number>
  exhaustedRef: MutableRefObject<boolean>
}

export interface TerminalConnectionCallbacks {
  setStatus: (status: 'connecting' | 'connected' | 'disconnected' | 'unavailable') => void
  setConnectionFailed: (failed: boolean) => void
  isCancelled: () => boolean
}

export async function createTerminalInstance(container: HTMLDivElement) {
  const [{ Terminal }, { FitAddon }, { WebLinksAddon }] = await Promise.all([
    import('@xterm/xterm'),
    import('@xterm/addon-fit'),
    import('@xterm/addon-web-links'),
  ])

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
  term.open(container)
  fit.fit()

  return { term, fit }
}

export function connectTerminalWebSocket(
  sessionId: string,
  term: import('@xterm/xterm').Terminal,
  refs: TerminalConnectionRefs,
  callbacks: TerminalConnectionCallbacks,
  maxRetries: number,
): void {
  if (callbacks.isCancelled()) return

  const token = getApiToken()
  const wsUrl = `${API_URL.replace('http', 'ws')}/terminal/${sessionId}${token ? `?token=${encodeURIComponent(token)}` : ''}`

  refs.timeoutTimerRef.current = setTimeout(() => {
    if (callbacks.isCancelled()) return
    if (refs.wsRef.current?.readyState !== WebSocket.OPEN) {
      refs.retryCountRef.current = maxRetries
      refs.exhaustedRef.current = true
      callbacks.setConnectionFailed(true)
      callbacks.setStatus('unavailable')
      if (refs.wsRef.current) {
        refs.wsRef.current.close()
        refs.wsRef.current = null
      }
    }
  }, CONNECTION_TIMEOUT_MS)

  try {
    const ws = new WebSocket(wsUrl)
    refs.wsRef.current = ws

    ws.onopen = () => {
      if (!callbacks.isCancelled()) {
        if (refs.timeoutTimerRef.current) {
          clearTimeout(refs.timeoutTimerRef.current)
          refs.timeoutTimerRef.current = null
        }
        callbacks.setStatus('connected')
        ws.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }))
      }
    }

    ws.onmessage = (event) => {
      if (typeof event.data === 'string') {
        term.write(event.data)
      }
    }

    ws.onclose = () => {
      if (!callbacks.isCancelled()) {
        if (refs.timeoutTimerRef.current) {
          clearTimeout(refs.timeoutTimerRef.current)
          refs.timeoutTimerRef.current = null
        }
        refs.retryCountRef.current += 1
        if (refs.retryCountRef.current >= maxRetries) {
          refs.exhaustedRef.current = true
          callbacks.setConnectionFailed(true)
          callbacks.setStatus('unavailable')
        } else {
          callbacks.setStatus('disconnected')
          scheduleTerminalRetry(sessionId, term, refs, callbacks, maxRetries)
        }
      }
    }

    ws.onerror = () => {
      if (!callbacks.isCancelled()) {
        callbacks.setStatus('disconnected')
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
    if (!callbacks.isCancelled()) {
      callbacks.setStatus('connecting')
      scheduleTerminalRetry(sessionId, term, refs, callbacks, maxRetries)
    }
  }
}

function scheduleTerminalRetry(
  sessionId: string,
  term: import('@xterm/xterm').Terminal,
  refs: TerminalConnectionRefs,
  callbacks: TerminalConnectionCallbacks,
  maxRetries: number,
): void {
  if (callbacks.isCancelled()) return
  refs.retryTimerRef.current = setTimeout(() => {
    if (!callbacks.isCancelled()) {
      if (refs.wsRef.current) {
        refs.wsRef.current.close()
        refs.wsRef.current = null
      }
      connectTerminalWebSocket(sessionId, term, refs, callbacks, maxRetries)
    }
  }, RETRY_INTERVAL)
}

export function cleanupTerminalConnection(
  refs: TerminalConnectionRefs,
  termRef: MutableRefObject<import('@xterm/xterm').Terminal | null>,
  fitRef: MutableRefObject<import('@xterm/addon-fit').FitAddon | null>,
): void {
  if (refs.retryTimerRef.current) {
    clearTimeout(refs.retryTimerRef.current)
    refs.retryTimerRef.current = null
  }
  if (refs.timeoutTimerRef.current) {
    clearTimeout(refs.timeoutTimerRef.current)
    refs.timeoutTimerRef.current = null
  }
  if (refs.wsRef.current) {
    refs.wsRef.current.close()
    refs.wsRef.current = null
  }
  if (termRef.current) {
    termRef.current.dispose()
    termRef.current = null
  }
  fitRef.current = null
}
