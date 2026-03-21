'use client'

import { useState, useRef, useEffect } from 'react'
import { cn } from '@ship/ui'

interface EnhancedPromptInputProps {
  onSend: (content: string, mode: string) => void
  onStop?: () => void
  isStreaming?: boolean
  disabled?: boolean
  queueCount?: number
  className?: string
  placeholder?: string
}

export function EnhancedPromptInput({
  onSend,
  onStop,
  isStreaming = false,
  disabled = false,
  queueCount = 0,
  className,
  placeholder,
}: EnhancedPromptInputProps) {
  const [mode] = useState<string>('build')
  const [inputValue, setInputValue] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleSubmit = () => {
    if (!inputValue.trim() || isStreaming || disabled) return
    onSend(inputValue, mode)
    setInputValue('')
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`
  }, [inputValue])

  return (
    <div className={cn('relative', className)}>
      <div className="flex items-center rounded-2xl border border-border/50 bg-card overflow-hidden">
        {/* Plus button */}
        <button
          type="button"
          className="flex items-center justify-center size-8 ml-2 shrink-0 rounded-full bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <svg className="size-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v14m-7-7h14" />
          </svg>
        </button>

        {/* Input */}
        <textarea
          ref={textareaRef}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder ?? 'Send follow-up'}
          disabled={disabled || isStreaming}
          rows={1}
          className="flex-1 resize-none bg-transparent px-3 py-2.5 text-sm text-foreground outline-none disabled:opacity-50 min-h-[40px] max-h-[120px] overflow-y-auto placeholder:text-muted-foreground/50"
        />

        {/* Right side: queue/stop or submit */}
        <div className="flex items-center gap-2 pr-2 shrink-0">
          {queueCount > 0 && (
            <span className="text-[11px] text-muted-foreground/60">
              {queueCount} queued
            </span>
          )}
          {isStreaming && onStop ? (
            <button
              type="button"
              onClick={onStop}
              className="flex items-center justify-center size-7 rounded-full bg-muted text-muted-foreground hover:text-foreground transition-colors"
            >
              <svg className="size-3" fill="currentColor" viewBox="0 0 24 24">
                <rect x="6" y="6" width="12" height="12" rx="1" />
              </svg>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!inputValue.trim() || disabled}
              className={cn(
                'flex items-center justify-center size-7 rounded-full transition-colors',
                inputValue.trim() && !disabled
                  ? 'bg-foreground text-background hover:bg-foreground/90'
                  : 'bg-muted/60 text-muted-foreground/40',
              )}
            >
              <svg className="size-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
