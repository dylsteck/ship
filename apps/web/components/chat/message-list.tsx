'use client'

import { ToolBlock } from './tool-block'
import { ErrorMessage } from './error-message'
import { Markdown } from './markdown'
import { CostBreakdown } from '@/components/cost/cost-breakdown'
import type { MessagePart, Message } from '@/lib/api'
import type { CostBreakdown as CostBreakdownType } from '@/lib/cost-tracker'
import { cn } from '@ship/ui'
export type { MessagePart, Message } from '@/lib/api'

interface MessageListProps {
  messages: Message[]
  isStreaming?: boolean
  streamingLabel?: string
  onLoadEarlier?: () => void
  hasMore?: boolean
  onRetryError?: (messageId: string) => void
  onOpenVSCode?: () => void
  onOpenTerminal?: () => void
  className?: string
}

/**
 * Parse parts JSON string to array
 */
function parseParts(parts: string | undefined): MessagePart[] {
  if (!parts) return []
  try {
    return JSON.parse(parts) as MessagePart[]
  } catch {
    return []
  }
}

export function MessageList({
  messages,
  isStreaming,
  streamingLabel,
  onLoadEarlier,
  hasMore,
  onRetryError,
  onOpenVSCode,
  onOpenTerminal,
  className,
}: MessageListProps) {
  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center">
          <svg
            className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500"
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
          <h3 className="mt-4 text-sm font-medium text-gray-900 dark:text-gray-100">No messages yet</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Start a conversation to see messages here.</p>
        </div>
      </div>
    )
  }

  return (
    <div className={cn('flex-1 space-y-6 p-6', className)}>
      {hasMore && (
        <button
          onClick={onLoadEarlier}
          className="w-full py-2 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 transition-colors"
        >
          Load earlier messages
        </button>
      )}

      {messages.map((message) => {
        // Handle error messages
        if (message.type === 'error') {
          return (
            <div key={message.id} className="flex justify-start">
              <div className="max-w-[80%]">
                <ErrorMessage
                  message={message.content}
                  category={message.errorCategory || 'persistent'}
                  retryable={message.retryable || false}
                  onRetry={onRetryError ? () => onRetryError(message.id) : undefined}
                  onOpenVSCode={onOpenVSCode}
                  onOpenTerminal={onOpenTerminal}
                />
              </div>
            </div>
          )
        }

        // Regular messages
        const parsedParts = parseParts(message.parts)

        return (
          <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[80%] rounded-lg px-4 py-3 shadow-sm ${
                message.role === 'user'
                  ? 'bg-blue-600 text-white shadow-blue-200/50 dark:shadow-blue-900/30'
                  : message.role === 'system'
                    ? 'bg-gray-50 text-gray-600 dark:bg-gray-800/50 dark:text-gray-400 text-center mx-auto'
                    : 'bg-white text-gray-900 shadow-gray-200/50 dark:bg-gray-800 dark:text-gray-100 dark:shadow-gray-900/30'
              }`}
            >
              {/* Render text content */}
              {message.content &&
                (message.role === 'assistant' ? (
                  <Markdown content={message.content} />
                ) : (
                  <div className={`whitespace-pre-wrap ${message.role === 'user' ? 'text-white' : ''}`}>
                    {message.content}
                  </div>
                ))}

              {/* Render tool parts */}
              {parsedParts.map((part: MessagePart, i: number) => {
                if (part.type === 'tool-call' || part.type === 'tool-result') {
                  return (
                    <ToolBlock
                      key={i}
                      name={part.toolName || 'Unknown'}
                      input={part.toolInput}
                      output={part.toolOutput}
                      state={part.state}
                    />
                  )
                }
                return null
              })}

              {/* Render cost breakdown if available */}
              {(message as Message & { costBreakdown?: CostBreakdownType }).costBreakdown && (
                <CostBreakdown breakdown={(message as Message & { costBreakdown?: CostBreakdownType }).costBreakdown} />
              )}
            </div>
          </div>
        )
      })}

      {isStreaming && (
        <div className="flex justify-start">
          <div className="rounded-lg bg-white px-4 py-3 shadow-sm dark:bg-gray-800">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 animate-pulse rounded-full bg-blue-500"></div>
              <span className="text-sm text-gray-600 dark:text-gray-400">{streamingLabel || 'Thinking...'}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
