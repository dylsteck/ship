'use client'

import * as React from 'react'
import { cn } from '../utils'
import { Shimmer } from './shimmer'

interface LoaderProps {
  message?: string
  progress?: number
  className?: string
}

export function Loader({ message = 'Loading...', progress, className }: LoaderProps) {
  const isThinking = message.toLowerCase().includes('thinking')
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div className="flex items-center gap-3">
        {!isThinking && (
          <div className="relative flex h-4 w-4">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary/40 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-4 w-4 border-2 border-primary/30 border-t-primary animate-spin"></span>
          </div>
        )}
        {isThinking ? (
          <Shimmer className="text-sm">{message}</Shimmer>
        ) : (
          <span className="text-sm text-muted-foreground">{message}</span>
        )}
      </div>
      {progress !== undefined && (
        <div className="w-full h-1 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
          />
        </div>
      )}
    </div>
  )
}
