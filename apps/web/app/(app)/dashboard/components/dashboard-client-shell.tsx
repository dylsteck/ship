'use client'

import { postSessionSync } from '@/lib/session-sync-channel'
import type { User } from '@/lib/api/types'
import type { useDashboardChat } from '../hooks/use-dashboard-chat'
import type { useDashboardState } from '../hooks/use-dashboard-state'
import type { useDashboardDerived } from '../hooks/use-dashboard-derived'
import type { useRightSidebar } from '../hooks/use-right-sidebar'
import type { SessionPanelData } from '../types'
import { DashboardLayout } from './dashboard-layout'
import { DashboardMainColumn } from './dashboard-main-column'

interface DashboardClientShellProps {
  user: User
  serverTimestamp: number
  isMobile: boolean
  chat: ReturnType<typeof useDashboardChat>
  state: ReturnType<typeof useDashboardState>
  derived: ReturnType<typeof useDashboardDerived>
  streamingSessionIds: Set<string>
  rightSidebar: ReturnType<typeof useRightSidebar>
  rightSidebarData: SessionPanelData | null
  mutateSessions: () => void
  models: Array<{ id: string; name: string; provider: string }>
  promptHandlers: {
    handlePermissionReply: (permissionId: string, approved: boolean) => Promise<void>
    handleQuestionReply: (questionId: string, response: string) => Promise<void>
    handleQuestionSkip: (questionId: string) => Promise<void>
  }
  handleRetryLastMessage: () => void
}

export function DashboardClientShell({
  user,
  serverTimestamp,
  isMobile,
  chat,
  state,
  derived,
  streamingSessionIds,
  rightSidebar,
  rightSidebarData,
  mutateSessions,
  models,
  promptHandlers,
  handleRetryLastMessage,
}: DashboardClientShellProps) {
  return (
    <DashboardLayout
      defaultOpen={false}
      sidebarProps={{
        sessions: chat.localSessions,
        user,
        searchQuery: state.searchQuery,
        onSearchChange: state.setSearchQuery,
        currentSessionId: chat.activeSessionId ?? undefined,
        currentSessionTitle: derived.displayTitle,
        onSessionDeleted: (id) => {
          chat.setLocalSessions((prev) => prev.filter((s) => s.id !== id))
          mutateSessions()
          postSessionSync({ type: 'session-deleted' })
        },
        onSessionDeleteFailed: (session) => {
          chat.setLocalSessions((prev) => {
            if (prev.some((s) => s.id === session.id)) return prev
            return [...prev, session].sort((a, b) => (b.lastActivity ?? 0) - (a.lastActivity ?? 0))
          })
        },
        onNewChat: () => {
          chat.setActiveSessionId(null)
          chat.setMessages([])
        },
        isStreaming: chat.isStreaming,
        streamingSessionIds,
      }}
    >
      <DashboardMainColumn
        isMobile={isMobile}
        user={user}
        serverTimestamp={serverTimestamp}
        header={{
          activeSessionId: chat.activeSessionId,
          displayTitle: derived.displayTitle,
          displayRepoLabel: derived.displayRepoLabel,
          wsStatus: chat.wsStatus,
          sandboxStatus: chat.sandboxStatus,
        }}
        messages={{
          messages: chat.messages,
          isStreaming: chat.isStreaming,
          streamingMessageId: chat.streamingMessageRef.current,
          streamStartTime: chat.streamStartTime,
          streamingStatus: chat.streamingStatus,
          streamingStatusSteps: chat.streamingStatusSteps,
          sessionTodos: chat.sessionTodos,
          onPermissionReply: promptHandlers.handlePermissionReply,
          onQuestionReply: promptHandlers.handleQuestionReply,
          onQuestionSkip: promptHandlers.handleQuestionSkip,
          onRetry: handleRetryLastMessage,
        }}
        sessions={{
          localSessions: chat.localSessions,
          onSessionClick: state.handleSessionClick,
          onDeleteSession: state.handleDeleteSession,
        }}
        composer={{ context: derived.composerContext }}
        rightSidebar={rightSidebar}
        rightSidebarData={rightSidebarData}
        models={models}
        agentLabel={state.selectedAgent?.name ?? 'Ship'}
        streamingSessionIds={streamingSessionIds}
      />
    </DashboardLayout>
  )
}
