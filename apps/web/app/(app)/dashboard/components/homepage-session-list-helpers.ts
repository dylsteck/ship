import type { ChatSession } from '@/lib/api/server'
import type { ModelInfo } from '@/lib/api/types'

export function formatRelativeTime(timestamp: number, now: number): string {
  const seconds = Math.floor(now - timestamp)
  if (seconds < 60) return 'now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`
  const days = Math.floor(seconds / 86400)
  if (days < 14) return `${days}d`
  if (days < 60) return `${Math.floor(days / 7)}w`
  return `${Math.floor(days / 30)}mo`
}

export function groupSessionsByTime(
  sessions: ChatSession[],
  now: number,
): { label: string; sessions: ChatSession[] }[] {
  const oneDay = 24 * 60 * 60
  const todayStart = now - oneDay
  const yesterdayStart = now - 2 * oneDay
  const weekStart = now - 7 * oneDay
  const monthStart = now - 30 * oneDay

  const today: ChatSession[] = []
  const yesterday: ChatSession[] = []
  const thisWeek: ChatSession[] = []
  const thisMonth: ChatSession[] = []
  const older: ChatSession[] = []

  for (const s of sessions) {
    const t = s.lastActivity
    if (t >= todayStart) today.push(s)
    else if (t >= yesterdayStart) yesterday.push(s)
    else if (t >= weekStart) thisWeek.push(s)
    else if (t >= monthStart) thisMonth.push(s)
    else older.push(s)
  }

  const sortByActivity = (a: ChatSession, b: ChatSession) => b.lastActivity - a.lastActivity
  const groups: { label: string; sessions: ChatSession[] }[] = []
  if (today.length) groups.push({ label: 'Today', sessions: today.sort(sortByActivity) })
  if (yesterday.length) groups.push({ label: 'Yesterday', sessions: yesterday.sort(sortByActivity) })
  if (thisWeek.length) groups.push({ label: 'This Week', sessions: thisWeek.sort(sortByActivity) })
  if (thisMonth.length) groups.push({ label: 'This Month', sessions: thisMonth.sort(sortByActivity) })
  if (older.length) groups.push({ label: 'Older', sessions: older.sort(sortByActivity) })
  return groups
}

function agentNameFromModelId(modelId: string): string | null {
  if (modelId.includes('ship-acp-opencode')) return 'OpenCode'
  if (modelId.includes('ship-acp-cursor')) return 'Cursor'
  if (modelId.includes('ship-acp-claude')) return 'Claude'
  if (modelId.includes('ship-acp-codex')) return 'Codex'
  return null
}

function modelNameFromModelId(modelId: string): string | null {
  const upstreamModelId = modelId.includes(':') ? modelId.split(':').at(-1) : null
  const slug = upstreamModelId?.split('/').at(-1)
  if (!slug) return null
  return slug
    .split('-')
    .filter(Boolean)
    .map((part) => {
      const upper = part.toUpperCase()
      if (['GPT', 'API', 'AI'].includes(upper)) return upper
      if (/^\d/.test(part)) return part
      return `${part.charAt(0).toUpperCase()}${part.slice(1)}`
    })
    .join(' ')
}

export function getSessionModelLabel(
  session: ChatSession,
  models: ModelInfo[],
  fallbackAgentLabel: string,
): string {
  if (!session.model) return fallbackAgentLabel
  const model = models.find((candidate) => candidate.id === session.model)
  const agentName = agentNameFromModelId(session.model) || fallbackAgentLabel
  if (!model) {
    const modelName = modelNameFromModelId(session.model)
    return modelName ? `${agentName} / ${modelName}` : agentName
  }
  if (model.name === 'Configured default') return `${agentName} / Configured default`
  return `${agentName} / ${model.name}`
}
