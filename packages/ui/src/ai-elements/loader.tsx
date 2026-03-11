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
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div className="flex items-center gap-3">
        <Shimmer className="text-sm">{message}</Shimmer>
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
