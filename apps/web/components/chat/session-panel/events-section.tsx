'use client'

import { useState, useCallback, useMemo } from 'react'
import { cn } from '@ship/ui/utils'
import { useEventsStore, eventsStore, type RawEvent } from '@/app/(app)/dashboard/hooks/use-events-store'

type EventCategory = 'all' | 'messages' | 'status' | 'errors'

function getEventColor(type: string): string {
  if (type === 'done' || type === 'session.idle') return 'text-green-400'
  if (type.startsWith('message.')) return 'text-blue-400'
  if (type === 'error' || type === 'session.error') return 'text-red-400'
  if (type.startsWith('permission.') || type.startsWith('question.')) return 'text-purple-400'
  if (type === 'status' || type === 'session.status' || type === 'heartbeat' || type === 'server.heartbeat') return 'text-yellow-400'
  return 'text-muted-foreground/60'
}

function getEventBgColor(type: string): string {
  if (type === 'done' || type === 'session.idle') return 'border-green-500/20 bg-green-500/5'
  if (type.startsWith('message.')) return 'border-blue-500/20 bg-blue-500/5'
  if (type === 'error' || type === 'session.error') return 'border-red-500/20 bg-red-500/5'
  if (type.startsWith('permission.') || type.startsWith('question.')) return 'border-purple-500/20 bg-purple-500/5'
  if (type === 'status' || type === 'session.status' || type === 'heartbeat' || type === 'server.heartbeat') return 'border-yellow-500/20 bg-yellow-500/5'
  return 'border-border/20 bg-muted/5'
}

function getEventCategory(type: string): EventCategory {
  if (type.startsWith('message.')) return 'messages'
  if (type === 'error' || type === 'session.error') return 'errors'
  if (type === 'status' || type === 'session.status' || type === 'heartbeat' || type === 'server.heartbeat' || type === 'done' || type === 'session.idle') return 'status'
  return 'all'
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' })
}

function formatRelativeTime(ts: number): string {
  const diff = Date.now() - ts
  if (diff < 1000) return 'just now'
  if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  return formatTime(ts)
}

function extractPreview(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null
  const p = payload as Record<string, unknown>
  // Try common fields for a preview
  if (typeof p.content === 'string') return p.content.slice(0, 120)
  if (typeof p.text === 'string') return p.text.slice(0, 120)
  if (typeof p.message === 'string') return p.message.slice(0, 120)
  if (typeof p.status === 'string') return p.status
  if (typeof p.error === 'string') return p.error.slice(0, 120)
  if (typeof p.role === 'string') {
    const content = typeof p.content === 'string' ? p.content.slice(0, 100) : null
    return content ? `${p.role}: ${content}` : p.role as string
  }
  // For tool calls
  if (typeof p.toolName === 'string') return `Tool: ${p.toolName}`
  if (typeof p.name === 'string') return p.name as string
  return null
}

function EventCard({ event }: { event: RawEvent }) {
  const [expanded, setExpanded] = useState(false)
  const preview = useMemo(() => extractPreview(event.payload), [event.payload])

  return (
    <div
      className={cn(
        'rounded-lg border p-3 transition-colors cursor-pointer hover:bg-muted/20',
        getEventBgColor(event.type),
      )}
      onClick={() => setExpanded(!expanded)}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className={cn('text-xs font-mono font-medium', getEventColor(event.type))}>
            {event.type}
          </span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-[10px] text-muted-foreground/40 tabular-nums">
            {formatRelativeTime(event.timestamp)}
          </span>
          <svg
            className={cn('size-3.5 text-muted-foreground/30 transition-transform', expanded && 'rotate-90')}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            viewBox="0 0 24 24"
          >
            <path d="m9 18 6-6-6-6" />
          </svg>
        </div>
      </div>

      {preview && !expanded && (
        <p className="mt-1.5 text-[11px] text-muted-foreground/50 truncate leading-relaxed">
          {preview}
        </p>
      )}

      {expanded && (
        <pre className="mt-2 p-2.5 text-[10px] font-mono text-muted-foreground/70 bg-background/60 rounded-md overflow-x-auto max-h-64 overflow-y-auto border border-border/10 leading-relaxed">
          {JSON.stringify(event.payload, null, 2)}
        </pre>
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

export function EventsSection({ sessionId }: { sessionId: string }) {
  const events = useEventsStore(sessionId)
  const [collapsed, setCollapsed] = useState(true)
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
    <div className="px-3 py-2 border-t border-border/10">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center justify-between w-full py-1"
      >
        <span className="text-[11px] font-medium text-muted-foreground/60">
          Events{events.length > 0 ? ` (${events.length})` : ''}
        </span>
        <svg
          className={cn('size-3.5 text-muted-foreground/40 transition-transform', !collapsed && 'rotate-180')}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          viewBox="0 0 24 24"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {!collapsed && (
        <div className="mt-2 space-y-2">
          {/* Filter tabs + actions */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-0.5 bg-muted/30 rounded-md p-0.5">
              {FILTER_TABS.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setFilter(tab.id)}
                  className={cn(
                    'px-2 py-0.5 text-[10px] rounded transition-colors',
                    filter === tab.id
                      ? 'bg-background text-foreground shadow-sm font-medium'
                      : 'text-muted-foreground/50 hover:text-foreground',
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            {events.length > 0 && (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopyAll}
                  className="text-[10px] text-muted-foreground/40 hover:text-foreground transition-colors"
                >
                  Copy
                </button>
                <button
                  onClick={handleClear}
                  className="text-[10px] text-muted-foreground/40 hover:text-foreground transition-colors"
                >
                  Clear
                </button>
              </div>
            )}
          </div>

          {/* Event cards */}
          <div className="space-y-1.5 max-h-[400px] overflow-y-auto pr-0.5">
            {filteredEvents.length === 0 ? (
              <div className="py-6 text-[11px] text-muted-foreground/30 text-center rounded-lg border border-dashed border-border/20">
                {events.length === 0 ? 'No events yet' : 'No matching events'}
              </div>
            ) : (
              filteredEvents.map((event) => <EventCard key={event.id} event={event} />)
            )}
          </div>
        </div>
      )}
    </div>
  )
}
