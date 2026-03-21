import * as React from 'react'
import { cn } from '../utils'

interface MessageProps {
  role: 'user' | 'assistant' | 'system'
  children: React.ReactNode
  avatar?: React.ReactNode
  className?: string
}

export function Message({ role, children, className }: MessageProps) {
  if (role === 'system') {
    return (
      <div className={cn('py-3', className)}>
        {children}
      </div>
    )
  }

  if (role === 'user') {
    return (
      <div className={cn('py-3', className)}>
        <div className="w-full rounded-full border border-border/50 bg-secondary/30 text-secondary-foreground px-4 py-2">
          <div className="text-sm">{children}</div>
        </div>
      </div>
    )
  }

  // Assistant — flush left, no wrapper padding
  return (
    <div className={cn('py-4 space-y-3', className)}>
      {children}
    </div>
  )
}
