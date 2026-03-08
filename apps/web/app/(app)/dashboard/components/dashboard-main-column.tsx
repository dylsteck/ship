'use client'

import { cn } from '@ship/ui'
import type { ChatSession } from '@/lib/api/server'
import type { WebSocketStatus } from '@/lib/websocket'
import type { UIMessage } from '@/lib/ai-elements-adapter'
import type { ComposerContextValue } from './composer/composer-context'
import type { SessionPanelData, TodoItem } from '../types'
import { DashboardHeader } from './dashboard-header'
import { DashboardMessages } from './dashboard-messages'
import { DashboardComposer } from './composer'
import { MobileSessionList } from './mobile-session-list'
import { RightSidebar } from './right-sidebar'

export interface DashboardMainColumnStats {
  sessionsPastWeek: number
  messagesPastWeek: number
  activeRepos: number
  sessionsChartData: number[]
  messagesChartData: number[]
  activeReposChartData: number[]
}

export interface DashboardMainColumnProps {
  isMobile: boolean
  activeSessionId: string | null
  displayTitle?: string
  wsStatus: WebSocketStatus
  sandboxStatus: string | null
  messages: UIMessage[]
  isStreaming: boolean
  streamingMessageId: string | null
  streamStartTime: number | null
  streamingStatus: string | null
  streamingStatusSteps: string[]
  sessionTodos: TodoItem[]
  localSessions: ChatSession[]
  composerContext: ComposerContextValue
  stats: DashboardMainColumnStats
  rightSidebar: {
    desktopOpen: boolean
    mobileOpen: boolean
    isMobile: boolean | null
    toggle: () => void
    setMobileOpen: (open: boolean) => void
  }
  rightSidebarData: SessionPanelData | null
  onPermissionReply: (permissionId: string, approved: boolean) => Promise<void>
  onSessionClick: (session: ChatSession) => void
  onDeleteSession: (sessionId: string) => Promise<void>
  user: import('@/lib/api/types').User
}

/**
 * Main column: header + mobile/desktop content switching.
 * Composes MobileSessionList, DashboardMessages, DashboardComposer.
 */
export function DashboardMainColumn({
  isMobile,
  activeSessionId,
  displayTitle,
  wsStatus,
  sandboxStatus,
  messages,
  isStreaming,
  streamingMessageId,
  streamStartTime,
  streamingStatus,
  streamingStatusSteps,
  sessionTodos,
  localSessions,
  composerContext,
  stats,
  rightSidebar,
  rightSidebarData,
  onPermissionReply,
  onSessionClick,
  onDeleteSession,
  user,
}: DashboardMainColumnProps) {
  const messagesProps = {
    activeSessionId,
    messages,
    isStreaming,
    streamingMessageId,
    streamStartTime,
    streamingStatus: streamingStatus ?? undefined,
    streamingStatusSteps,
    sessionTodos,
    onPermissionReply,
  }

  return (
    <div className="flex h-screen h-[100dvh] relative overflow-hidden">
      <div className="flex-1 flex flex-col min-w-0">
        <DashboardHeader
          activeSessionId={activeSessionId}
          sessionTitle={displayTitle}
          wsStatus={wsStatus}
          sandboxStatus={sandboxStatus ?? undefined}
          rightSidebarOpen={rightSidebar.desktopOpen}
          onToggleRightSidebar={rightSidebar.toggle}
          showBackButton={true}
          user={user}
        />

        <div className="flex-1 flex flex-col relative z-10 overflow-hidden">
          {/* Mobile */}
          <div className="md:hidden flex-1 flex flex-col overflow-hidden">
            {!activeSessionId && (
              <>
                <div className="shrink-0">
                  <DashboardComposer
                    context={composerContext}
                    stats={stats}
                    compactLayout={true}
                  />
                </div>
                <MobileSessionList
                  sessions={localSessions}
                  isMobile={isMobile ?? false}
                  onSessionClick={onSessionClick}
                  onDeleteSession={onDeleteSession}
                />
              </>
            )}
            {activeSessionId && (
              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="flex-1 overflow-hidden">
                  <DashboardMessages {...messagesProps} />
                </div>
                <DashboardComposer
                  context={composerContext}
                  stats={stats}
                  compactLayout={false}
                />
              </div>
            )}
          </div>

          {/* Desktop */}
          <div className="hidden md:flex flex-col h-full">
            <div
              className={cn(
                'flex-1 overflow-hidden',
                activeSessionId ? 'opacity-100' : 'opacity-0 h-0',
              )}
            >
              <DashboardMessages {...messagesProps} />
            </div>
            <DashboardComposer context={composerContext} stats={stats} />
          </div>
        </div>
      </div>

      {activeSessionId && rightSidebarData && (
        <RightSidebar
          data={rightSidebarData}
          desktopOpen={rightSidebar.desktopOpen}
          mobileOpen={rightSidebar.mobileOpen}
          isMobile={rightSidebar.isMobile ?? false}
          onMobileOpenChange={rightSidebar.setMobileOpen}
        />
      )}
    </div>
  )
}
