'use client'

import { ChatInterface } from '@/components/chat/chat-interface'
import { SessionSidebar } from '@/components/chat/session-sidebar'
import type { AgentStatus } from '@/components/session/status-indicator'

interface SessionPageMainProps {
  sessionId: string
  sandboxStatus: 'provisioning' | 'ready' | 'error' | 'none'
  sandboxProgress: string | null
  rightSidebarOpen: boolean
  setRightSidebarOpen: (fn: (v: boolean) => boolean) => void
  sessionInfo: { repoOwner: string; repoName: string; branch?: string; model?: string }
  agentStatus: AgentStatus
  currentTool?: string
  sandboxId: string | null
  opencodeUrl: string | null
  opencodeSessionId: string | null
  sessionTitle?: string
  initialPrompt: string | null
  initialMode: string
  searchPrompt: string | null
  searchMode: string | null
  onStatusChange: (status: AgentStatus, tool?: string) => void
  onOpenCodeUrl: (url: string | null) => void
}

export function SessionPageMain({
  sessionId,
  sandboxStatus,
  sandboxProgress,
  rightSidebarOpen,
  sessionInfo,
  agentStatus,
  currentTool,
  sandboxId,
  opencodeUrl,
  opencodeSessionId,
  sessionTitle,
  initialPrompt,
  initialMode,
  searchPrompt,
  searchMode,
  onStatusChange,
  onOpenCodeUrl,
}: SessionPageMainProps) {
  const resolvedMode = (() => {
    if (searchMode === 'agent') return 'plan'
    if (searchMode === 'plan' || searchMode === 'build') return searchMode
    return initialMode
  })()

  return (
    <div className="flex flex-1 overflow-hidden bg-white dark:bg-background relative z-10">
      <div className="flex-1 overflow-hidden">
        {sandboxStatus === 'provisioning' && (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <div className="mb-4 text-lg font-medium text-foreground">Provisioning sandbox...</div>
              {sandboxProgress && <div className="mb-2 text-sm text-muted-foreground">{sandboxProgress}</div>}
              <div className="text-sm text-muted-foreground">This usually takes 10-15 seconds</div>
            </div>
          </div>
        )}
        {sandboxStatus === 'error' && (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <div className="mb-4 text-lg font-medium text-destructive">Failed to provision sandbox</div>
              <div className="text-sm text-muted-foreground">Please refresh the page to try again</div>
            </div>
          </div>
        )}
        {sandboxProgress && sandboxStatus !== 'provisioning' && (
          <div className="border-b bg-muted/50 px-4 py-2 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
              {sandboxProgress}
            </div>
          </div>
        )}
        {(sandboxStatus === 'ready' || sandboxStatus === 'none') && (
          <ChatInterface
            sessionId={sessionId}
            onStatusChange={onStatusChange}
            onOpenCodeUrl={onOpenCodeUrl}
            initialPrompt={initialPrompt ?? searchPrompt}
            initialMode={resolvedMode}
            agentStatus={agentStatus}
            currentTool={currentTool}
          />
        )}
      </div>
      {rightSidebarOpen && (
        <SessionSidebar
          sessionId={sessionId}
          sessionInfo={sessionInfo}
          agentStatus={agentStatus}
          currentTool={currentTool}
          sandboxId={sandboxId}
          sandboxStatus={sandboxStatus}
          opencodeUrl={opencodeUrl}
          opencodeSessionId={opencodeSessionId}
          sessionTitle={sessionTitle}
        />
      )}
    </div>
  )
}
