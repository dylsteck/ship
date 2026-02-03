'use client'

import { useState, type KeyboardEvent } from 'react'
import { Button, cn } from '@ship/ui'
import { HugeiconsIcon } from '@hugeicons/react'
import { ArrowUp02Icon, AttachmentIcon } from '@hugeicons/core-free-icons'

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
    <div className="border-t border-border/60 bg-background/80 p-4">
      <div className="rounded-3xl border border-border/60 bg-card shadow-sm overflow-hidden transition-shadow focus-within:shadow-md focus-within:ring-2 focus-within:ring-foreground/10">
        <div className="p-4 pb-3">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isStreaming ? 'Message will be queued...' : 'Type a message...'}
            disabled={disabled}
            className="w-full min-h-[72px] resize-none bg-transparent text-sm placeholder:text-muted-foreground/80 focus:outline-none"
            rows={2}
          />

          <div className="mt-3 flex items-center justify-between">
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon-sm" className="rounded-full">
                <HugeiconsIcon icon={AttachmentIcon} strokeWidth={2} />
              </Button>
              {queueCount > 0 && (
                <span className="text-[11px] text-muted-foreground">
                  {queueCount} queued
                </span>
              )}
            </div>

            <div className="flex items-center gap-1">
              {isStreaming ? (
                <Button
                  variant="destructive"
                  size="sm"
                  className="rounded-full px-3"
                  onClick={onStop}
                >
                  Stop
                </Button>
              ) : (
                <Button
                  onClick={handleSubmit}
                  disabled={disabled || !input.trim()}
                  size="icon-sm"
                  className={cn(
                    'rounded-full',
                    input.trim()
                      ? 'bg-foreground text-background hover:bg-foreground/90'
                      : 'bg-muted text-muted-foreground',
                  )}
                >
                  <HugeiconsIcon icon={ArrowUp02Icon} strokeWidth={2} />
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
