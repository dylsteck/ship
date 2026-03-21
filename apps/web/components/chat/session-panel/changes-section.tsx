'use client'

import { useMemo } from 'react'
import { cn, Badge } from '@ship/ui'
import type { DiffSummary } from './types'

export function ChangesSection({ diffs }: { diffs: DiffSummary[] }) {
  const totalChanges = useMemo(() => {
    if (!diffs || diffs.length === 0) return null
    return diffs.reduce(
      (acc, d) => ({ add: acc.add + d.additions, del: acc.del + d.deletions }),
      { add: 0, del: 0 },
    )
  }, [diffs])

  if (!diffs || diffs.length === 0 || !totalChanges) return null

  return (
    <div className="px-3 py-2">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-muted-foreground">Changes</span>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-mono text-green-500">+{totalChanges.add}</span>
          <span className="text-[10px] font-mono text-red-500">-{totalChanges.del}</span>
          <Badge variant="secondary" className="text-[10px] h-4 px-1.5 font-mono ml-1">
            {diffs.length}
          </Badge>
        </div>
      </div>
      <div className="space-y-0.5">
        {diffs.slice(0, 6).map((d, i) => (
          <div key={i} className="flex items-center justify-between gap-2 py-1 px-1.5 rounded-sm hover:bg-muted/15 transition-colors">
            <span className="text-[11px] font-mono text-muted-foreground/70 truncate flex-1">
              {(d.filename || '').split('/').pop() || 'unknown'}
            </span>
            <div className="flex items-center gap-1.5 shrink-0 text-[10px] font-mono">
              <span className="text-green-500/70">+{d.additions}</span>
              <span className="text-red-500/70">-{d.deletions}</span>
            </div>
          </div>
        ))}
        {diffs.length > 6 && (
          <p className="text-[10px] text-muted-foreground/30 px-1.5 mt-1">+{diffs.length - 6} more files</p>
        )}
      </div>
    </div>
  )
}
