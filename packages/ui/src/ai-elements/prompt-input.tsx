'use client'

import * as React from 'react'
import { cn } from '../utils'

interface PromptInputProps {
  onSubmit: (content: string) => void
  isStreaming?: boolean
  placeholder?: string
  disabled?: boolean
  className?: string
  value?: string
  onChange?: (value: string) => void
}

export function PromptInput({
  onSubmit,
  isStreaming = false,
  placeholder = 'Send a message...',
  disabled = false,
  className,
  value: controlledValue,
  onChange,
}: PromptInputProps) {
  const [internalValue, setInternalValue] = React.useState('')
  const value = controlledValue !== undefined ? controlledValue : internalValue
  const setValue = onChange || setInternalValue

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!value.trim() || isStreaming || disabled) return
    onSubmit(value)
    if (!onChange) {
      setInternalValue('')
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  return (
    <form onSubmit={handleSubmit} className={cn('relative', className)}>
      <div className="relative flex items-end rounded-xl border bg-background shadow-sm">
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled || isStreaming}
          rows={1}
          className="flex-1 resize-none bg-transparent px-4 py-3 text-sm outline-none disabled:opacity-50 min-h-[48px] max-h-[200px] overflow-y-auto"
          style={{ height: 'auto' }}
        />
        <div className="flex items-center gap-2 px-3 py-2">
          <button
            type="submit"
            disabled={!value.trim() || isStreaming || disabled}
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded-lg transition-colors',
              value.trim() && !isStreaming && !disabled
                ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                : 'bg-muted text-muted-foreground',
            )}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>
    </form>
  )
}
