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
      <div className={cn('py-2', className)}>
        {children}
      </div>
    )
  }

  if (role === 'user') {
    return (
      <div className={cn('flex justify-end py-3', className)}>
        <div className="inline-block rounded-2xl bg-secondary text-secondary-foreground px-4 py-2.5 max-w-[85%]">
          {children}
        </div>
      </div>
    )
  }

  // Assistant — flush left, no wrapper padding, no ghost avatar
  return (
    <div className={cn('py-3', className)}>
      {children}
    </div>
  )
}
