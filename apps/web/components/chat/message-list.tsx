'use client'

import { ToolBlock } from './tool-block'
import { ErrorMessage } from './error-message'
import type { MessagePart, Message } from '@/lib/api'
export type { MessagePart, Message } from '@/lib/api'

interface MessageListProps {
  messages: Message[]
  isStreaming?: boolean
  onLoadEarlier?: () => void
  hasMore?: boolean
  onRetryError?: (messageId: string) => void
  onOpenVSCode?: () => void
  onOpenTerminal?: () => void
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
  onLoadEarlier,
  hasMore,
  onRetryError,
  onOpenVSCode,
  onOpenTerminal,
}: MessageListProps) {
  return (
    <div className="flex-1 space-y-4 overflow-y-auto p-4">
      {hasMore && (
        <button onClick={onLoadEarlier} className="w-full py-2 text-sm text-gray-500 hover:text-gray-700">
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
              className={`max-w-[80%] rounded-lg px-4 py-2 ${
                message.role === 'user'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-100'
              }`}
            >
              {/* Render text content */}
              {message.content && <div className="whitespace-pre-wrap">{message.content}</div>}

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
            </div>
          </div>
        )
      })}

      {isStreaming && (
        <div className="flex justify-start">
          <div className="rounded-lg bg-gray-100 px-4 py-2 dark:bg-gray-800">
            <div className="flex items-center gap-2">
              <div className="animate-pulse">Thinking...</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
