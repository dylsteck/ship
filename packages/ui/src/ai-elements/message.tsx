import * as React from 'react'
import { cn } from '../utils'

interface MessageProps {
  role: 'user' | 'assistant'
  children: React.ReactNode
  avatar?: React.ReactNode
  className?: string
}

export function Message({ role, children, avatar, className }: MessageProps) {
  return (
    <div className={cn('flex gap-3 px-4 py-4', role === 'user' ? 'flex-row' : 'flex-row', className)}>
      {role === 'user' && avatar && (
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
          {avatar}
        </div>
      )}
      {role === 'assistant' && <div className="flex-shrink-0 w-8 h-8" />}
      <div className={cn('flex-1 min-w-0', role === 'user' && 'text-right')}>
        <div
          className={cn(
            'inline-block rounded-2xl px-4 py-2.5',
            role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-transparent',
          )}
        >
          {children}
        </div>
      </div>
    </div>
  )
}
