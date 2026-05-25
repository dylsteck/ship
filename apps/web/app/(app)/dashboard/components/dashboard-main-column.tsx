'use client'

import type { ChatSession } from '@/lib/api/server'
import type { WebSocketStatus } from '@/lib/websocket'
import type { UIMessage } from '@/lib/ai-elements-adapter'
import type { ModelInfo } from '@/lib/api/types'
import type { ComposerContextValue } from './composer/composer-context'
import type { SessionPanelData, TodoItem, RightSidebarTab } from '../types'
import { DashboardHeader } from './dashboard-header'
import { RightSidebar } from './right-sidebar'
import {
  DashboardMobileContent,
  DashboardDesktopContent,
  type DashboardMessagesPropsBundle,
} from './dashboard-main-column-content'

export interface DashboardMainColumnProps {
  isMobile: boolean
  user: import('@/lib/api/types').User
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
    openMobilePanel: (tab?: RightSidebarTab) => void
    activeTab: RightSidebarTab
    setActiveTab: (tab: RightSidebarTab) => void
    expanded: boolean
    toggleExpanded: () => void
  }
  rightSidebarData: SessionPanelData | null
  models: ModelInfo[]
  agentLabel?: string
  streamingSessionIds?: Set<string>
}

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
  models,
  agentLabel = 'Ship',
  streamingSessionIds,
}: DashboardMainColumnProps) {
  const { activeSessionId, displayTitle, wsStatus, sandboxStatus } = header

  const messagesProps: DashboardMessagesPropsBundle = {
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
          wsStatus={wsStatus}
          sandboxStatus={sandboxStatus ?? undefined}
          rightSidebarOpen={
            rightSidebar.isMobile ? rightSidebar.mobileOpen : rightSidebar.desktopOpen
          }
          onToggleRightSidebar={rightSidebar.toggle}
          onDeleteSession={sessions.onDeleteSession}
          user={user}
        />

        <div className="flex-1 flex flex-col relative z-10 overflow-hidden">
          <div className="md:hidden flex-1 flex flex-col overflow-hidden">
            <DashboardMobileContent
              activeSessionId={activeSessionId}
              messagesProps={messagesProps}
              composerContext={composer.context}
              sessions={sessions}
              serverTimestamp={serverTimestamp}
              isMobile={isMobile ?? false}
              fileDiffs={rightSidebarData?.fileDiffs}
              onOpenContextPanel={
                rightSidebarData
                  ? () => rightSidebar.openMobilePanel('git')
                  : undefined
              }
            />
          </div>

          <div className="hidden md:flex flex-col h-full">
            <DashboardDesktopContent
              activeSessionId={activeSessionId}
              messagesProps={messagesProps}
              composerContext={composer.context}
              sessions={sessions}
              models={models}
              agentLabel={agentLabel}
              serverTimestamp={serverTimestamp}
              streamingSessionIds={streamingSessionIds}
            />
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
          onDeleteSession={sessions.onDeleteSession}
        />
      )}
    </div>
  )
}
