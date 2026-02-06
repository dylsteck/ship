import * as React from 'react'
import { cn } from '../utils'

interface MessageProps {
  role: 'user' | 'assistant' | 'system'
  children: React.ReactNode
  avatar?: React.ReactNode
  className?: string
}

export function Message({ role, children, avatar, className }: MessageProps) {
  if (role === 'system') {
    return (
      <div className={cn('px-4 py-2', className)}>
        {children}
      </div>
    )
  }

  return (
    <div className={cn('flex gap-3 px-4 py-4', className)}>
      {role === 'assistant' && <div className="flex-shrink-0 w-8 h-8" />}
      <div className={cn('flex-1 min-w-0', role === 'user' && 'flex justify-end')}>
        <div
          className={cn(
            'inline-block rounded-2xl px-4 py-2.5 max-w-[85%]',
            role === 'user'
              ? 'bg-secondary text-secondary-foreground'
              : 'bg-transparent',
          )}
        >
          {children}
        </div>
      </div>
    </div>
  )
}
