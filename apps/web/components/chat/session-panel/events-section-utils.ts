import type { RawEvent } from '@/app/(app)/dashboard/hooks/use-events-store'

export type EventCategory = 'all' | 'messages' | 'status' | 'errors'

export function getEventDotColor(type: string): string {
  if (type === 'done' || type === 'session.idle') return 'bg-emerald-400'
  if (type.startsWith('message.')) return 'bg-blue-400'
  if (type === 'error' || type === 'session.error') return 'bg-red-400'
  if (type.startsWith('permission.') || type.startsWith('question.')) return 'bg-purple-400'
  if (type === 'status' || type === 'session.status' || type === 'heartbeat' || type === 'server.heartbeat') return 'bg-amber-400'
  return 'bg-muted-foreground/30'
}

export function getEventCategory(type: string): EventCategory {
  if (type.startsWith('message.')) return 'messages'
  if (type === 'error' || type === 'session.error') return 'errors'
  if (type === 'status' || type === 'session.status' || type === 'heartbeat' || type === 'server.heartbeat' || type === 'done' || type === 'session.idle') return 'status'
  return 'all'
}

export function formatRelativeTime(ts: number): string {
  const diff = Date.now() - ts
  if (diff < 1000) return 'now'
  if (diff < 60000) return `${Math.floor(diff / 1000)}s`
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m`
  return new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

export function getPartType(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null
  const p = payload as Record<string, unknown>
  const props = p.properties as Record<string, unknown> | undefined
  if (!props) return null
  const part = props.part as Record<string, unknown> | undefined
  if (!part) return null
  return typeof part.type === 'string' ? part.type : null
}

export function getPartAccumulatedText(payload: unknown): string {
  if (!payload || typeof payload !== 'object') return ''
  const p = payload as Record<string, unknown>
  const props = p.properties as Record<string, unknown> | undefined
  if (!props) return ''
  const part = props.part as Record<string, unknown> | undefined
  if (!part) return ''
  return typeof part.text === 'string' ? part.text : ''
}

export function getToolName(payload: unknown): string | null {
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

export interface EventGroup {
  key: string
  partType: string | null
  events: RawEvent[]
  finalText: string
  toolName: string | null
  startTimestamp: number
  endTimestamp: number
}

/** Collapse consecutive message.part.updated events with the same partType into groups */
export function groupPartEvents(events: RawEvent[]): Array<EventGroup | RawEvent> {
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

export const PART_TYPE_COLOR: Record<string, string> = {
  reasoning: 'text-purple-400/80',
  text: 'text-blue-400/80',
  tool: 'text-amber-400/80',
  'tool-invocation': 'text-amber-400/80',
  'tool-result': 'text-emerald-400/80',
  'step-finish': 'text-muted-foreground/50',
}

export const PART_DOT_COLOR: Record<string, string> = {
  reasoning: 'bg-purple-400',
  text: 'bg-blue-400',
  tool: 'bg-amber-400',
  'tool-invocation': 'bg-amber-400',
  'tool-result': 'bg-emerald-400',
  'step-finish': 'bg-muted-foreground/30',
}

export function getEventLabel(type: string): string {
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

export function extractStatusPreview(payload: unknown): string | null {
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
