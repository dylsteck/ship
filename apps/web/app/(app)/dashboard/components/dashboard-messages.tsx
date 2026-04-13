'use client'

import * as React from 'react'
import { Conversation, ConversationScrollButton } from '@ship/ui'
import type { UIMessage, ToolInvocation } from '@/lib/ai-elements-adapter'
import { getStreamingStatus } from '@/lib/ai-elements-adapter'
import {
  extractSubagentSessionId,
  getSubagentType,
  getSubagentDescription,
  getSubagentFullPrompt,
  getSubagentResultText,
  extractChildToolsFromResult,
} from '@/lib/subagent/utils'
import { mapToolState } from '@/lib/ai-elements-adapter'
import { SubagentView, type SubagentViewState } from './subagent-view'
import type { TodoItem } from '../types'
import { formatAgentType } from './messages/helpers'
import { MessageItem, MessagesEmptyState } from './messages'
import { groupConsecutiveAssistants } from './dashboard-message-grouping'
import { AssistantRunBlock } from './assistant-run-block'

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
  const [subagentStack, setSubagentStack] = React.useState<SubagentViewState[]>([])
  const todoRenderedRef = React.useRef(false)

  const messageGroups = React.useMemo(() => groupConsecutiveAssistants(messages), [messages])

  const { showSessionSetup, firstAssistantBlockIndex } = React.useMemo(() => {
    const hasCompletedAssistant = messages.some(
      (m) =>
        m.role === 'assistant' &&
        m.id !== streamingMessageId &&
        (m.content || (m.toolInvocations?.length ?? 0) > 0),
    )
    let firstIdx = -1
    for (let i = 0; i < messageGroups.length; i++) {
      if (messageGroups[i].type === 'assistant-run') {
        firstIdx = i
        break
      }
    }
    return {
      showSessionSetup: !hasCompletedAssistant,
      firstAssistantBlockIndex: firstIdx,
    }
  }, [messages, streamingMessageId, messageGroups])

  const resolvedSubagent = React.useMemo(() => {
    if (subagentStack.length === 0) return null
    const stackTop = subagentStack[subagentStack.length - 1]!
    const toolCallId = stackTop.toolCallId

    let latestTool: ToolInvocation | null = null
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i]
      const tools = msg?.toolInvocations ?? []
      const found = tools.find((t) => t.toolCallId === toolCallId)
      if (found) {
        latestTool = found
        break
      }
    }

    if (!latestTool) return stackTop

    const sessionId = extractSubagentSessionId(latestTool) || stackTop.sessionId
    const resultText = getSubagentResultText(latestTool) || stackTop.resultText
    const childTools = extractChildToolsFromResult(latestTool)
    const toolStatus = mapToolState(latestTool.state)

    return {
      ...stackTop,
      sessionId: sessionId || stackTop.sessionId,
      resultText: resultText || stackTop.resultText,
      childTools: childTools.length > 0 ? childTools : stackTop.childTools,
      toolStatus,
      duration: latestTool.duration ?? stackTop.duration,
    }
  }, [subagentStack, messages])

  if (!activeSessionId) return null

  todoRenderedRef.current = false
  const statusLabel = isStreaming
    ? getStreamingStatus(messages, streamingMessageId) || streamingStatus
    : ''
  const hasContent = messages.some((m) => m.content || m.toolInvocations?.length)

  const handleSubagentNavigate = (tool: ToolInvocation) => {
    const agentType = getSubagentType(tool) || String(tool.args?.subagent_type || 'Agent')
    const description = getSubagentDescription(tool) || String(tool.args?.description || '')
    const prompt = getSubagentFullPrompt(tool)
    const sessionId = extractSubagentSessionId(tool) || undefined
    const resultText = getSubagentResultText(tool) || undefined
    const childTools = extractChildToolsFromResult(tool)
    const toolStatus = mapToolState(tool.state)

    setSubagentStack((prev) => [
      ...prev,
      {
        toolCallId: tool.toolCallId,
        agentType: formatAgentType(agentType),
        description,
        prompt: prompt || undefined,
        resultText,
        sessionId,
        childTools: childTools.length > 0 ? childTools : undefined,
        toolStatus,
        duration: tool.duration,
      },
    ])
  }

  const handleSubagentBack = () => {
    setSubagentStack((prev) => prev.slice(0, -1))
  }

  if (resolvedSubagent) {
    return (
      <SubagentView
        subagent={resolvedSubagent}
        onBack={handleSubagentBack}
        parentSessionId={activeSessionId}
      />
    )
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
                  isCurrentlyStreaming={group.message.id === streamingMessageId}
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
                streamingMessageId={streamingMessageId}
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
