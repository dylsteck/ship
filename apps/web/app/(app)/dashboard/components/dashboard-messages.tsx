'use client'

import * as React from 'react'
import { Conversation, ConversationScrollButton } from '@ship/ui'
import type { UIMessage } from '@/lib/ai-elements-adapter'
import { SubagentView } from './subagent-view'
import type { TodoItem } from '../types'
import { MessageItem, MessagesEmptyState } from './messages'
import { groupConsecutiveAssistants } from './messages/group-consecutive-assistants'
import { AssistantRunBlock } from './assistant-run-block'
import {
  useSubagentStack,
  useMessageGroupMeta,
  getActiveStatusLabel,
} from './dashboard-messages-hooks'

interface DashboardMessagesProps {
  activeSessionId: string | null
  messages: UIMessage[]
  isStreaming: boolean
  streamingMessageId: string | null
  streamStartTime: number | null
  streamingStatus?: string
  streamingStatusSteps?: string[]
  sessionTodos?: TodoItem[]
  onPermissionReply?: (permissionId: string, approved: boolean) => Promise<void>
  onQuestionReply?: (questionId: string, response: string) => Promise<void>
  onQuestionSkip?: (questionId: string) => Promise<void>
  onRetry?: () => void
}

export function DashboardMessages({
  activeSessionId,
  messages,
  isStreaming,
  streamingMessageId,
  streamStartTime,
  streamingStatus = '',
  streamingStatusSteps = [],
  sessionTodos = [],
  onPermissionReply,
  onQuestionReply,
  onQuestionSkip,
  onRetry,
}: DashboardMessagesProps) {
  const todoRenderedRef = React.useRef(false)
  const messageGroups = React.useMemo(() => groupConsecutiveAssistants(messages), [messages])
  const { showSessionSetup, firstAssistantBlockIndex } = useMessageGroupMeta(
    messages,
    streamingMessageId,
    messageGroups,
  )
  const { resolvedSubagent, handleSubagentNavigate, handleSubagentBack } = useSubagentStack(messages)

  if (!activeSessionId) return null

  todoRenderedRef.current = false
  const statusLabel = getActiveStatusLabel(isStreaming, messages, streamingMessageId, streamingStatus)
  const hasContent = messages.some((m) => m.content || m.toolInvocations?.length)
  const activeStreamingMessageId = isStreaming ? streamingMessageId : null

  if (resolvedSubagent) {
    return <SubagentView subagent={resolvedSubagent} onBack={handleSubagentBack} parentSessionId={activeSessionId} />
  }

  return (
    <Conversation className="h-full">
      <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-8 sm:py-8">
        {!hasContent && !isStreaming && <MessagesEmptyState />}

        <div className="space-y-6">
          {messageGroups.map((group, idx) => {
            if (group.type === 'single') {
              return (
                <MessageItem
                  key={group.message.id}
                  message={group.message}
                  isCurrentlyStreaming={group.message.id === activeStreamingMessageId}
                  streamStartTime={streamStartTime}
                  streamingStatusSteps={streamingStatusSteps}
                  statusLabel={statusLabel}
                  sessionTodos={sessionTodos}
                  todoRenderedRef={todoRenderedRef}
                  activeSessionId={activeSessionId}
                  onPermissionReply={onPermissionReply}
                  onQuestionReply={onQuestionReply}
                  onQuestionSkip={onQuestionSkip}
                  onSubagentNavigate={handleSubagentNavigate}
                  showSessionSetup={showSessionSetup}
                  onRetry={onRetry}
                />
              )
            }
            return (
              <AssistantRunBlock
                key={group.messages[0].id}
                messages={group.messages}
                streamingMessageId={activeStreamingMessageId}
                streamingStatusSteps={streamingStatusSteps}
                statusLabel={statusLabel}
                sessionTodos={sessionTodos}
                todoRenderedRef={todoRenderedRef}
                onSubagentNavigate={handleSubagentNavigate}
                showSessionSetup={showSessionSetup}
                isFirstAssistantBlock={idx === firstAssistantBlockIndex}
              />
            )
          })}
        </div>
      </div>

      <ConversationScrollButton />
    </Conversation>
  )
}
