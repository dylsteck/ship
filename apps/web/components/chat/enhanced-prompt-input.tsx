'use client'

import { useState } from 'react'
import { PromptInput, Button } from '@ship/ui'
import { cn } from '@ship/ui'

interface EnhancedPromptInputProps {
  onSend: (content: string, mode: 'build' | 'plan') => void
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
  const [mode, setMode] = useState<'build' | 'plan'>('build')
  const [inputValue, setInputValue] = useState('')

  const handleSubmit = (content: string) => {
    onSend(content, mode)
    setInputValue('')
  }

  const getPlaceholder = () => {
    if (placeholder) return placeholder
    return `Send a message (${mode === 'build' ? 'build' : 'plan'} mode)...`
  }

  return (
    <div className={cn('space-y-2', className)}>
      {/* Build/Plan toggle */}
      <div className="flex items-center gap-1 p-1 bg-muted/50 rounded-lg w-fit">
        <Button
          variant={mode === 'build' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setMode('build')}
          disabled={isStreaming}
          className="h-7 text-xs"
        >
          Build
        </Button>
        <Button
          variant={mode === 'plan' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setMode('plan')}
          disabled={isStreaming}
          className="h-7 text-xs"
        >
          Plan
        </Button>
      </div>

      {/* Prompt input */}
      <PromptInput
        onSubmit={handleSubmit}
        isStreaming={isStreaming}
        placeholder={getPlaceholder()}
        disabled={disabled}
        value={inputValue}
        onChange={setInputValue}
      />

      {/* Queue indicator and stop button */}
      <div className="flex items-center justify-between">
        {queueCount > 0 && (
          <div className="text-xs text-muted-foreground">
            {queueCount} message{queueCount !== 1 ? 's' : ''} queued
          </div>
        )}
        {isStreaming && onStop && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onStop}
            className="h-7 text-xs text-muted-foreground hover:text-foreground"
          >
            <span className="mr-1">⏹</span> Stop
          </Button>
        )}
      </div>
    </div>
  )
}
