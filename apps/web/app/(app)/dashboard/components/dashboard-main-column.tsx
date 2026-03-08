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

export interface DashboardMainColumnProps {
  isMobile: boolean
  user: import('@/lib/api/types').User
  header: {
    activeSessionId: string | null
    displayTitle?: string
    wsStatus: WebSocketStatus
    sandboxStatus: string | null
  }
  messages: {
    messages: UIMessage[]
    isStreaming: boolean
    streamingMessageId: string | null
    streamStartTime: number | null
    streamingStatus: string | null
    streamingStatusSteps: string[]
    sessionTodos: TodoItem[]
    onPermissionReply: (permissionId: string, approved: boolean) => Promise<void>
  }
  sessions: {
    localSessions: ChatSession[]
    onSessionClick: (session: ChatSession) => void
    onDeleteSession: (sessionId: string) => Promise<void>
  }
  composer: {
    context: ComposerContextValue
  }
  rightSidebar: {
    desktopOpen: boolean
    mobileOpen: boolean
    isMobile: boolean | null
    toggle: () => void
    setMobileOpen: (open: boolean) => void
  }
  rightSidebarData: SessionPanelData | null
}

/**
 * Main column: header + mobile/desktop content switching.
 * Composes MobileSessionList, DashboardMessages, DashboardComposer.
 */
export function DashboardMainColumn({
  isMobile,
  user,
  header,
  messages: messagesCtx,
  sessions,
  composer,
  rightSidebar,
  rightSidebarData,
}: DashboardMainColumnProps) {
  const { activeSessionId, displayTitle, wsStatus, sandboxStatus } = header
  const messagesProps = {
    activeSessionId,
    messages: messagesCtx.messages,
    isStreaming: messagesCtx.isStreaming,
    streamingMessageId: messagesCtx.streamingMessageId,
    streamStartTime: messagesCtx.streamStartTime,
    streamingStatus: messagesCtx.streamingStatus ?? undefined,
    streamingStatusSteps: messagesCtx.streamingStatusSteps,
    sessionTodos: messagesCtx.sessionTodos,
    onPermissionReply: messagesCtx.onPermissionReply,
  }

  return (
    <div className="flex h-dvh relative overflow-hidden">
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
                    context={composer.context}
                    compactLayout={true}
                  />
                </div>
                <MobileSessionList
                  sessions={sessions.localSessions}
                  isMobile={isMobile ?? false}
                  onSessionClick={sessions.onSessionClick}
                  onDeleteSession={sessions.onDeleteSession}
                />
              </>
            )}
            {activeSessionId && (
              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="flex-1 overflow-hidden">
                  <DashboardMessages {...messagesProps} />
                </div>
                <DashboardComposer
                  context={composer.context}
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
            <DashboardComposer context={composer.context} />
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
