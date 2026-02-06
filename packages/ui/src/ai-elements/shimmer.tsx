'use client'

import * as React from 'react'
import { cn } from '../utils'

interface ShimmerProps {
  children: React.ReactNode
  className?: string
}

/**
 * Shimmer wrapper for streaming content.
 * Purely structural — no background effect to avoid visible artifacts.
 */
export function Shimmer({ children, className }: ShimmerProps) {
  return <div className={cn(className)}>{children}</div>
}
