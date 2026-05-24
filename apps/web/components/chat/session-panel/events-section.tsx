'use client'

import { useState, useCallback, useMemo } from 'react'
import { cn } from '@ship/ui'
import { useEventsStore, eventsStore } from '@/app/(app)/dashboard/hooks/use-events-store'
import { type EventCategory, getEventCategory, groupPartEvents } from './events-section-utils'
import { GroupRow, SingleEventRow } from './events-section-rows'

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
    return events.filter((e) => getEventCategory(e.type) === filter)
  }, [events, filter])

  const grouped = useMemo(() => groupPartEvents(filteredEvents), [filteredEvents])

  const handleCopyAll = useCallback(() => {
    const text = JSON.stringify(events.map((e) => ({ type: e.type, timestamp: e.timestamp, payload: e.payload })), null, 2)
    navigator.clipboard.writeText(text)
  }, [events])

  const handleClear = useCallback(() => {
    eventsStore.clearEvents(sessionId)
  }, [sessionId])

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
          <EventsFilterBar
            filter={filter}
            onFilterChange={setFilter}
            hasEvents={events.length > 0}
            onCopyAll={handleCopyAll}
            onClear={handleClear}
          />

          <div className="space-y-px">
            {grouped.length === 0 ? (
              <EventsEmptyState eventsCount={events.length} messageCount={messageCount} />
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

function EventsFilterBar({
  filter,
  onFilterChange,
  hasEvents,
  onCopyAll,
  onClear,
}: {
  filter: EventCategory
  onFilterChange: (filter: EventCategory) => void
  hasEvents: boolean
  onCopyAll: () => void
  onClear: () => void
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-0.5 p-0.5">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onFilterChange(tab.id)}
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
      {hasEvents && (
        <div className="flex items-center gap-0.5">
          <button
            onClick={onCopyAll}
            className="text-[10px] text-muted-foreground/30 hover:text-muted-foreground/60 transition-colors px-1.5 py-0.5 rounded"
          >
            Copy
          </button>
          <button
            onClick={onClear}
            className="text-[10px] text-muted-foreground/30 hover:text-muted-foreground/60 transition-colors px-1.5 py-0.5 rounded"
          >
            Clear
          </button>
        </div>
      )}
    </div>
  )
}

function EventsEmptyState({ eventsCount, messageCount }: { eventsCount: number; messageCount: number }) {
  return (
    <div className="py-6 text-center">
      <p className="text-[11px] text-muted-foreground/30">
        {eventsCount === 0
          ? messageCount > 0
            ? 'Events stream during live sessions'
            : 'No events yet'
          : 'No matching events'}
      </p>
    </div>
  )
}
