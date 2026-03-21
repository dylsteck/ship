'use client'

import { cn } from '@ship/ui/utils'
import type { TokenInfo } from './types'

interface SessionActionsSectionProps {
  tokens?: TokenInfo
  sessionCreatedAt?: number
}

export function SessionActionsSection({ tokens }: SessionActionsSectionProps) {
  const totalTokens = tokens ? tokens.input + tokens.output + tokens.reasoning : 0
  const contextLimit = tokens?.contextLimit || 200000
  const usagePercent = tokens ? (totalTokens / contextLimit) * 100 : 0

  if (usagePercent < 75) return null

  return (
    <div className="px-3 py-2">
      <div className={cn(
        'text-[11px] font-medium px-3 py-2 rounded-md border',
        usagePercent >= 90
          ? 'bg-red-500/5 text-red-500 border-red-500/20'
          : 'bg-yellow-500/5 text-yellow-600 dark:text-yellow-500 border-yellow-500/20',
      )}>
        Context {usagePercent >= 95 ? 'nearly full' : 'getting full'} ({usagePercent.toFixed(0)}%)
      </div>
    </div>
  )
}
