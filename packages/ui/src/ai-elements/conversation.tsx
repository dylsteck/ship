'use client'

import * as React from 'react'
import { cn } from '../utils'

interface ConversationProps {
  children: React.ReactNode
  className?: string
}

export function Conversation({ children, className }: ConversationProps) {
  return <div className={cn('flex flex-col gap-2', className)}>{children}</div>
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
