'use client'

import * as React from 'react'
import { Message, Tool, Response, Loader, SubagentTool, TodoProgress, Conversation, ConversationScrollButton } from '@ship/ui'
import { Markdown } from '@/components/chat/markdown'
import { ErrorMessage } from '@/components/chat/error-message'
import { PermissionPrompt } from './permission-prompt'
import { QuestionPrompt } from './question-prompt'
import { type UIMessage, type ToolInvocation, getStreamingStatus, mapToolState } from '@/lib/ai-elements-adapter'
import {
  isSubagentToolInvocation,
  extractSubagentSessionId,
  getSubagentType,
  getSubagentDescription,
  getSubagentFullPrompt,
  getSubagentResultText,
  extractChildToolsFromResult,
} from '@/lib/subagent/utils'
import { SubagentView, type SubagentViewState } from './subagent-view'
import type { TodoItem } from '../types'

interface DashboardMessagesProps {
  activeSessionId: string | null
  messages: UIMessage[]
  isStreaming: boolean
  streamingMessageId: string | null
  streamStartTime: number | null
  sessionTodos?: TodoItem[]
  onPermissionReply?: (permissionId: string, approved: boolean) => Promise<void>
}

export function DashboardMessages({
  activeSessionId,
  messages,
  isStreaming,
  streamingMessageId,
  streamStartTime,
  sessionTodos = [],
  onPermissionReply,
}: DashboardMessagesProps) {
  const [subagentStack, setSubagentStack] = React.useState<SubagentViewState[]>([])

  if (!activeSessionId) return null

  const statusLabel = isStreaming ? getStreamingStatus(messages, streamingMessageId) : ''
  const hasContent = messages.some((m) => m.content || m.toolInvocations?.length)

  // Sub-agent navigation handlers
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

  // If we're viewing a sub-agent, render that instead
  if (subagentStack.length > 0) {
    const currentSubagent = subagentStack[subagentStack.length - 1]
    return (
      <SubagentView
        subagent={currentSubagent}
        onBack={handleSubagentBack}
        parentSessionId={activeSessionId}
      />
    )
  }

  // Track if we've rendered the todo progress card inline
  let todoRendered = false

  return (
    <Conversation className="h-full">
      <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-8 sm:py-8">
        {/* Empty state */}
        {!hasContent && !isStreaming && (
          <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
            <svg
              className="w-8 h-8 mb-3 text-muted-foreground/30"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            <span className="text-sm">Send a message to start the conversation.</span>
          </div>
        )}

        {/* Messages */}
        <div className="space-y-6">
          {messages.map((message) => {
            // Permission prompts
            if (message.type === 'permission' && message.promptData) {
              return (
                <div key={message.id} className="py-2">
                  <PermissionPrompt
                    id={message.promptData.id}
                    permission={message.promptData.permission || ''}
                    description={message.promptData.description}
                    patterns={message.promptData.patterns}
                    status={message.promptData.status as 'pending' | 'granted' | 'denied'}
                    onApprove={
                      onPermissionReply && activeSessionId
                        ? () => onPermissionReply(message.promptData!.id, true)
                        : undefined
                    }
                    onDeny={
                      onPermissionReply && activeSessionId
                        ? () => onPermissionReply(message.promptData!.id, false)
                        : undefined
                    }
                  />
                </div>
              )
            }

            // Question prompts
            if (message.type === 'question' && message.promptData) {
              return (
                <div key={message.id} className="py-2">
                  <QuestionPrompt
                    id={message.promptData.id}
                    text={message.promptData.text || message.content}
                    status={message.promptData.status as 'pending' | 'replied' | 'rejected'}
                  />
                </div>
              )
            }

            // Error messages
            if (message.type === 'error') {
              return (
                <div key={message.id} className="py-2">
                  <ErrorMessage
                    message={message.content}
                    category={message.errorCategory || 'persistent'}
                    retryable={message.retryable || false}
                  />
                </div>
              )
            }

            // PR notification
            if (message.type === 'pr-notification') {
              return (
                <Message key={message.id} role="system">
                  <div className="border border-green-500/50 bg-green-50 dark:bg-green-950/20 rounded-lg p-3">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-green-600">&#x2714;</span>
                      <span className="text-foreground">{message.content}</span>
                    </div>
                  </div>
                </Message>
              )
            }

            // Skip empty streaming assistant messages
            const isCurrentlyStreaming = message.id === streamingMessageId
            if (
              message.role === 'assistant' &&
              !message.content &&
              !message.toolInvocations?.length &&
              !message.reasoning?.length &&
              isCurrentlyStreaming
            ) {
              return (
                <Message key={message.id} role="assistant">
                  <Loader message={statusLabel || 'Thinking...'} />
                </Message>
              )
            }

            // Skip truly empty messages
            if (!message.content && !message.toolInvocations?.length && !message.reasoning?.length) {
              return null
            }

            const hasOnlyReasoning =
              message.role === 'assistant' &&
              (message.reasoning && message.reasoning.length > 0) &&
              (!message.toolInvocations || message.toolInvocations.length === 0) &&
              !message.content

            const hasSteps =
              message.role === 'assistant' &&
              (message.toolInvocations && message.toolInvocations.length > 0)

            return (
              <Message
                key={message.id}
                role={message.role}
                className={isCurrentlyStreaming ? 'will-change-[contents]' : undefined}
              >
                {/* User messages */}
                {message.role === 'user' && message.content && (
                  <div className="text-foreground whitespace-pre-wrap">{message.content}</div>
                )}

                {/* Reasoning-only: still "thinking", show Loader until tools/content arrive */}
                {hasOnlyReasoning && (
                  <Loader message={statusLabel || 'Thinking...'} />
                )}

                {/* Tool calls — each Tool has its own collapsible with arrow */}
                {hasSteps && message.toolInvocations && message.toolInvocations.length > 0 && (
                  <div className="space-y-2 my-1">
                    {message.toolInvocations.map((tool) => {
                          // Check for todo tools — render inline TodoProgress
                          const isTodoTool = tool.toolName.toLowerCase().includes('todo')
                          if (isTodoTool && sessionTodos.length > 0 && !todoRendered) {
                            if (tool.toolName.toLowerCase().includes('todoread')) {
                              return null
                            }
                            todoRendered = true
                            return (
                              <TodoProgress key={tool.toolCallId} todos={sessionTodos} />
                            )
                          }
                          if (isTodoTool) {
                            return null
                          }

                          // Check for sub-agent tools
                          const isSubagent = isSubagentToolInvocation(tool)
                          if (isSubagent) {
                            const agentType = getSubagentType(tool) || String(tool.args?.subagent_type || tool.args?.description || 'Agent')
                            const description = getSubagentDescription(tool) || String(tool.args?.prompt || tool.args?.description || '')
                            const childTools = extractChildToolsFromResult(tool)
                            const resultText = getSubagentResultText(tool)
                            const toolStatus = mapToolState(tool.state)
                            return (
                              <SubagentTool
                                key={tool.toolCallId}
                                toolCallId={tool.toolCallId}
                                agentType={agentType}
                                description={description}
                                status={toolStatus}
                                duration={tool.duration}
                                childTools={childTools.length > 0 ? childTools : undefined}
                                result={resultText ? <Markdown content={resultText} /> : undefined}
                                onNavigate={() => handleSubagentNavigate(tool)}
                              />
                            )
                          }

                          // Regular tool
                          return (
                            <Tool
                              key={tool.toolCallId}
                              name={tool.toolName}
                              status={mapToolState(tool.state)}
                              input={tool.args}
                              output={tool.result}
                              duration={tool.duration}
                            />
                          )
                        })}
                  </div>
                )}

                {/* Assistant response content */}
                {message.role === 'assistant' && message.content && (
                  <div className={hasSteps ? 'mt-4' : undefined}>
                    <Response>
                      <Markdown content={message.content} />
                    </Response>
                  </div>
                )}
              </Message>
            )
          })}
        </div>
      </div>

      <ConversationScrollButton />
    </Conversation>
  )
}

// Helper
function formatAgentType(raw: string): string {
  if (!raw) return 'Agent'
  return raw
    .split(/[-_]/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}
