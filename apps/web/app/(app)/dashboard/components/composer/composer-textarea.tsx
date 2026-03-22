'use client'

import { useRef, useEffect } from 'react'
import { cn } from '@ship/ui'
import { useComposer } from './composer-context'

export function ComposerTextarea() {
  const { activeSessionId, prompt, onPromptChange, onKeyDown } = useComposer()
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (!textareaRef.current) return
    const el = textareaRef.current
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, activeSessionId ? 200 : 200)}px`
  }, [prompt, activeSessionId])

  return (
    <textarea
      ref={textareaRef}
      placeholder={activeSessionId ? 'Send follow-up' : 'Ask Ship to build, review, fix bugs'}
      value={prompt}
      onChange={(e) => onPromptChange(e.target.value)}
      onKeyDown={onKeyDown}
      rows={activeSessionId ? 1 : 3}
      className={cn(
        'w-full resize-none bg-transparent text-foreground placeholder:text-muted-foreground/50 focus:outline-none transition-all duration-200',
        activeSessionId
          ? 'text-xs min-h-[20px] max-h-[200px] py-0 leading-[20px] overflow-y-auto'
          : 'text-[15px] min-h-[88px] placeholder:text-zinc-500',
      )}
    />
  )
}
