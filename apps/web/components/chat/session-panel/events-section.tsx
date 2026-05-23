'use client'

import { useState, useCallback, useMemo } from 'react'
import { cn } from '@ship/ui'
import { useEventsStore, eventsStore, type RawEvent } from '@/app/(app)/dashboard/hooks/use-events-store'

type EventCategory = 'all' | 'messages' | 'status' | 'errors'

function getEventDotColor(type: string): string {
  if (type === 'done' || type === 'session.idle') return 'bg-emerald-400'
  if (type.startsWith('message.')) return 'bg-blue-400'
  if (type === 'error' || type === 'session.error') return 'bg-red-400'
  if (type.startsWith('permission.') || type.startsWith('question.')) return 'bg-purple-400'
  if (type === 'status' || type === 'session.status' || type === 'heartbeat' || type === 'server.heartbeat') return 'bg-amber-400'
  return 'bg-muted-foreground/30'
}

function getEventCategory(type: string): EventCategory {
  if (type.startsWith('message.')) return 'messages'
  if (type === 'error' || type === 'session.error') return 'errors'
  if (type === 'status' || type === 'session.status' || type === 'heartbeat' || type === 'server.heartbeat' || type === 'done' || type === 'session.idle') return 'status'
  return 'all'
}

function formatRelativeTime(ts: number): string {
  const diff = Date.now() - ts
  if (diff < 1000) return 'now'
  if (diff < 60000) return `${Math.floor(diff / 1000)}s`
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m`
  return new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

function getPartType(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null
  const p = payload as Record<string, unknown>
  const props = p.properties as Record<string, unknown> | undefined
  if (!props) return null
  const part = props.part as Record<string, unknown> | undefined
  if (!part) return null
  return typeof part.type === 'string' ? part.type : null
}

function getPartAccumulatedText(payload: unknown): string {
  if (!payload || typeof payload !== 'object') return ''
  const p = payload as Record<string, unknown>
  const props = p.properties as Record<string, unknown> | undefined
  if (!props) return ''
  const part = props.part as Record<string, unknown> | undefined
  if (!part) return ''
  return typeof part.text === 'string' ? part.text : ''
}

function getToolName(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null
  const p = payload as Record<string, unknown>
  const props = p.properties as Record<string, unknown> | undefined
  if (!props) return null
  const part = props.part as Record<string, unknown> | undefined
  if (!part) return null
  if (part.type !== 'tool') return null
  const tool = part.tool
  if (typeof tool === 'string') return tool
  if (tool && typeof tool === 'object') {
    const t = tool as Record<string, unknown>
    return typeof t.name === 'string' ? t.name : null
  }
  return null
}

interface EventGroup {
  key: string
  partType: string | null
  events: RawEvent[]
  /** Last accumulated text (for reasoning/text groups) */
  finalText: string
  /** Tool name for tool groups */
  toolName: string | null
  startTimestamp: number
  endTimestamp: number
}

/** Collapse consecutive message.part.updated events with the same partType into groups */
function groupPartEvents(events: RawEvent[]): Array<EventGroup | RawEvent> {
  const result: Array<EventGroup | RawEvent> = []
  let i = 0
  while (i < events.length) {
    const ev = events[i]
    if (ev.type !== 'message.part.updated') {
      result.push(ev)
      i++
      continue
    }
    const partType = getPartType(ev.payload)
    const toolName = getToolName(ev.payload)
    const groupEvents: RawEvent[] = [ev]
    let j = i + 1
    while (j < events.length) {
      const next = events[j]
      if (next.type !== 'message.part.updated') break
      const nextPartType = getPartType(next.payload)
      const nextToolName = getToolName(next.payload)
      if (nextPartType !== partType) break
      // For tool events, group same tool together
      if (partType === 'tool' && nextToolName !== toolName) break
      groupEvents.push(next)
      j++
    }
    const last = groupEvents[groupEvents.length - 1]
    result.push({
      key: `group-${ev.id}`,
      partType,
      events: groupEvents,
      finalText: getPartAccumulatedText(last.payload),
      toolName,
      startTimestamp: ev.timestamp,
      endTimestamp: last.timestamp,
    })
    i = j
  }
  return result
}

const PART_TYPE_COLOR: Record<string, string> = {
  reasoning: 'text-purple-400/80',
  text: 'text-blue-400/80',
  tool: 'text-amber-400/80',
  'tool-invocation': 'text-amber-400/80',
  'tool-result': 'text-emerald-400/80',
  'step-finish': 'text-muted-foreground/50',
}

const PART_DOT_COLOR: Record<string, string> = {
  reasoning: 'bg-purple-400',
  text: 'bg-blue-400',
  tool: 'bg-amber-400',
  'tool-invocation': 'bg-amber-400',
  'tool-result': 'bg-emerald-400',
  'step-finish': 'bg-muted-foreground/30',
}

function GroupRow({ group }: { group: EventGroup }) {
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

function getEventLabel(type: string): string {
  switch (type) {
    case 'session.status': return 'Status'
    case 'session.idle': return 'Idle'
    case 'session.error': return 'Error'
    case 'session.updated': return 'Session Updated'
    case 'session.diff': return 'Diff'
    case 'server.heartbeat': return 'Heartbeat'
    case 'heartbeat': return 'Heartbeat'
    case 'status': return 'Status'
    case 'done': return 'Done'
    case 'error': return 'Error'
    case 'agent-session': return 'Agent Session'
    case 'agent-url': return 'Agent URL'
    case 'todo.updated': return 'Todos'
    case 'permission.asked': return 'Permission'
    case 'permission.granted': return 'Granted'
    case 'permission.denied': return 'Denied'
    case 'question.asked': return 'Question'
    case 'question.replied': return 'Replied'
    default: return type
  }
}

function extractStatusPreview(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null
  const p = payload as Record<string, unknown>
  if (typeof p.message === 'string') return p.message
  if (typeof p.status === 'string') return p.status
  if (typeof p.error === 'string') return p.error.slice(0, 80)
  const props = p.properties as Record<string, unknown> | undefined
  if (props) {
    if (typeof props.message === 'string') return props.message
    const info = props.info as Record<string, unknown> | undefined
    if (info && typeof info.title === 'string') return `Title: ${info.title}`
  }
  return null
}

function SingleEventRow({ event }: { event: RawEvent }) {
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

const FILTER_TABS: { id: EventCategory; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'messages', label: 'Messages' },
  { id: 'status', label: 'Status' },
  { id: 'errors', label: 'Errors' },
]

export function EventsSection({ sessionId, messageCount = 0 }: { sessionId: string; messageCount?: number }) {
  const events = useEventsStore(sessionId)
  const [collapsed, setCollapsed] = useState(false)
  const [filter, setFilter] = useState<EventCategory>('all')

  const filteredEvents = useMemo(() => {
    if (filter === 'all') return events
    return events.filter(e => getEventCategory(e.type) === filter)
  }, [events, filter])

  const grouped = useMemo(() => groupPartEvents(filteredEvents), [filteredEvents])

  const handleCopyAll = useCallback(() => {
    const text = JSON.stringify(events.map(e => ({ type: e.type, timestamp: e.timestamp, payload: e.payload })), null, 2)
    navigator.clipboard.writeText(text)
  }, [events])

  const handleClear = useCallback(() => {
    eventsStore.clearEvents(sessionId)
  }, [sessionId])

  // Count distinct event groups for the badge (not raw event count)
  const displayCount = events.length

  return (
    <div className="px-3 py-2">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center justify-between w-full py-1.5"
      >
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground/70">Events</span>
          {displayCount > 0 && (
            <span className="text-[10px] text-muted-foreground/40 font-mono tabular-nums">
              {displayCount}
            </span>
          )}
        </div>
        <svg
          className={cn('size-3 text-muted-foreground/30 transition-transform duration-150', !collapsed && 'rotate-180')}
          fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {!collapsed && (
        <div className="mt-1.5 space-y-1.5">
          {/* Filter tabs + actions */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-0.5 p-0.5">
              {FILTER_TABS.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setFilter(tab.id)}
                  className={cn(
                    'px-2 py-0.5 text-[10px] rounded transition-colors',
                    filter === tab.id
                      ? 'text-foreground/80 bg-muted/30'
                      : 'text-muted-foreground/35 hover:text-muted-foreground/60',
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            {events.length > 0 && (
              <div className="flex items-center gap-0.5">
                <button
                  onClick={handleCopyAll}
                  className="text-[10px] text-muted-foreground/30 hover:text-muted-foreground/60 transition-colors px-1.5 py-0.5 rounded"
                >
                  Copy
                </button>
                <button
                  onClick={handleClear}
                  className="text-[10px] text-muted-foreground/30 hover:text-muted-foreground/60 transition-colors px-1.5 py-0.5 rounded"
                >
                  Clear
                </button>
              </div>
            )}
          </div>

          {/* Event list */}
          <div className="space-y-px">
            {grouped.length === 0 ? (
              <div className="py-6 text-center">
                <p className="text-[11px] text-muted-foreground/30">
                  {events.length === 0
                    ? messageCount > 0
                      ? 'Events stream during live sessions'
                      : 'No events yet'
                    : 'No matching events'}
                </p>
              </div>
            ) : (
              grouped.map((item) => {
                if ('events' in item) {
                  return <GroupRow key={item.key} group={item} />
                }
                return <SingleEventRow key={item.id} event={item} />
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
