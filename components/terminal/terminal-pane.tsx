'use client'

import { useEffect, useRef, useState } from 'react'
import { Terminal } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import 'xterm/css/xterm.css'
import { Button } from '@/components/ui/button'
import { Trash2, Download, Copy, Maximize2, Minimize2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface TerminalPaneProps {
  logs?: string[]
  onCommand?: (command: string) => void
  className?: string
  title?: string
}

export function TerminalPane({ logs = [], onCommand, className, title = 'Logs' }: TerminalPaneProps) {
  const terminalRef = useRef<HTMLDivElement>(null)
  const xtermRef = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const [isExpanded, setIsExpanded] = useState(false)
  const [isInitialized, setIsInitialized] = useState(false)

  useEffect(() => {
    if (!terminalRef.current || isInitialized) return

    const terminal = new Terminal({
      theme: {
        background: '#0a0a0a',
        foreground: '#fafafa',
        cursor: '#fafafa',
        cursorAccent: '#0a0a0a',
        selectionBackground: '#3b3b3b',
        black: '#0a0a0a',
        red: '#ef4444',
        green: '#22c55e',
        yellow: '#eab308',
        blue: '#3b82f6',
        magenta: '#a855f7',
        cyan: '#06b6d4',
        white: '#fafafa',
        brightBlack: '#6b7280',
        brightRed: '#f87171',
        brightGreen: '#4ade80',
        brightYellow: '#facc15',
        brightBlue: '#60a5fa',
        brightMagenta: '#c084fc',
        brightCyan: '#22d3ee',
        brightWhite: '#ffffff',
      },
      fontFamily: 'var(--font-geist-mono), Menlo, Monaco, "Courier New", monospace',
      fontSize: 13,
      lineHeight: 1.4,
      cursorBlink: true,
      cursorStyle: 'block',
      scrollback: 10000,
      convertEol: true,
    })

    const fitAddon = new FitAddon()
    terminal.loadAddon(fitAddon)
    terminal.open(terminalRef.current)

    // Fit after a small delay to ensure proper sizing
    setTimeout(() => {
      fitAddon.fit()
    }, 100)

    xtermRef.current = terminal
    fitAddonRef.current = fitAddon
    setIsInitialized(true)

    // Handle resize
    const handleResize = () => {
      fitAddon.fit()
    }
    window.addEventListener('resize', handleResize)

    // Handle user input
    if (onCommand) {
      let currentLine = ''
      terminal.onKey(({ key, domEvent }) => {
        if (domEvent.key === 'Enter') {
          terminal.write('\r\n')
          if (currentLine.trim()) {
            onCommand(currentLine.trim())
          }
          currentLine = ''
        } else if (domEvent.key === 'Backspace') {
          if (currentLine.length > 0) {
            currentLine = currentLine.slice(0, -1)
            terminal.write('\b \b')
          }
        } else if (key.length === 1 && !domEvent.ctrlKey && !domEvent.altKey) {
          currentLine += key
          terminal.write(key)
        }
      })
    }

    return () => {
      window.removeEventListener('resize', handleResize)
      terminal.dispose()
    }
  }, [onCommand, isInitialized])

  // Write logs to terminal
  useEffect(() => {
    if (!xtermRef.current || !isInitialized) return

    // Clear and write all logs
    xtermRef.current.clear()
    for (const log of logs) {
      xtermRef.current.writeln(log)
    }
  }, [logs, isInitialized])

  // Re-fit when expanded state changes
  useEffect(() => {
    if (fitAddonRef.current && isInitialized) {
      setTimeout(() => {
        fitAddonRef.current?.fit()
      }, 100)
    }
  }, [isExpanded, isInitialized])

  const handleClear = () => {
    xtermRef.current?.clear()
  }

  const handleCopy = async () => {
    const text = logs.join('\n')
    await navigator.clipboard.writeText(text)
    toast.success('Copied to clipboard')
  }

  const handleDownload = () => {
    const text = logs.join('\n')
    const blob = new Blob([text], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'logs.txt'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className={cn('flex flex-col bg-[#0a0a0a] rounded-lg border', isExpanded && 'fixed inset-4 z-50', className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800">
        <span className="text-sm font-medium text-zinc-300">{title}</span>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7 text-zinc-400 hover:text-zinc-200" onClick={handleCopy}>
            <Copy className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-zinc-400 hover:text-zinc-200" onClick={handleDownload}>
            <Download className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-zinc-400 hover:text-zinc-200" onClick={handleClear}>
            <Trash2 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-zinc-400 hover:text-zinc-200"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {/* Terminal */}
      <div ref={terminalRef} className="flex-1 min-h-0 p-2" />
    </div>
  )
}
