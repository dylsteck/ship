'use client'

import * as React from 'react'
import { cn } from '../utils'
import { useStickToBottom } from 'use-stick-to-bottom'

interface ConversationProps {
  children: React.ReactNode
  className?: string
}

export function Conversation({ children, className }: ConversationProps) {
  const { scrollRef, contentRef, isAtBottom, scrollToBottom } = useStickToBottom()

  return (
    <ConversationContext.Provider value={{ isAtBottom, scrollToBottom }}>
      <div ref={scrollRef} className={cn('relative flex-1 overflow-y-auto', className)}>
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
      onClick={scrollToBottom}
      className={cn(
        'fixed bottom-32 left-1/2 -translate-x-1/2 z-20',
        'flex items-center gap-1.5 px-3 py-1.5 rounded-full',
        'bg-background/95 border border-border shadow-lg backdrop-blur-sm',
        'text-xs text-muted-foreground hover:text-foreground transition-colors',
        className,
      )}
    >
      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
      </svg>
      Scroll to bottom
    </button>
  )
}
