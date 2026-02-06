'use client'

import * as React from 'react'
import { cn } from '../utils'

interface ResponseProps {
  children: React.ReactNode
  className?: string
}

export function Response({ children, className }: ResponseProps) {
  return <div className={cn('max-w-none', className)}>{children}</div>
}
