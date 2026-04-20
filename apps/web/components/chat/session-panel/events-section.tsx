'use client'

import { useState, useCallback, useMemo } from 'react'
import { cn, Badge } from '@ship/ui'
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

/** Friendly short label for event types */
function getEventLabel(type: string): string {
  switch (type) {
    case 'message.part.updated': return 'Part Updated'
    case 'message.created': return 'Message Created'
    case 'message.updated': return 'Message Updated'
    case 'message.completed': return 'Message Done'
    case 'session.status': return 'Status'
    case 'session.idle': return 'Idle'
    case 'session.error': return 'Error'
    case 'server.heartbeat': return 'Heartbeat'
    case 'heartbeat': return 'Heartbeat'
    case 'status': return 'Status'
    case 'done': return 'Done'
    case 'error': return 'Error'
    case 'agent-session': return 'Agent Session'
    default: return type
  }
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

function extractPreview(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null
  const p = payload as Record<string, unknown>
  if (typeof p.content === 'string') return p.content.slice(0, 100)
  if (typeof p.text === 'string') return p.text.slice(0, 100)
  if (typeof p.message === 'string') return p.message.slice(0, 100)
  if (typeof p.status === 'string') return p.status
  if (typeof p.error === 'string') return p.error.slice(0, 100)
  if (typeof p.role === 'string') {
    const content = typeof p.content === 'string' ? p.content.slice(0, 80) : null
    return content ? `${p.role}: ${content}` : p.role as string
  }
  if (typeof p.toolName === 'string') return p.toolName as string
  if (typeof p.name === 'string') return p.name as string
  if (typeof p.properties === 'object' && p.properties) {
    const props = p.properties as Record<string, unknown>
    if (typeof props.part === 'object' && props.part) {
      const part = props.part as Record<string, unknown>
      if (typeof part.type === 'string') {
        const text = typeof part.text === 'string' ? part.text.slice(0, 60) : null
        return text ? `${part.type}: ${text}` : part.type as string
      }
    }
    if (typeof props.delta === 'string') return props.delta.slice(0, 80)
  }
  return null
}

/** Renders a key-value pair as a clean row */
function DetailRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start gap-2 py-1">
      <span className="text-[10px] text-muted-foreground/50 shrink-0 min-w-[52px]">{label}</span>
      <span className={cn(
        'text-[11px] text-foreground/70 break-all leading-relaxed',
        mono && 'font-mono text-[10px]',
      )}>
        {value}
      </span>
    </div>
  )
}

/** Renders structured payload detail */
function PayloadDetail({ payload, eventType }: { payload: unknown; eventType: string }) {
  if (!payload || typeof payload !== 'object') return null
  const p = payload as Record<string, unknown>

  if (eventType === 'message.part.updated' && typeof p.properties === 'object' && p.properties) {
    const props = p.properties as Record<string, unknown>
    const part = typeof props.part === 'object' && props.part ? props.part as Record<string, unknown> : null
    const delta = typeof props.delta === 'string' ? props.delta : null

    return (
      <div className="space-y-0.5">
        {typeof part?.type === 'string' && <DetailRow label="Type" value={part.type} />}
        {typeof part?.id === 'string' && <DetailRow label="Part ID" value={part.id} mono />}
        {delta && (
          <div className="py-1">
            <span className="text-[10px] text-muted-foreground/50 block mb-1">Delta</span>
            <p className="text-[11px] text-foreground/60 leading-relaxed bg-muted/10 rounded px-2 py-1.5 break-words">
              {delta}
            </p>
          </div>
        )}
        {typeof part?.text === 'string' && part.text.length > 0 && !delta && (
          <div className="py-1">
            <span className="text-[10px] text-muted-foreground/50 block mb-1">Content</span>
            <p className="text-[11px] text-foreground/60 leading-relaxed bg-muted/10 rounded px-2 py-1.5 break-words max-h-32 overflow-y-auto">
              {String(part.text)}
            </p>
          </div>
        )}
      </div>
    )
  }

  if (typeof p.toolName === 'string') {
    return (
      <div className="space-y-0.5">
        <DetailRow label="Tool" value={p.toolName as string} />
        {p.args != null && typeof p.args === 'object' && (
          <div className="py-1">
            <span className="text-[10px] text-muted-foreground/50 block mb-1">Args</span>
            <pre className="text-[10px] font-mono text-muted-foreground/60 bg-muted/10 rounded px-2 py-1.5 max-h-40 overflow-y-auto leading-relaxed whitespace-pre-wrap break-all">
              {JSON.stringify(p.args, null, 2)}
            </pre>
          </div>
        )}
        {(typeof p.result === 'string' || (p.result != null && typeof p.result === 'object')) && (
          <div className="py-1">
            <span className="text-[10px] text-muted-foreground/50 block mb-1">Result</span>
            <pre className="text-[10px] font-mono text-muted-foreground/60 bg-muted/10 rounded px-2 py-1.5 max-h-40 overflow-y-auto leading-relaxed whitespace-pre-wrap break-all">
              {typeof p.result === 'string' ? p.result : JSON.stringify(p.result, null, 2)}
            </pre>
          </div>
        )}
      </div>
    )
  }

  if (typeof p.role === 'string') {
    return (
      <div className="space-y-0.5">
        <DetailRow label="Role" value={p.role as string} />
        {typeof p.content === 'string' && p.content && (
          <div className="py-1">
            <span className="text-[10px] text-muted-foreground/50 block mb-1">Content</span>
            <p className="text-[11px] text-foreground/60 leading-relaxed bg-muted/10 rounded px-2 py-1.5 break-words max-h-40 overflow-y-auto">
              {p.content as string}
            </p>
          </div>
        )}
      </div>
    )
  }

  if (typeof p.error === 'string') {
    return (
      <div className="py-1">
        <p className="text-[11px] text-red-400/80 leading-relaxed bg-red-500/5 rounded px-2 py-1.5 break-words">
          {p.error as string}
        </p>
      </div>
    )
  }

  if (typeof p.status === 'string' && Object.keys(p).length <= 3) {
    return <DetailRow label="Status" value={p.status as string} />
  }

  return (
    <pre className="text-[10px] font-mono text-muted-foreground/60 bg-muted/10 rounded px-2 py-1.5 max-h-48 overflow-y-auto leading-relaxed whitespace-pre-wrap break-all">
      {JSON.stringify(payload, null, 2)}
    </pre>
  )
}

/** Extract the part type from a message.part.updated event payload */
function getPartType(event: RawEvent): string | null {
  if (event.type !== 'message.part.updated') return null
  const payload = event.payload as Record<string, unknown> | null
  if (!payload || typeof payload !== 'object') return null
  const props = payload.properties as Record<string, unknown> | undefined
  if (!props || typeof props !== 'object') return null
  const part = props.part as Record<string, unknown> | undefined
  if (!part || typeof part !== 'object') return null
  return typeof part.type === 'string' ? part.type : null
}

const PART_TYPE_STYLES: Record<string, string> = {
  reasoning: 'text-purple-400/70 border-purple-500/15',
  tool: 'text-amber-400/70 border-amber-500/15',
  text: 'text-blue-400/70 border-blue-500/15',
  'tool-invocation': 'text-amber-400/70 border-amber-500/15',
  'tool-result': 'text-emerald-400/70 border-emerald-500/15',
  source: 'text-cyan-400/70 border-cyan-500/15',
  file: 'text-orange-400/70 border-orange-500/15',
}

function EventRow({ event }: { event: RawEvent }) {
  const [expanded, setExpanded] = useState(false)
  const dotColor = getEventDotColor(event.type)
  const label = getEventLabel(event.type)
  const preview = useMemo(() => extractPreview(event.payload), [event.payload])
  const partType = useMemo(() => getPartType(event), [event])

  return (
    <div className={cn('rounded transition-colors', expanded && 'bg-muted/8')}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 w-full px-2.5 py-1.5 text-left group"
      >
        <span className={cn('w-1 h-1 rounded-full shrink-0', dotColor)} />
        <span className="text-[11px] text-muted-foreground/70 shrink-0">
          {label}
        </span>
        {partType && (
          <Badge
            variant="outline"
            className={cn(
              'text-[9px] h-[18px] px-1.5 font-mono font-normal border bg-transparent',
              PART_TYPE_STYLES[partType] || 'text-muted-foreground/50 border-border/15',
            )}
          >
            {partType}
          </Badge>
        )}
        {!partType && preview && !expanded && (
          <span className="text-[10px] text-muted-foreground/30 truncate flex-1 min-w-0">
            {preview}
          </span>
        )}
        <span className="text-[10px] text-muted-foreground/25 tabular-nums shrink-0 ml-auto">
          {formatRelativeTime(event.timestamp)}
        </span>
        <svg
          className={cn(
            'size-2.5 text-muted-foreground/15 shrink-0 transition-transform duration-150 opacity-0 group-hover:opacity-100',
            expanded && 'rotate-90 opacity-100',
          )}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          viewBox="0 0 24 24"
        >
          <path d="m9 18 6-6-6-6" />
        </svg>
      </button>

      {expanded && (
        <div className="px-2.5 pb-2">
          <div className="ml-3 pl-2 border-l border-border/10">
            <PayloadDetail payload={event.payload} eventType={event.type} />
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

  const handleCopyAll = useCallback(() => {
    const text = JSON.stringify(events.map(e => ({ type: e.type, timestamp: e.timestamp, payload: e.payload })), null, 2)
    navigator.clipboard.writeText(text)
  }, [events])

  const handleClear = useCallback(() => {
    eventsStore.clearEvents(sessionId)
  }, [sessionId])

  return (
    <div className="px-3 py-2">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center justify-between w-full py-1.5"
      >
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground/70">Events</span>
          {events.length > 0 && (
            <span className="text-[10px] text-muted-foreground/40 font-mono tabular-nums">
              {events.length}
            </span>
          )}
        </div>
        <svg
          className={cn('size-3 text-muted-foreground/30 transition-transform duration-150', !collapsed && 'rotate-180')}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          viewBox="0 0 24 24"
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
            {filteredEvents.length === 0 ? (
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
              filteredEvents.map((event) => <EventRow key={event.id} event={event} />)
            )}
          </div>
        </div>
      )}
    </div>
  )
}
