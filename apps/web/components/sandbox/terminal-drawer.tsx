'use client'

import React, { useEffect, useRef, useState } from 'react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import '@xterm/xterm/css/xterm.css'

interface TerminalDrawerProps {
  sandboxId: string | null
  isOpen: boolean
  onOpenChange: (open: boolean) => void
}

export function TerminalDrawer({ sandboxId, isOpen, onOpenChange }: TerminalDrawerProps) {
  const terminalRef = useRef<HTMLDivElement>(null)
  const xtermRef = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'error'>('connecting')

  useEffect(() => {
    if (!isOpen || !terminalRef.current || !sandboxId) return

    // Initialize terminal
    const terminal = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      theme: {
        background: '#1e1e1e',
        foreground: '#d4d4d4',
      },
    })

    const fitAddon = new FitAddon()
    const webLinksAddon = new WebLinksAddon()

    terminal.loadAddon(fitAddon)
    terminal.loadAddon(webLinksAddon)

    terminal.open(terminalRef.current)
    fitAddon.fit()

    xtermRef.current = terminal
    fitAddonRef.current = fitAddon

    // Simulate connection (placeholder for actual WebSocket connection)
    terminal.writeln('Connecting to sandbox terminal...')
    
    setTimeout(() => {
      setConnectionStatus('connected')
      terminal.writeln('\x1b[32m✓\x1b[0m Connected to sandbox')
      terminal.writeln('')
      terminal.write('$ ')
    }, 1000)

    // Handle resize
    const handleResize = () => {
      fitAddon.fit()
    }

    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      terminal.dispose()
    }
  }, [isOpen, sandboxId])

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[400px] p-0">
        <SheetHeader className="border-b px-4 py-2">
          <div className="flex items-center justify-between">
            <SheetTitle>Terminal</SheetTitle>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {connectionStatus === 'connecting' && 'Connecting...'}
                {connectionStatus === 'connected' && (
                  <>
                    <span className="inline-block w-2 h-2 bg-green-500 rounded-full mr-1"></span>
                    Connected
                  </>
                )}
                {connectionStatus === 'error' && (
                  <>
                    <span className="inline-block w-2 h-2 bg-red-500 rounded-full mr-1"></span>
                    Connection error
                  </>
                )}
              </span>
            </div>
          </div>
        </SheetHeader>

        <div
          ref={terminalRef}
          className="h-[calc(100%-53px)] p-2"
          style={{ overflow: 'hidden' }}
        />
      </SheetContent>
    </Sheet>
  )
}
