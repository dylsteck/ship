'use client'

import { useState, type KeyboardEvent } from 'react'

interface ChatInputProps {
  onSend: (content: string) => void
  onStop: () => void
  isStreaming: boolean
  queueCount?: number
  disabled?: boolean
}

export function ChatInput({ onSend, onStop, isStreaming, queueCount = 0, disabled }: ChatInputProps) {
  const [input, setInput] = useState('')

  const handleSubmit = () => {
    if (!input.trim()) return
    onSend(input.trim())
    setInput('')
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <div className="border-t bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
      <div className="flex gap-3">
        <div className="flex-1 relative">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isStreaming ? 'Message will be queued...' : 'Type a message...'}
            disabled={disabled}
            className="w-full resize-none rounded-lg border border-gray-300 px-4 py-3 pr-12 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 disabled:cursor-not-allowed dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:focus:border-blue-400 dark:disabled:bg-gray-800/50 transition-colors"
            rows={2}
          />
        </div>

        <div className="flex flex-col gap-2">
          {isStreaming ? (
            <button
              onClick={onStop}
              className="rounded-lg bg-red-600 px-6 py-3 text-sm font-medium text-white shadow-sm transition-all hover:bg-red-700 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900"
            >
              Stop
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={disabled || !input.trim()}
              className="rounded-lg bg-blue-600 px-6 py-3 text-sm font-medium text-white shadow-sm transition-all hover:bg-blue-700 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-blue-600 disabled:hover:shadow-sm dark:focus:ring-offset-gray-900"
            >
              Send
            </button>
          )}
        </div>
      </div>

      {queueCount > 0 && (
        <div className="mt-2 flex items-center gap-2">
          <div className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse"></div>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {queueCount} message{queueCount > 1 ? 's' : ''} queued
          </span>
        </div>
      )}
    </div>
  )
}
