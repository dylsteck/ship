'use client'

import * as React from 'react'
import { Message, Tool, SubagentTool, Response, Loader, ReasoningCollapsible, Conversation, ConversationScrollButton } from '@ship/ui'
import { ErrorMessage } from './error-message'
import { Markdown } from './markdown'
import { cn } from '@ship/ui'
import { SubagentSheet } from './subagent-sheet'
import { type UIMessage, type ToolInvocation, mapToolState } from '@/lib/ai-elements-adapter'
import {
  isSubagentToolInvocation,
  getSubagentType,
  getSubagentDescription,
  getSubagentFullPrompt,
  getSubagentResultText,
  extractChildToolsFromResult,
  isResultJsonBlob,
} from '@/lib/subagent/utils'

interface AIMessageListProps {
  messages: UIMessage[]
  isStreaming?: boolean
  streamingMessageId?: string | null
  streamingLabel?: string
  onRetryError?: (messageId: string) => void
  className?: string
}

interface SubagentSheetData {
  isOpen: boolean
  agentType: string
  description: string
  prompt?: string
  resultText?: string
  childTools?: { name: string; status: string; title?: string }[]
  status?: 'pending' | 'in_progress' | 'completed' | 'failed'
  duration?: number
}

function MessageListContent({
  messages,
  isStreaming,
  streamingMessageId,
  streamingLabel,
  onRetryError,
  className,
}: AIMessageListProps) {
  const [sheetData, setSheetData] = React.useState<SubagentSheetData>({ isOpen: false, agentType: '', description: '' })

  const handleSubagentNavigate = React.useCallback((tool: ToolInvocation) => {
    const agentType = getSubagentType(tool) || String(tool.args?.subagent_type || 'Agent')
    const description = getSubagentDescription(tool) || String(tool.args?.description || '')
    const prompt = getSubagentFullPrompt(tool)
    const resultText = getSubagentResultText(tool)
    const childTools = extractChildToolsFromResult(tool)
    const toolStatus = mapToolState(tool.state)

    setSheetData({
      isOpen: true,
      agentType,
      description,
      prompt: prompt || undefined,
      resultText: resultText || undefined,
      childTools: childTools.length > 0 ? childTools : undefined,
      status: toolStatus,
      duration: tool.duration,
    })
  }, [])

  const handleCloseSheet = React.useCallback(() => {
    setSheetData((prev) => ({ ...prev, isOpen: false }))
  }, [])

  if (messages.length === 0 && !isStreaming) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center">
          <svg
            className="mx-auto h-12 w-12 text-muted-foreground"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
            />
          </svg>
          <h3 className="mt-4 text-sm font-medium text-foreground">No messages yet</h3>
          <p className="mt-1 text-sm text-muted-foreground">Start a conversation to see messages here.</p>
        </div>
      </div>
    )
  }

  return (
    <>
      <Conversation className={cn('flex-1', className)}>
        <div className="max-w-3xl mx-auto px-3 py-4 sm:px-4 sm:py-6">
          {messages.map((msg) => {
            // Handle error messages
            if (msg.type === 'error') {
              return (
                <div key={msg.id} className="px-4 py-2">
                  <ErrorMessage
                    message={msg.content}
                    category={msg.errorCategory || 'persistent'}
                    retryable={msg.retryable || false}
                    onRetry={onRetryError ? () => onRetryError(msg.id) : undefined}
                  />
                </div>
              )
            }

            const isCurrentlyStreaming = msg.id === streamingMessageId

            return (
              <Message key={msg.id} role={msg.role}>
                {/* User messages */}
                {msg.role === 'user' && msg.content && (
                  <div className="text-foreground whitespace-pre-wrap">{msg.content}</div>
                )}

                {/* Assistant reasoning = show collapsible, collapsed by default when done */}
                {msg.role === 'assistant' && msg.reasoning && msg.reasoning.length > 0 && (
                  <ReasoningCollapsible
                    reasoning={msg.reasoning}
                    isStreaming={isCurrentlyStreaming}
                    duration={
                      msg.elapsed != null ? Math.floor(msg.elapsed / 1000) : undefined
                    }
                  />
                )}

                {/* Assistant tools - detect subagent tools and render with SubagentTool */}
                {msg.role === 'assistant' && msg.toolInvocations && msg.toolInvocations.length > 0 && (
                  <div className="space-y-1">
                    {msg.toolInvocations.map((tool) => {
                      if (isSubagentToolInvocation(tool)) {
                        const agentType =
                          getSubagentType(tool) ||
                          String(tool.args?.subagent_type ?? tool.args?.description ?? 'Agent')
                        const description =
                          getSubagentDescription(tool) ||
                          String(tool.args?.prompt ?? tool.args?.description ?? '')
                        const childTools = extractChildToolsFromResult(tool)
                        const resultText = getSubagentResultText(tool)
                        const toolStatus = mapToolState(tool.state)
                        const showResult = resultText && !(toolStatus === 'completed' && isResultJsonBlob(tool))

                        return (
                          <SubagentTool
                            key={tool.toolCallId}
                            toolCallId={tool.toolCallId}
                            agentType={agentType}
                            description={description}
                            status={toolStatus}
                            duration={tool.duration}
                            childTools={childTools.length > 0 ? childTools : undefined}
                            result={showResult ? <Markdown content={resultText!} /> : undefined}
                            onNavigate={() => handleSubagentNavigate(tool)}
                          />
                        )
                      }

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
                {msg.role === 'assistant' && msg.content && (
                  <Response>
                    <Markdown content={msg.content} isAnimating={isCurrentlyStreaming} />
                  </Response>
                )}

                {/* Loading state for empty streaming message */}
                {msg.role === 'assistant' &&
                  isCurrentlyStreaming &&
                  !msg.content &&
                  !msg.toolInvocations?.length &&
                  !msg.reasoning?.length && <Loader message={streamingLabel || 'Thinking...'} />}
              </Message>
            )
          })}
        </div>

        <ConversationScrollButton />
      </Conversation>

      {/* Subagent Detail Sheet */}
      <SubagentSheet
        agentType={sheetData.agentType}
        description={sheetData.description}
        prompt={sheetData.prompt}
        resultText={sheetData.resultText}
        childTools={sheetData.childTools}
        status={sheetData.status}
        duration={sheetData.duration}
        isOpen={sheetData.isOpen}
        onClose={handleCloseSheet}
      />
    </>
  )
}

export function AIMessageList(props: AIMessageListProps) {
  return <MessageListContent {...props} />
}
