'use client'

import * as React from 'react'
import { cn } from '../utils'

interface ShimmerProps {
  children: React.ReactNode
  className?: string
}

/**
 * Shimmer wrapper for streaming/loading text.
 * Applies animated gradient sweep effect (like AI SDK Elements).
 * Uses .shimmer-text class from app globals.css for the animation.
 */
export function Shimmer({ children, className }: ShimmerProps) {
  return <span className={cn('shimmer-text', className)}>{children}</span>
}
