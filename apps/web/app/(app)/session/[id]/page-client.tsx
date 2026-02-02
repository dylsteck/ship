'use client'

import { useState, useEffect } from 'react'
import { ChatInterface } from '@/components/chat/chat-interface'
import { SessionPanel } from '@/components/session/session-panel'
import { AgentStatus } from '@/components/session/status-indicator'
import { SandboxToolbar } from '@/components/sandbox/sandbox-toolbar'
import { VSCodeDrawer } from '@/components/sandbox/vscode-drawer'
import { TerminalDrawer } from '@/components/sandbox/terminal-drawer'
import Link from 'next/link'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8787'

interface SessionPageClientProps {
  sessionId: string
}

export function SessionPageClient({ sessionId }: SessionPageClientProps) {
  const [agentStatus, setAgentStatus] = useState<AgentStatus>('idle')
  const [currentTool, setCurrentTool] = useState<string>()
  const [sessionInfo, setSessionInfo] = useState({
    repoOwner: '',
    repoName: '',
    branch: undefined as string | undefined,
    model: undefined as string | undefined,
  })

  // Sandbox state
  const [sandboxId, setSandboxId] = useState<string | null>(null)
  const [sandboxStatus, setSandboxStatus] = useState<'provisioning' | 'ready' | 'error' | 'none'>('none')
  const [vscodeOpen, setVscodeOpen] = useState(false)
  const [terminalOpen, setTerminalOpen] = useState(false)

  // WebSocket connection state
  const [wsConnected, setWsConnected] = useState(false)

  // Fetch session info and sandbox status
  useEffect(() => {
    async function loadSession() {
      try {
        const res = await fetch(`${API_URL}/sessions/${sessionId}`)
        if (res.ok) {
          const data = await res.json()
          setSessionInfo({
            repoOwner: data.repoOwner,
            repoName: data.repoName,
            branch: data.branch,
            model: data.model, // Selected model for display
          })
        }
      } catch (err) {
        console.error('Failed to load session:', err)
      }
    }

    async function loadSandbox() {
      try {
        const res = await fetch(`${API_URL}/sessions/${sessionId}/sandbox`)
        if (res.ok) {
          const data = await res.json()
          setSandboxId(data.sandboxId || null)
          setSandboxStatus(data.status || 'none')
        } else if (res.status === 404) {
          // No sandbox yet - this is normal for new sessions
          setSandboxStatus('none')
        }
      } catch (err) {
        console.error('Failed to load sandbox:', err)
        setSandboxStatus('error')
      }
    }

    loadSession()
    loadSandbox()

    // Poll sandbox status every 5 seconds while provisioning
    const interval = setInterval(() => {
      if (sandboxStatus === 'provisioning') {
        loadSandbox()
      }
    }, 5000)

    return () => clearInterval(interval)
  }, [sessionId, sandboxStatus])

  // WebSocket connection for real-time updates
  useEffect(() => {
    const ws = new WebSocket(`${API_URL.replace('http', 'ws')}/sessions/${sessionId}/websocket`)

    ws.onopen = () => {
      setWsConnected(true)
    }

    ws.onclose = () => {
      setWsConnected(false)
      // Auto-reconnect after 3 seconds
      setTimeout(() => {
        // Will trigger useEffect again
      }, 3000)
    }

    ws.onerror = () => {
      setWsConnected(false)
    }

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)

        // Handle agent status updates
        if (data.type === 'agent-status') {
          setAgentStatus(data.status as AgentStatus)
          setCurrentTool(data.details)
        }
      } catch (err) {
        console.error('WebSocket message error:', err)
      }
    }

    return () => {
      ws.close()
    }
  }, [sessionId])

  const handleStatusChange = (status: AgentStatus, tool?: string) => {
    setAgentStatus(status)
    setCurrentTool(tool)
  }

  const handleRetryOperation = async () => {
    try {
      await fetch(`${API_URL}/chat/${sessionId}/retry`, {
        method: 'POST',
      })
    } catch (err) {
      console.error('Failed to retry operation:', err)
    }
  }

  const handleOpenVSCode = () => {
    if (sandboxId && sandboxStatus === 'ready') {
      setVscodeOpen(true)
    }
  }

  const handleOpenTerminal = () => {
    if (sandboxId && sandboxStatus === 'ready') {
      setTerminalOpen(true)
    }
  }

  return (
    <div className="flex h-screen flex-col">
      {/* Header */}
      <header className="flex items-center justify-between border-b bg-white px-4 py-3 dark:border-gray-800 dark:bg-gray-900">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard"
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
          >
            ← Back
          </Link>
          <div>
            <h1 className="font-semibold dark:text-white">
              {sessionInfo.repoOwner && sessionInfo.repoName
                ? `${sessionInfo.repoOwner}/${sessionInfo.repoName}`
                : 'Session'}
            </h1>
            {sessionInfo.model && (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Model: {sessionInfo.model}
              </p>
            )}
          </div>
        </div>

        {/* Sandbox Toolbar */}
        <SandboxToolbar
          sandboxId={sandboxId}
          sandboxStatus={sandboxStatus}
          onOpenVSCode={() => setVscodeOpen(true)}
          onOpenTerminal={() => setTerminalOpen(true)}
        />
      </header>

      {/* Main content: Chat + Side Panel */}
      <div className="flex flex-1 overflow-hidden">
        {/* Chat Interface */}
        <div className="flex-1 overflow-hidden">
          {sandboxStatus === 'provisioning' && (
            <div className="flex h-full items-center justify-center">
              <div className="text-center">
                <div className="mb-4 text-lg font-medium dark:text-white">
                  Provisioning sandbox...
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  This usually takes 10-15 seconds
                </div>
              </div>
            </div>
          )}
          {sandboxStatus === 'error' && (
            <div className="flex h-full items-center justify-center">
              <div className="text-center">
                <div className="mb-4 text-lg font-medium text-red-600 dark:text-red-400">
                  Failed to provision sandbox
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  Please refresh the page to try again
                </div>
              </div>
            </div>
          )}
          {(sandboxStatus === 'ready' || sandboxStatus === 'none') && (
            <ChatInterface
              sessionId={sessionId}
              onStatusChange={handleStatusChange}
              onOpenVSCode={handleOpenVSCode}
              onOpenTerminal={handleOpenTerminal}
            />
          )}
        </div>

        {/* Side Panel */}
        <SessionPanel
          sessionId={sessionId}
          sessionInfo={sessionInfo}
          agentStatus={agentStatus}
          currentTool={currentTool}
        />
      </div>

      {/* Sandbox Drawers */}
      <VSCodeDrawer
        sandboxId={sandboxId}
        isOpen={vscodeOpen}
        onOpenChange={setVscodeOpen}
      />
      <TerminalDrawer
        sandboxId={sandboxId}
        isOpen={terminalOpen}
        onOpenChange={setTerminalOpen}
      />
    </div>
  )
}
