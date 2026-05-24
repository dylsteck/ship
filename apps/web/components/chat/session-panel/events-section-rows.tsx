'use client'

import { useState } from 'react'
import { cn } from '@ship/ui'
import type { RawEvent } from '@/app/(app)/dashboard/hooks/use-events-store'
import {
  type EventGroup,
  PART_DOT_COLOR,
  PART_TYPE_COLOR,
  formatRelativeTime,
  getEventDotColor,
  getEventLabel,
  extractStatusPreview,
} from './events-section-utils'

export function GroupRow({ group }: { group: EventGroup }) {
  const [expanded, setExpanded] = useState(false)
  const count = group.events.length
  const dotColor = group.partType ? (PART_DOT_COLOR[group.partType] ?? 'bg-blue-400') : 'bg-blue-400'
  const labelColor = group.partType ? (PART_TYPE_COLOR[group.partType] ?? 'text-muted-foreground/70') : 'text-muted-foreground/70'

  let label = group.partType ?? 'Part Updated'
  if (label === 'reasoning') label = 'Reasoning'
  else if (label === 'text') label = 'Text'
  else if (label === 'tool' || label === 'tool-invocation') label = group.toolName ? `Tool: ${group.toolName}` : 'Tool'
  else if (label === 'tool-result') label = 'Tool Result'
  else if (label === 'step-finish') label = 'Step'

  const preview = group.finalText ? group.finalText.slice(-120) : null

  return (
    <div className={cn('rounded transition-colors', expanded && 'bg-muted/8')}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 w-full px-2.5 py-1.5 text-left group"
      >
        <span className={cn('w-1 h-1 rounded-full shrink-0', dotColor)} />
        <span className={cn('text-[11px] shrink-0', labelColor)}>{label}</span>
        <span className="text-[10px] text-muted-foreground/25 font-mono tabular-nums shrink-0">×{count}</span>
        {!expanded && preview && (
          <span className="text-[10px] text-muted-foreground/30 truncate flex-1 min-w-0">{preview}</span>
        )}
        <span className="text-[10px] text-muted-foreground/25 tabular-nums shrink-0 ml-auto">
          {formatRelativeTime(group.endTimestamp)}
        </span>
        <svg
          className={cn(
            'size-2.5 text-muted-foreground/15 shrink-0 transition-transform duration-150 opacity-0 group-hover:opacity-100',
            expanded && 'rotate-90 opacity-100',
          )}
          fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"
        >
          <path d="m9 18 6-6-6-6" />
        </svg>
      </button>
      {expanded && group.finalText && (
        <div className="px-2.5 pb-2">
          <div className="ml-3 pl-2 border-l border-border/10">
            <p className="text-[11px] text-foreground/60 leading-relaxed bg-muted/10 rounded px-2 py-1.5 break-words max-h-48 overflow-y-auto whitespace-pre-wrap">
              {group.finalText}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

export function SingleEventRow({ event }: { event: RawEvent }) {
  const [expanded, setExpanded] = useState(false)
  const dotColor = getEventDotColor(event.type)
  const label = getEventLabel(event.type)
  const preview = extractStatusPreview(event.payload)

  return (
    <div className={cn('rounded transition-colors', expanded && 'bg-muted/8')}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 w-full px-2.5 py-1.5 text-left group"
      >
        <span className={cn('w-1 h-1 rounded-full shrink-0', dotColor)} />
        <span className="text-[11px] text-muted-foreground/70 shrink-0">{label}</span>
        {!expanded && preview && (
          <span className="text-[10px] text-muted-foreground/35 truncate flex-1 min-w-0">{preview}</span>
        )}
        <span className="text-[10px] text-muted-foreground/25 tabular-nums shrink-0 ml-auto">
          {formatRelativeTime(event.timestamp)}
        </span>
        <svg
          className={cn(
            'size-2.5 text-muted-foreground/15 shrink-0 transition-transform duration-150 opacity-0 group-hover:opacity-100',
            expanded && 'rotate-90 opacity-100',
          )}
          fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"
        >
          <path d="m9 18 6-6-6-6" />
        </svg>
      </button>
      {expanded && (
        <div className="px-2.5 pb-2">
          <div className="ml-3 pl-2 border-l border-border/10">
            <pre className="text-[10px] font-mono text-muted-foreground/60 bg-muted/10 rounded px-2 py-1.5 max-h-48 overflow-y-auto leading-relaxed whitespace-pre-wrap break-all">
              {JSON.stringify(event.payload, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  )
}
