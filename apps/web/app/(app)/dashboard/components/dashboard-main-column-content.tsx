'use client'

import type { UIMessage } from '@/lib/ai-elements-adapter'
import type { ComposerContextValue } from './composer/composer-context'
import type { ChatSession } from '@/lib/api/server'
import type { TodoItem } from '../types'
import { DashboardMessages } from './dashboard-messages'
import { DashboardComposer } from './composer'
import { MobileSessionList } from './mobile-session-list'
import { HomepageSessionList } from './homepage-session-list'
import type { ModelInfo } from '@/lib/api/types'

export interface DashboardMessagesPropsBundle {
  activeSessionId: string | null
  messages: UIMessage[]
  isStreaming: boolean
  streamingMessageId: string | null
  streamStartTime: number | null
  streamingStatus?: string
  streamingStatusSteps: string[]
  sessionTodos: TodoItem[]
  onPermissionReply: (permissionId: string, approved: boolean) => Promise<void>
  onQuestionReply?: (questionId: string, response: string) => Promise<void>
  onQuestionSkip?: (questionId: string) => Promise<void>
  onRetry?: () => void
}

function ActiveSessionLayout({
  messagesProps,
  composerContext,
  compactComposer,
}: {
  messagesProps: DashboardMessagesPropsBundle
  composerContext: ComposerContextValue
  compactComposer?: boolean
}) {
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex-1 overflow-hidden">
        <DashboardMessages {...messagesProps} />
      </div>
      <DashboardComposer context={composerContext} compactLayout={compactComposer} />
    </div>
  )
}

export function DashboardMobileContent({
  activeSessionId,
  messagesProps,
  composerContext,
  sessions,
  serverTimestamp,
  isMobile,
}: {
  activeSessionId: string | null
  messagesProps: DashboardMessagesPropsBundle
  composerContext: ComposerContextValue
  sessions: {
    localSessions: ChatSession[]
    onSessionClick: (session: ChatSession) => void
    onDeleteSession: (sessionId: string) => Promise<void>
  }
  serverTimestamp: number
  isMobile: boolean
}) {
  if (!activeSessionId) {
    return (
      <>
        <div className="shrink-0">
          <DashboardComposer context={composerContext} compactLayout />
        </div>
        <MobileSessionList
          sessions={sessions.localSessions}
          isMobile={isMobile}
          activeSessionId={activeSessionId}
          isStreaming={messagesProps.isStreaming}
          onSessionClick={sessions.onSessionClick}
          onDeleteSession={sessions.onDeleteSession}
          serverTimestamp={serverTimestamp}
        />
      </>
    )
  }

  return (
    <ActiveSessionLayout
      messagesProps={messagesProps}
      composerContext={composerContext}
      compactComposer={false}
    />
  )
}

export function DashboardDesktopContent({
  activeSessionId,
  messagesProps,
  composerContext,
  sessions,
  models,
  agentLabel,
  serverTimestamp,
}: {
  activeSessionId: string | null
  messagesProps: DashboardMessagesPropsBundle
  composerContext: ComposerContextValue
  sessions: {
    localSessions: ChatSession[]
    onSessionClick: (session: ChatSession) => void
    onDeleteSession: (sessionId: string) => Promise<void>
  }
  models: ModelInfo[]
  agentLabel: string
  serverTimestamp: number
}) {
  if (activeSessionId) {
    return (
      <>
        <div className="flex-1 overflow-hidden">
          <DashboardMessages {...messagesProps} />
        </div>
        <DashboardComposer context={composerContext} />
      </>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <DashboardComposer context={composerContext} />
      <HomepageSessionList
        sessions={sessions.localSessions}
        activeSessionId={activeSessionId}
        isStreaming={messagesProps.isStreaming}
        streamingStatus={messagesProps.streamingStatus ?? ''}
        streamingStatusSteps={messagesProps.streamingStatusSteps}
        agentLabel={agentLabel}
        models={models}
        onSessionClick={sessions.onSessionClick}
        onDeleteSession={sessions.onDeleteSession}
        serverTimestamp={serverTimestamp}
      />
    </div>
  )
}
