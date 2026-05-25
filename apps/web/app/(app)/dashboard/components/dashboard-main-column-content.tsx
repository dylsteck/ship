'use client'

import type { UIMessage } from '@/lib/ai-elements-adapter'
import { ComposerProvider, type ComposerContextValue } from './composer/composer-context'
import type { ChatSession } from '@/lib/api/server'
import type { TodoItem } from '../types'
import { DashboardMessages } from './dashboard-messages'
import { DashboardComposer } from './composer'
import { DashboardComposerMobileFollowUp } from './composer/dashboard-composer-mobile'
import { DashboardMobileContextBar } from './dashboard-mobile-context-bar'
import { MobileSessionList } from './mobile-session-list'
import type { FileDiff } from '../types'
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
  mobileChatLayout,
  fileDiffs,
  onOpenContextPanel,
}: {
  messagesProps: DashboardMessagesPropsBundle
  composerContext: ComposerContextValue
  compactComposer?: boolean
  mobileChatLayout?: boolean
  fileDiffs?: FileDiff[]
  onOpenContextPanel?: () => void
}) {
  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background">
      {mobileChatLayout && onOpenContextPanel && (
        <DashboardMobileContextBar fileDiffs={fileDiffs ?? []} onOpenPanel={onOpenContextPanel} />
      )}
      <div className="min-h-0 flex-1 overflow-hidden">
        <DashboardMessages {...messagesProps} mobileChatLayout={mobileChatLayout} />
      </div>
      {mobileChatLayout ? (
        <DashboardComposerMobileFollowUp />
      ) : (
        <DashboardComposer context={composerContext} compactLayout={compactComposer} />
      )}
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
  fileDiffs,
  onOpenContextPanel,
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
  fileDiffs?: FileDiff[]
  onOpenContextPanel?: () => void
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
    <ComposerProvider value={composerContext}>
      <ActiveSessionLayout
        messagesProps={messagesProps}
        composerContext={composerContext}
        mobileChatLayout
        fileDiffs={fileDiffs}
        onOpenContextPanel={onOpenContextPanel}
      />
    </ComposerProvider>
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
  streamingSessionIds,
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
  streamingSessionIds?: Set<string>
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
        streamingSessionIds={streamingSessionIds}
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
