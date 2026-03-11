'use client'

import * as React from 'react'
import { cn } from '../utils'
import { useStickToBottom } from 'use-stick-to-bottom'

interface ConversationProps {
  children: React.ReactNode
  className?: string
}

export function Conversation({ children, className }: ConversationProps) {
  const { scrollRef, contentRef, isAtBottom, scrollToBottom } = useStickToBottom({
    // Smoother spring animation for auto-scroll during streaming
    damping: 0.88,
    stiffness: 0.04,
    mass: 0.7,
    resize: 'smooth',
    initial: 'smooth',
  })

  return (
    <ConversationContext.Provider value={{ isAtBottom, scrollToBottom }}>
      <div ref={scrollRef} className={cn('relative flex-1 overflow-y-auto scroll-smooth', className)}>
        <div ref={contentRef} className="flex flex-col gap-2">
          {children}
        </div>
      </div>
    </ConversationContext.Provider>
  )
}

interface ConversationContextValue {
  isAtBottom: boolean
  scrollToBottom: () => void
}

const ConversationContext = React.createContext<ConversationContextValue>({
  isAtBottom: true,
  scrollToBottom: () => {},
})

export function useConversation() {
  return React.useContext(ConversationContext)
}

interface ConversationMessageProps {
  role: 'user' | 'assistant'
  children: React.ReactNode
  className?: string
}

export function ConversationMessage({ role, children, className }: ConversationMessageProps) {
  return (
    <div className={cn('flex gap-3', role === 'user' ? 'flex-row-reverse' : 'flex-row', className)}>
      <div
        className={cn(
          'max-w-[85%] rounded-2xl px-4 py-2.5',
          role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted',
        )}
      >
        {children}
      </div>
    </div>
  )
}

export function ConversationScrollButton({ className }: { className?: string }) {
  const { isAtBottom, scrollToBottom } = useConversation()

  if (isAtBottom) return null

  return (
    <button
      onClick={() => scrollToBottom()}
      aria-label="Scroll to bottom"
      className={cn(
        'sticky bottom-6 left-1/2 -translate-x-1/2 z-20',
        'flex items-center justify-center w-8 h-8 rounded-full',
        'bg-background/90 border border-border/60 shadow-md backdrop-blur-sm',
        'text-muted-foreground hover:text-foreground hover:bg-background transition-colors',
        className,
      )}
    >
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7-7-7" />
      </svg>
    </button>
  )
}
