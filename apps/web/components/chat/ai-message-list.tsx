'use client'

import { useRef, useEffect } from 'react'
import { Message, Reasoning, ChainOfThought, Tool, Shimmer, Response, Loader } from '@ship/ui'
import { ErrorMessage } from './error-message'
import { Markdown } from './markdown'
import type { ChainOfThoughtStep } from '@/lib/ai-elements-adapter'
import { cn } from '@ship/ui'

interface AIMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  inlineTools?: Array<{
    name: string
    status: 'pending' | 'in_progress' | 'completed' | 'failed'
    input: Record<string, unknown>
    output?: unknown
    duration?: number
  }>
  reasoningBlocks?: Array<{
    text: string
  }>
  error?: {
    message: string
    category?: 'transient' | 'persistent' | 'user-action' | 'fatal'
    retryable?: boolean
  }
}

interface StreamingToolDisplay {
  callID: string
  name: string
  status: 'pending' | 'in_progress' | 'completed' | 'failed'
  input: Record<string, unknown>
  output?: string
  duration?: number
}

interface AIMessageListProps {
  messages: AIMessage[]
  isStreaming?: boolean
  streamingText?: string
  currentReasoning?: string
  currentSteps?: ChainOfThoughtStep[]
  streamingTools?: StreamingToolDisplay[]
  streamingLabel?: string
  onRetryError?: (messageId: string) => void
  onOpenVSCode?: () => void
  onOpenTerminal?: () => void
  className?: string
}


export function AIMessageList({
  messages,
  isStreaming,
  streamingText,
  currentReasoning,
  currentSteps,
  streamingTools,
  streamingLabel,
  onRetryError,
  onOpenVSCode,
  onOpenTerminal,
  className,
}: AIMessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, isStreaming, streamingText])

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
    <div ref={scrollRef} className={cn('flex-1 overflow-y-auto', className)}>
      <div className="max-w-3xl mx-auto py-6">
        {messages.map((msg) => {
          // Handle error messages
          if (msg.error) {
            return (
              <div key={msg.id} className="px-4 py-2">
                <ErrorMessage
                  message={msg.error.message}
                  category={msg.error.category || 'persistent'}
                  retryable={msg.error.retryable || false}
                  onRetry={onRetryError ? () => onRetryError(msg.id) : undefined}
                  onOpenVSCode={onOpenVSCode}
                  onOpenTerminal={onOpenTerminal}
                />
              </div>
            )
          }

          return (
            <Message key={msg.id} role={msg.role}>
              {/* User messages - show content directly */}
              {msg.role === 'user' && msg.content && (
                <div className="text-foreground whitespace-pre-wrap">{msg.content}</div>
              )}

              {/* Assistant reasoning */}
              {msg.role === 'assistant' &&
                msg.reasoningBlocks &&
                msg.reasoningBlocks.length > 0 &&
                msg.reasoningBlocks.map((r, idx) => (
                  <Reasoning key={idx} isStreaming={false}>
                    {r.text}
                  </Reasoning>
                ))}

              {/* Assistant tools */}
              {msg.role === 'assistant' &&
                msg.inlineTools &&
                msg.inlineTools.length > 0 &&
                msg.inlineTools.map((tool, idx) => (
                  <Tool
                    key={idx}
                    name={tool.name}
                    status={tool.status}
                    input={tool.input}
                    output={tool.output}
                    duration={tool.duration}
                  />
                ))}

              {/* Assistant response content */}
              {msg.role === 'assistant' && msg.content && (
                <Response>
                  <Markdown content={msg.content} />
                </Response>
              )}
            </Message>
          )
        })}

        {/* Currently streaming message */}
        {isStreaming && (
          <Message role="assistant">
            {currentReasoning && <Reasoning isStreaming={true}>{currentReasoning}</Reasoning>}

            {/* Show active tool calls */}
            {streamingTools && streamingTools.length > 0 && (
              <div className="space-y-1">
                {streamingTools.map((tool) => (
                  <Tool
                    key={tool.callID}
                    name={tool.name}
                    status={tool.status}
                    input={tool.input}
                    output={tool.output}
                    duration={tool.duration}
                  />
                ))}
              </div>
            )}

            {streamingText && (
              <Response>
                <Shimmer>
                  <Markdown content={streamingText} />
                </Shimmer>
              </Response>
            )}

            {!streamingText && !currentReasoning && (!streamingTools || streamingTools.length === 0) && (
              <Loader message={streamingLabel || 'Thinking...'} />
            )}
          </Message>
        )}
      </div>
    </div>
  )
}
