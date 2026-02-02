'use client'

import { useEffect, useRef, useState } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { X } from 'lucide-react'
import '@xterm/xterm/css/xterm.css'

interface TerminalDrawerProps {
  sandboxId: string | null
  isOpen: boolean
  onOpenChange: (open: boolean) => void
}

export function TerminalDrawer({ sandboxId, isOpen, onOpenChange }: TerminalDrawerProps) {
  const terminalRef = useRef<HTMLDivElement>(null)
  const terminal = useRef<Terminal | undefined>(undefined)
  const fitAddon = useRef<FitAddon | null>(null)
  const webLinksAddon = useRef<WebLinksAddon | null>(null)
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'error'>(
    'connecting',
  )

  useEffect(() => {
    if (!isOpen || !terminalRef.current) return

    // Clean up existing terminal
    if (terminal.current) {
      terminal.current.dispose()
    }

    // Initialize terminal
    terminal.current = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: 'JetBrains Mono, Menlo, Monaco, "Courier New", monospace',
      theme: {
        background: '#1e1e1e',
        foreground: '#d4d4d4',
        cursor: '#d4d4d4',
        selectionBackground: '#264f78',
      },
      convertEol: true,
      scrollback: 1000,
    })

    // Add fit addon for responsive sizing
    if (!fitAddon.current) {
      fitAddon.current = new FitAddon()
    }
    terminal.current.loadAddon(fitAddon.current)

    // Add web links addon for clickable URLs
    if (!webLinksAddon.current) {
      // WebLinksAddon handler is optional, will use default browser behavior
      webLinksAddon.current = new WebLinksAddon((event, uri) => {
        window.open(uri, '_blank')
      })
    }
    terminal.current.loadAddon(webLinksAddon.current)

    // Open terminal
    terminal.current.open(terminalRef.current)
    fitAddon.current.fit()

    // Display welcome message
    terminal.current.writeln('\x1b[1;32m┌─ Ship Terminal\x1b[0m')
    terminal.current.writeln('\x1b[1;32m└─\x1b[0m Connecting to sandbox...\r\n')

    if (sandboxId) {
      setConnectionStatus('connected')
      terminal.current.writeln(`\x1b[1;36mSandbox ID:\x1b[0m ${sandboxId}`)
      terminal.current.writeln(
        '\x1b[33mNote:\x1b[0m Terminal output will be displayed here when agent runs commands.\r\n',
      )
    } else {
      setConnectionStatus('error')
      terminal.current.writeln('\x1b[1;31mError:\x1b[0m No sandbox available')
    }

    // Handle window resize
    const handleResize = () => {
      if (fitAddon.current && terminal.current) {
        fitAddon.current.fit()
      }
    }

    window.addEventListener('resize', handleResize)

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize)
      terminal.current?.dispose()
    }
  }, [isOpen, sandboxId])

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/20 z-40 transition-opacity"
        onClick={() => onOpenChange(false)}
      />

      {/* Drawer */}
      <div
        className={`
          fixed bottom-0 left-0 right-0 h-[400px] max-h-[60vh] z-50
          bg-white dark:bg-gray-900 shadow-2xl
          transform transition-transform duration-300 ease-in-out
          ${isOpen ? 'translate-y-0' : 'translate-y-full'}
        `}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-800 px-4 py-3">
          <div className="flex items-center gap-3">
            <h2 className="font-semibold text-lg dark:text-white">Terminal</h2>
            <span
              className={`
                text-xs px-2 py-1 rounded-full
                ${connectionStatus === 'connected' ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300' : ''}
                ${connectionStatus === 'connecting' ? 'bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300' : ''}
                ${connectionStatus === 'error' ? 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300' : ''}
              `}
            >
              {connectionStatus === 'connected' && '● Connected'}
              {connectionStatus === 'connecting' && '● Connecting'}
              {connectionStatus === 'error' && '● Error'}
            </span>
          </div>
          <button
            onClick={() => onOpenChange(false)}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors"
            aria-label="Close terminal drawer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Terminal container */}
        <div ref={terminalRef} className="h-[calc(100%-60px)] w-full p-2" />
      </div>
    </>
  )
}
