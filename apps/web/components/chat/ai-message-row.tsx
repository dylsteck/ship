'use client'

import * as React from 'react'
import {
  Message,
  Tool,
  SubagentTool,
  Response,
  Loader,
  ReasoningCollapsible,
  useIsMobile,
} from '@ship/ui'
import { ErrorMessage } from './error-message'
import { Markdown } from './markdown'
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

function AIMessageEmptyState() {
  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="text-center">
        <svg className="mx-auto h-12 w-12 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

function AIMessageTools({
  tools,
  isMobile,
  onSubagentNavigate,
}: {
  tools: ToolInvocation[]
  isMobile: boolean
  onSubagentNavigate: (tool: ToolInvocation) => void
}) {
  return (
    <div className="space-y-1">
      {tools.map((tool) => {
        if (isSubagentToolInvocation(tool)) {
          const agentType =
            getSubagentType(tool) || String(tool.args?.subagent_type ?? tool.args?.description ?? 'Agent')
          const description =
            getSubagentDescription(tool) || String(tool.args?.prompt ?? tool.args?.description ?? '')
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
              onNavigate={() => onSubagentNavigate(tool)}
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
            layout={isMobile ? 'stacked' : 'default'}
          />
        )
      })}
    </div>
  )
}

export function AIMessageRow({
  msg,
  isCurrentlyStreaming,
  streamingLabel,
  onRetryError,
  onSubagentNavigate,
}: {
  msg: UIMessage
  isCurrentlyStreaming: boolean
  streamingLabel?: string
  onRetryError?: (messageId: string) => void
  onSubagentNavigate: (tool: ToolInvocation) => void
}) {
  const isMobile = useIsMobile()

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

  return (
    <Message key={msg.id} role={msg.role}>
      {msg.role === 'user' && msg.content && (
        <div className="text-foreground whitespace-pre-wrap">{msg.content}</div>
      )}

      {msg.role === 'assistant' && msg.reasoning && msg.reasoning.length > 0 && (
        <ReasoningCollapsible
          reasoning={msg.reasoning}
          isStreaming={isCurrentlyStreaming}
          duration={msg.elapsed != null ? Math.floor(msg.elapsed / 1000) : undefined}
          defaultOpenWhenDone={isMobile}
        />
      )}

      {msg.role === 'assistant' && msg.toolInvocations && msg.toolInvocations.length > 0 && (
        <AIMessageTools tools={msg.toolInvocations} isMobile={isMobile} onSubagentNavigate={onSubagentNavigate} />
      )}

      {msg.role === 'assistant' && msg.content && (
        <Response>
          <Markdown content={msg.content} isAnimating={isCurrentlyStreaming} />
        </Response>
      )}

      {msg.role === 'assistant' &&
        isCurrentlyStreaming &&
        !msg.content &&
        !msg.toolInvocations?.length &&
        !msg.reasoning?.length && <Loader message={streamingLabel || 'Thinking...'} />}
    </Message>
  )
}

export { AIMessageEmptyState }
