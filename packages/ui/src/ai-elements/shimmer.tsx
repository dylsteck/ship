'use client'

import * as React from 'react'
import { cn } from '../utils'

interface ShimmerProps {
  children: React.ReactNode
  className?: string
}

export function Shimmer({ children, className }: ShimmerProps) {
  return (
    <div className={cn('relative overflow-hidden', className)}>
      <span className="relative z-10">{children}</span>
      <span className="absolute inset-0 z-0 bg-gradient-to-r from-transparent via-primary/5 to-transparent animate-shimmer" />
    </div>
  )
}
