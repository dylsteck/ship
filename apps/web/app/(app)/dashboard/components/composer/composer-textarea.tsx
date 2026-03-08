'use client'

import { useRef, useEffect } from 'react'
import { cn } from '@ship/ui'
import { useComposer } from './composer-context'

export function ComposerTextarea() {
  const { activeSessionId, prompt, onPromptChange, onKeyDown } = useComposer()
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (!textareaRef.current || !activeSessionId) return
    const el = textareaRef.current
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`
  }, [prompt, activeSessionId])

  return (
    <textarea
      ref={textareaRef}
      placeholder={activeSessionId ? 'Send a message...' : 'Ask Ship to build, fix bugs, explore'}
      value={prompt}
      onChange={(e) => onPromptChange(e.target.value)}
      onKeyDown={onKeyDown}
      rows={activeSessionId ? 1 : 3}
      className={cn(
        'w-full resize-none bg-transparent text-foreground text-[15px] placeholder:text-muted-foreground/50 focus:outline-none transition-all duration-200',
        activeSessionId ? 'min-h-[32px] max-h-[200px]' : 'min-h-[88px]',
        !activeSessionId && 'placeholder:text-zinc-500',
      )}
    />
  )
}
