'use client'

import type { UIMessage } from '@/lib/ai-elements-adapter'

interface PlanItem {
  id: string
  title: string
  status: string
}

export function AssistantRunPlanItems({ items }: { items: PlanItem[] }) {
  if (items.length === 0) return null

  return (
    <div className="my-2 rounded-lg border border-border/50 bg-muted/20 p-3 space-y-1.5">
      <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-2">Plan</div>
      {items.map((item) => (
        <div key={item.id} className="flex items-center gap-2 text-sm">
          <span className="shrink-0 w-4 text-center">
            {item.status === 'completed'
              ? '✓'
              : item.status === 'in_progress'
                ? '●'
                : item.status === 'cancelled'
                  ? '✗'
                  : '○'}
          </span>
          <span
            className={
              item.status === 'completed'
                ? 'text-muted-foreground line-through'
                : item.status === 'in_progress'
                  ? 'text-foreground font-medium'
                  : item.status === 'cancelled'
                    ? 'text-muted-foreground/50 line-through'
                    : 'text-foreground'
            }
          >
            {item.title}
          </span>
        </div>
      ))}
    </div>
  )
}

export type { UIMessage }
