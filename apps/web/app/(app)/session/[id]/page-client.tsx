'use client'

import { useState, useEffect, useRef } from 'react'
import { ChatInterface } from '@/components/chat/chat-interface'
import { SessionPanel } from '@/components/session/session-panel'
import { AgentStatus } from '@/components/session/status-indicator'
import { SandboxToolbar } from '@/components/sandbox/sandbox-toolbar'
import { VSCodeDrawer } from '@/components/sandbox/vscode-drawer'
import { TerminalDrawer } from '@/components/sandbox/terminal-drawer'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { AppSidebar } from '@/components/app-sidebar'
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@ship/ui'
import type { ChatSession, User } from '@/lib/api'
import { DashboardBackground } from '@/components/dashboard-background'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8787'

interface SessionPageClientProps {
  sessionId: string
  userId: string
  user: User
  sessions: ChatSession[]
}

// Hook to manage sessions locally with optimistic updates
function useLocalSessions(initialSessions: ChatSession[]) {
  const [sessions, setSessions] = useState(initialSessions)

  const removeSession = (sessionId: string) => {
    setSessions((prev) => prev.filter((s) => s.id !== sessionId))
  }

  return { sessions, removeSession }
}

export function SessionPageClient({ sessionId, userId, user, sessions: initialSessions }: SessionPageClientProps) {
  const searchParams = useSearchParams()
  const [initialPrompt, setInitialPrompt] = useState<string | null>(null)
  const [initialMode, setInitialMode] = useState<'build' | 'plan'>('build')
  const [searchQuery, setSearchQuery] = useState('')
  const [agentStatus, setAgentStatus] = useState<AgentStatus>('idle')
  const [currentTool, setCurrentTool] = useState<string>()

  // Local session state for optimistic updates on delete
  const { sessions, removeSession } = useLocalSessions(initialSessions)
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

  // Ref to track current sandbox status (avoids stale closure in interval)
  const sandboxStatusRef = useRef(sandboxStatus)
  useEffect(() => {
    sandboxStatusRef.current = sandboxStatus
  }, [sandboxStatus])

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

    function normalizeSandboxStatus(
      status: string | null | undefined,
    ): 'provisioning' | 'ready' | 'error' | 'none' {
      switch (status) {
        case 'active':
          return 'ready'
        case 'paused':
        case 'terminated':
          return 'none'
        case 'error':
        case 'provisioning':
        case 'ready':
        case 'none':
          return status
        default:
          return 'none'
      }
    }

    async function loadSandbox() {
      try {
        const res = await fetch(`${API_URL}/sessions/${sessionId}/sandbox`)
        if (res.ok) {
          const data = await res.json()
          setSandboxId(data.sandboxId || null)
          setSandboxStatus(normalizeSandboxStatus(data.status))
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

    // Poll sandbox status every 2 seconds while provisioning (for faster feedback)
    // Use ref to avoid stale closure - the ref always has the current value
    const interval = setInterval(() => {
      if (sandboxStatusRef.current === 'provisioning') {
        loadSandbox()
      }
    }, 2000)

    return () => clearInterval(interval)
  }, [sessionId]) // Removed sandboxStatus from deps - using ref instead

  // Pull initial prompt from sessionStorage (set on dashboard create)
  useEffect(() => {
    if (!sessionId) return
    try {
      const stored = sessionStorage.getItem(`pendingPrompt:${sessionId}`)
      if (!stored) return
      const parsed = JSON.parse(stored) as { content?: string; mode?: 'build' | 'agent' | 'plan' }
      if (parsed.content) {
        setInitialPrompt(parsed.content)
        setInitialMode(parsed.mode === 'agent' ? 'plan' : parsed.mode || 'build')
      }
      sessionStorage.removeItem(`pendingPrompt:${sessionId}`)
    } catch {
      // Ignore parse errors
    }
  }, [sessionId])

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
    <SidebarProvider defaultOpen={true}>
      <AppSidebar
        sessions={sessions}
        user={user}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        currentSessionId={sessionId}
        onSessionDeleted={removeSession}
      />
      <SidebarInset>
        <div className="flex h-screen flex-col relative">
          <DashboardBackground />
          {/* Header */}
          <header className="flex items-center justify-between border-b bg-background/80 px-4 py-3 relative z-10">
            <div className="flex items-center gap-3">
              <SidebarTrigger className="cursor-pointer" />
              <Link href="/" className="text-muted-foreground hover:text-foreground">
                ← Back
              </Link>
              <div>
                <h1 className="font-semibold text-foreground">
                  {sessionInfo.repoOwner && sessionInfo.repoName
                    ? `${sessionInfo.repoOwner}/${sessionInfo.repoName}`
                    : 'Session'}
                </h1>
                {sessionInfo.model && (
                  <p className="text-xs text-muted-foreground">
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
          <div className="flex flex-1 overflow-hidden bg-background/70 relative z-10">
            {/* Chat Interface */}
            <div className="flex-1 overflow-hidden">
              {sandboxStatus === 'provisioning' && (
                <div className="flex h-full items-center justify-center">
                  <div className="text-center">
                    <div className="mb-4 text-lg font-medium text-foreground">
                      Provisioning sandbox...
                    </div>
                    <div className="text-sm text-muted-foreground">
                      This usually takes 10-15 seconds
                    </div>
                  </div>
                </div>
              )}
              {sandboxStatus === 'error' && (
                <div className="flex h-full items-center justify-center">
                  <div className="text-center">
                    <div className="mb-4 text-lg font-medium text-destructive">
                      Failed to provision sandbox
                    </div>
                    <div className="text-sm text-muted-foreground">
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
                  initialPrompt={initialPrompt ?? searchParams.get('prompt')}
                  initialMode={(() => {
                    const modeParam = searchParams.get('mode')
                    if (modeParam === 'agent') return 'plan'
                    if (modeParam === 'plan' || modeParam === 'build') return modeParam
                    return initialMode
                  })()}
                  agentStatus={agentStatus}
                  currentTool={currentTool}
                />
              )}
            </div>

            {/* Side Panel */}
            <SessionPanel
              sessionId={sessionId}
              sessionInfo={sessionInfo}
              agentStatus={agentStatus}
              currentTool={currentTool}
              sandboxId={sandboxId}
              sandboxStatus={sandboxStatus}
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
      </SidebarInset>
    </SidebarProvider>
  )
}
