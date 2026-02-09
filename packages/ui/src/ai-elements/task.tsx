'use client'

import * as React from 'react'
import { cn } from '../utils'

interface TaskProps {
  title: string
  status: 'pending' | 'in_progress' | 'completed' | 'failed'
  description?: string
  className?: string
  onClick?: () => void
}

export function Task({ title, status, description, className, onClick }: TaskProps) {
  const statusConfig = {
    pending: {
      icon: <span className="w-4 h-4 rounded-full border-2 border-muted-foreground/30" />,
      textClass: 'text-muted-foreground',
    },
    in_progress: {
      icon: (
        <span className="relative flex h-4 w-4">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary/40 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-4 w-4 border-2 border-primary/30 border-t-primary animate-spin"></span>
        </span>
      ),
      textClass: 'text-primary',
    },
    completed: {
      icon: (
        <span className="w-4 h-4 rounded-full bg-green-500 flex items-center justify-center">
          <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        </span>
      ),
      textClass: 'text-green-600',
    },
    failed: {
      icon: (
        <span className="w-4 h-4 rounded-full bg-red-500 flex items-center justify-center">
          <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </span>
      ),
      textClass: 'text-red-600',
    },
  }

  const config = statusConfig[status]
  const isClickable = Boolean(onClick)

  return (
    <div
      className={cn(
        'flex items-start gap-3 py-2 rounded-md transition-colors',
        isClickable && 'cursor-pointer hover:bg-muted/40 px-2 -mx-2',
        className,
      )}
      onClick={onClick}
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onKeyDown={isClickable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick?.() } } : undefined}
    >
      <div className="flex-shrink-0 mt-0.5">{config.icon}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className={cn('text-sm font-medium', config.textClass)}>{title}</p>
          {isClickable && (
            <svg className="w-3 h-3 text-muted-foreground/40 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          )}
        </div>
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
      </div>
    </div>
  )
}
