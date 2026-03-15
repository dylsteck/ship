'use client'

import * as React from 'react'
import {
  Conversation,
  ConversationScrollButton,
  Message,
  ThinkingBlock,
  Loader,
  SessionSetup,
  Response,
} from '@ship/ui'
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
import { MessageToolList } from './messages/tool-list'
import { Markdown } from '@/components/chat/markdown'

// ─── Message Grouping ──────────────────────────────────────────────

type MessageGroup =
  | { type: 'single'; message: UIMessage }
  | { type: 'assistant-run'; messages: UIMessage[] }

function groupConsecutiveAssistants(messages: UIMessage[]): MessageGroup[] {
  const groups: MessageGroup[] = []
  let run: UIMessage[] = []

  const flushRun = () => {
    if (run.length > 0) {
      groups.push({ type: 'assistant-run', messages: [...run] })
      run = []
    }
  }

  for (const msg of messages) {
    if (msg.role === 'assistant' && !msg.type) {
      run.push(msg)
    } else {
      flushRun()
      groups.push({ type: 'single', message: msg })
    }
  }
  flushRun()
  return groups
}

// ─── Assistant Run Block ────────────────────────────────────────────

interface AssistantRunBlockProps {
  messages: UIMessage[]
  streamingMessageId: string | null
  streamStartTime: number | null
  streamingStatusSteps: string[]
  statusLabel: string
  sessionTodos: TodoItem[]
  todoRenderedRef: React.MutableRefObject<boolean>
  onSubagentNavigate: (tool: ToolInvocation) => void
  /** Only show SessionSetup for the first assistant in the thread */
  showSessionSetup: boolean
  /** Only show persisted startupSteps on the first assistant block */
  isFirstAssistantBlock: boolean
}

function AssistantRunBlock({
  messages,
  streamingMessageId,
  streamingStatusSteps,
  statusLabel,
  sessionTodos,
  todoRenderedRef,
  onSubagentNavigate,
  showSessionSetup,
  isFirstAssistantBlock,
}: AssistantRunBlockProps) {
  const isGroupStreaming = messages.some((m) => m.id === streamingMessageId)

  const lastMsg = messages[messages.length - 1]
  const isLastEmpty =
    !lastMsg.content && !lastMsg.toolInvocations?.length && !lastMsg.reasoning?.length

  // Single empty streaming message → show loader or session setup (only on first message)
  if (messages.length === 1 && isLastEmpty && isGroupStreaming) {
    if (showSessionSetup && streamingStatusSteps.length > 0) {
      return (
        <Message role="assistant">
          <SessionSetup steps={streamingStatusSteps} isStreaming />
        </Message>
      )
    }
    return (
      <Message role="assistant">
        <Loader message={statusLabel || 'Thinking...'} />
      </Message>
    )
  }

  // Filter out completely empty messages (unless they're the streaming target)
  const substantiveMessages = messages.filter(
    (m) =>
      m.content ||
      m.toolInvocations?.length ||
      m.reasoning?.length ||
      m.id === streamingMessageId,
  )

  if (substantiveMessages.length === 0) return null

  const allReasoning = substantiveMessages.flatMap((m) => m.reasoning || [])
  const allToolsRaw = substantiveMessages.flatMap((m) => m.toolInvocations || [])
  // Dedupe by toolCallId — keep last occurrence (most up-to-date state)
  const toolsByCallId = new Map<string, ToolInvocation>()
  const toolOrder: string[] = []
  for (const t of allToolsRaw) {
    if (!toolsByCallId.has(t.toolCallId)) toolOrder.push(t.toolCallId)
    toolsByCallId.set(t.toolCallId, t)
  }
  const allTools = toolOrder.map((id) => toolsByCallId.get(id)!)
  const startupStepsMsg = substantiveMessages.find((m) => m.startupSteps?.length)
  const allPlanItemsRaw = substantiveMessages.flatMap((m) => m.planItems || [])
  const planById = new Map(allPlanItemsRaw.map((p) => [p.id, p]))
  const allPlanItems = Array.from(planById.values())
  // Use only last message's content — parts are cumulative, last has full text
  const lastMsgContent = substantiveMessages[substantiveMessages.length - 1]?.content ?? ''
  const textContent = lastMsgContent

  const hasReasoning = allReasoning.length > 0
  const hasTools = allTools.length > 0

  return (
    <Message role="assistant" className={isGroupStreaming ? 'will-change-contents' : undefined}>
      {isFirstAssistantBlock && startupStepsMsg?.startupSteps && (
        <SessionSetup
          steps={startupStepsMsg.startupSteps}
          defaultOpen={false}
          className="my-1"
        />
      )}

      {(hasReasoning || hasTools) && (
        <ThinkingBlock
          reasoning={allReasoning}
          isStreaming={isGroupStreaming}
          duration={
            substantiveMessages[substantiveMessages.length - 1]?.elapsed != null
              ? Math.floor(substantiveMessages[substantiveMessages.length - 1]!.elapsed! / 1000)
              : undefined
          }
        >
          {hasTools && (
            <MessageToolList
              tools={allTools}
              sessionTodos={sessionTodos}
              todoRenderedRef={todoRenderedRef}
              onSubagentNavigate={onSubagentNavigate}
            />
          )}
        </ThinkingBlock>
      )}

      {allPlanItems.length > 0 && (
        <div className="my-2 rounded-lg border border-border/50 bg-muted/20 p-3 space-y-1.5">
          <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-2">
            Plan
          </div>
          {allPlanItems.map((item) => (
            <div key={item.id} className="flex items-center gap-2 text-sm">
              <span className="shrink-0 w-4 text-center">
                {item.status === 'completed'
                  ? '✓'
                  : item.status === 'in_progress'
                    ? '●'
                    : item.status === 'cancelled'
                      ? '✗'
                      : '○'}
              </span>
              <span
                className={
                  item.status === 'completed'
                    ? 'text-muted-foreground line-through'
                    : item.status === 'in_progress'
                      ? 'text-foreground font-medium'
                      : item.status === 'cancelled'
                        ? 'text-muted-foreground/50 line-through'
                        : 'text-foreground'
                }
              >
                {item.title}
              </span>
            </div>
          ))}
        </div>
      )}

      {textContent && (
        <div className={hasTools ? 'mt-4' : undefined}>
          <Response>
            <Markdown content={textContent} isAnimating={isGroupStreaming} />
          </Response>
        </div>
      )}

    </Message>
  )
}

// ─── Dashboard Messages ─────────────────────────────────────────────

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

  // When in subagent view, sync with latest tool data from parent messages.
  // The tool may not have sessionId yet when user first clicks — it arrives via SSE later.
  const resolvedSubagent = React.useMemo(() => {
    if (subagentStack.length === 0) return null
    const stackTop = subagentStack[subagentStack.length - 1]!
    const toolCallId = stackTop.toolCallId

    // Find the tool in messages (most up-to-date occurrence)
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
                streamStartTime={streamStartTime}
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
