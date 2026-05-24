'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { AppSidebar } from '@/components/app-sidebar'
import { SidebarInset, SidebarProvider } from '@ship/ui'
import type { ChatSession } from '@/lib/api/server'
import type { User } from '@/lib/api/types'
import type { AgentStatus } from '@/components/session/status-indicator'
import { useLocalSessions } from './use-local-sessions'
import { useSessionSandbox } from './use-session-sandbox'
import { useSessionWebSocket } from './use-session-websocket'
import { SessionPageHeader } from './session-page-header'
import { SessionPageMain } from './session-page-main'

interface SessionPageClientProps {
  sessionId: string
  userId: string
  user: User
  sessions: ChatSession[]
}

export function SessionPageClient({ sessionId, user, sessions: initialSessions }: SessionPageClientProps) {
  const searchParams = useSearchParams()
  const [initialPrompt, setInitialPrompt] = useState<string | null>(null)
  const [initialMode, setInitialMode] = useState<string>('build')
  const [searchQuery, setSearchQuery] = useState('')
  const [agentStatus, setAgentStatus] = useState<AgentStatus>('idle')
  const [currentTool, setCurrentTool] = useState<string>()
  const [sessionTitle, setSessionTitle] = useState<string | undefined>()
  const [rightSidebarOpen, setRightSidebarOpen] = useState(true)

  const { sessions, removeSession } = useLocalSessions(initialSessions, sessionId)
  const sandbox = useSessionSandbox(sessionId)

  useSessionWebSocket(
    sessionId,
    sandbox.sandboxStatusRef,
    setAgentStatus,
    setCurrentTool,
    sandbox.setSandboxId,
    sandbox.setSandboxStatus,
    sandbox.setSandboxProgress,
    sandbox.setOpencodeUrl,
    sandbox.setOpencodeSessionId,
    setSessionTitle,
    sandbox.setWsConnected,
  )

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

  const handleStatusChange = useCallback((status: AgentStatus, tool?: string) => {
    setAgentStatus(status)
    setCurrentTool(tool)
  }, [])

  return (
    <SidebarProvider defaultOpen={true}>
      <AppSidebar
        sessions={sessions}
        user={user}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        currentSessionId={sessionId}
        currentSessionTitle={sessionTitle}
        onSessionDeleted={removeSession}
      />
      <SidebarInset>
        <div className="flex h-screen flex-col relative bg-white dark:bg-background">
          <SessionPageHeader
            agentStatus={agentStatus}
            sessionTitle={sessionTitle}
            branch={sandbox.sessionInfo.branch}
            rightSidebarOpen={rightSidebarOpen}
            onToggleSidebar={() => setRightSidebarOpen((v) => !v)}
          />
          <SessionPageMain
            sessionId={sessionId}
            sandboxStatus={sandbox.sandboxStatus}
            sandboxProgress={sandbox.sandboxProgress}
            rightSidebarOpen={rightSidebarOpen}
            setRightSidebarOpen={setRightSidebarOpen}
            sessionInfo={sandbox.sessionInfo}
            agentStatus={agentStatus}
            currentTool={currentTool}
            sandboxId={sandbox.sandboxId}
            opencodeUrl={sandbox.opencodeUrl}
            opencodeSessionId={sandbox.opencodeSessionId}
            sessionTitle={sessionTitle}
            initialPrompt={initialPrompt}
            initialMode={initialMode}
            searchPrompt={searchParams.get('prompt')}
            searchMode={searchParams.get('mode')}
            onStatusChange={handleStatusChange}
            onOpenCodeUrl={sandbox.setOpencodeUrl}
          />
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
