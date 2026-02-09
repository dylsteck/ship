'use client'

import { cn } from '@ship/ui/utils'
import type { TokenInfo } from './types'

export function ContextBreakdownBar({ tokens }: { tokens: TokenInfo }) {
  const total = tokens.input + tokens.output + tokens.reasoning + tokens.cache.read + tokens.cache.write
  if (total === 0) return null

  const segments = [
    { label: 'Input', value: tokens.input, color: 'bg-green-500/70' },
    { label: 'Output', value: tokens.output, color: 'bg-pink-500/70' },
    { label: 'Reasoning', value: tokens.reasoning, color: 'bg-blue-500/70' },
    { label: 'Cache', value: tokens.cache.read + tokens.cache.write, color: 'bg-yellow-500/70' },
  ].filter((s) => s.value > 0)

  return (
    <div className="space-y-1.5">
      <div className="flex h-2 w-full rounded-full overflow-hidden bg-muted/30">
        {segments.map((seg) => (
          <div
            key={seg.label}
            className={cn('h-full transition-all', seg.color)}
            style={{ width: `${(seg.value / total) * 100}%` }}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-0.5">
        {segments.map((seg) => (
          <div key={seg.label} className="flex items-center gap-1">
            <div className={cn('w-1.5 h-1.5 rounded-full', seg.color)} />
            <span className="text-[9px] text-muted-foreground/50">
              {seg.label} {Math.round((seg.value / total) * 100)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
