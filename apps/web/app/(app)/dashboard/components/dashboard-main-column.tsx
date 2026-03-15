'use client'

import type { ChatSession } from '@/lib/api/server'
import type { WebSocketStatus } from '@/lib/websocket'
import type { UIMessage } from '@/lib/ai-elements-adapter'
import type { ComposerContextValue } from './composer/composer-context'
import type { SessionPanelData, TodoItem, RightSidebarTab } from '../types'
import { DashboardHeader } from './dashboard-header'
import { DashboardMessages } from './dashboard-messages'
import { DashboardComposer } from './composer'
import { MobileSessionList } from './mobile-session-list'
import { HomepageSessionList } from './homepage-session-list'
import { RightSidebar } from './right-sidebar'

export interface DashboardMainColumnProps {
  isMobile: boolean
  user: import('@/lib/api/types').User
  /** Stable timestamp from server for SSR-safe time formatting */
  serverTimestamp?: number
  header: {
    activeSessionId: string | null
    displayTitle?: string
    displayRepoLabel?: string
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
    onQuestionReply?: (questionId: string, response: string) => Promise<void>
    onQuestionSkip?: (questionId: string) => Promise<void>
    onRetry?: () => void
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
    activeTab: RightSidebarTab
    setActiveTab: (tab: RightSidebarTab) => void
    expanded: boolean
    toggleExpanded: () => void
  }
  rightSidebarData: SessionPanelData | null
  /** When on homepage, optional agent label for session cards (e.g. "OpenCode") */
  agentLabel?: string
}

/**
 * Main column: header + mobile/desktop content switching.
 * Composes MobileSessionList, DashboardMessages, DashboardComposer.
 */
export function DashboardMainColumn({
  isMobile,
  user,
  serverTimestamp = Math.floor(Date.now() / 1000),
  header,
  messages: messagesCtx,
  sessions,
  composer,
  rightSidebar,
  rightSidebarData,
  agentLabel = 'Ship',
}: DashboardMainColumnProps) {
  const { activeSessionId, displayTitle, displayRepoLabel, wsStatus, sandboxStatus } = header
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
    onQuestionReply: messagesCtx.onQuestionReply,
    onQuestionSkip: messagesCtx.onQuestionSkip,
    onRetry: messagesCtx.onRetry,
  }

  return (
    <div className="flex h-dvh relative overflow-hidden">
      <div className="flex-1 flex flex-col min-w-0">
        <DashboardHeader
          activeSessionId={activeSessionId}
          sessionTitle={displayTitle}
          repoLabel={displayRepoLabel}
          wsStatus={wsStatus}
          sandboxStatus={sandboxStatus ?? undefined}
          rightSidebarOpen={rightSidebar.desktopOpen}
          onToggleRightSidebar={rightSidebar.toggle}
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
                  activeSessionId={activeSessionId}
                  isStreaming={messagesCtx.isStreaming}
                  onSessionClick={sessions.onSessionClick}
                  onDeleteSession={sessions.onDeleteSession}
                  serverTimestamp={serverTimestamp}
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
            {activeSessionId ? (
              <>
                <div className="flex-1 overflow-hidden">
                  <DashboardMessages {...messagesProps} />
                </div>
                <DashboardComposer context={composer.context} />
              </>
            ) : (
              <div className="flex-1 overflow-y-auto">
                <DashboardComposer context={composer.context} />
                <HomepageSessionList
                  sessions={sessions.localSessions}
                  activeSessionId={activeSessionId}
                  isStreaming={messagesCtx.isStreaming}
                  streamingStatus={messagesCtx.streamingStatus ?? ''}
                  streamingStatusSteps={messagesCtx.streamingStatusSteps}
                  agentLabel={agentLabel}
                  onSessionClick={sessions.onSessionClick}
                  onDeleteSession={sessions.onDeleteSession}
                  serverTimestamp={serverTimestamp}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {activeSessionId && rightSidebarData && (
        <RightSidebar
          data={rightSidebarData}
          desktopOpen={rightSidebar.desktopOpen}
          mobileOpen={rightSidebar.mobileOpen}
          isMobile={rightSidebar.isMobile ?? false}
          expanded={rightSidebar.expanded}
          activeTab={rightSidebar.activeTab}
          onTabChange={rightSidebar.setActiveTab}
          onToggleExpanded={rightSidebar.toggleExpanded}
          onMobileOpenChange={rightSidebar.setMobileOpen}
          onTogglePanel={rightSidebar.toggle}
        />
      )}
    </div>
  )
}
