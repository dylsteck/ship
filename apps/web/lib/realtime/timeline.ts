/** Pure turn-to-row derivation for the virtualized transcript. */

import type { MessagePart, RealtimeMessage, ToolPart, Turn } from '@ship/contracts'
import type { SessionControllerState } from './session-state'

/** Stable row kinds rendered by the Ship transcript. */
export type TimelineRow =
  | { key: string; type: 'load-earlier'; hasMore: boolean; loading: boolean; error?: string }
  | { key: string; type: 'user-message'; turnId: string; message: RealtimeMessage }
  | { key: string; type: 'assistant-content'; turnId: string; message: RealtimeMessage }
  | { key: string; type: 'work-summary'; turnId: string; turn: Turn; stepCount: number; changedFiles: number }
  | { key: string; type: 'work-group'; turnId: string; label: string; tools: ToolPart[] }
  | { key: string; type: 'reasoning'; turnId: string; id: string; text: string }
  | { key: string; type: 'tool'; turnId: string; tool: ToolPart }
  | { key: string; type: 'plan'; turnId: string; part: Extract<MessagePart, { type: 'plan' }> }
  | { key: string; type: 'turn-diff'; turnId: string; diff: NonNullable<Turn['diffSummary']> }
  | { key: string; type: 'working'; turnId: string; turn: Turn; status: string }
  | { key: string; type: 'error'; turnId: string; message: RealtimeMessage }

/** Derive display rows while reusing semantically unchanged prior row objects. */
export function deriveTimelineRows(
  state: SessionControllerState,
  expandedTurnIds: ReadonlySet<string>,
  previousRows: readonly TimelineRow[] = [],
): TimelineRow[] {
  const rows: TimelineRow[] = []
  if (state.hasMore || state.historyError) {
    rows.push({
      key: `load:${state.beforeCursor ?? 'start'}`,
      type: 'load-earlier',
      hasMore: state.hasMore,
      loading: state.historyLoading,
      ...(state.historyError ? { error: state.historyError } : {}),
    })
  }

  const messagesByTurn = groupMessagesByTurn(state)
  for (const turnId of state.orderedTurnIds) {
    const turn = state.turnsById.get(turnId)
    if (!turn) continue
    const messages = messagesByTurn.get(turnId) ?? []
    const users = messages.filter((message) => message.role === 'user')
    const assistants = messages.filter((message) => message.role === 'assistant')
    const errors = messages.filter((message) => message.role === 'system')
    for (const message of users) rows.push({ key: `user:${message.id}`, type: 'user-message', turnId, message })

    const settled = turn.status !== 'running'
    const workParts = assistants.flatMap((message) => message.parts ?? []).filter(isWorkPart)
    if (settled && workParts.length > 0) {
      rows.push({
        key: `work-summary:${turnId}`,
        type: 'work-summary',
        turnId,
        turn,
        stepCount: workParts.filter((part) => part.type === 'tool').length,
        changedFiles: turn.diffSummary?.length ?? 0,
      })
    }
    if (!settled || expandedTurnIds.has(turnId)) rows.push(...deriveWorkRows(turnId, workParts))
    if (!settled) {
      const status = state.summary?.runtime.activeTool || currentPlanStatus(workParts) || 'Working'
      rows.push({ key: `working:${turnId}`, type: 'working', turnId, turn, status })
    }
    for (const message of assistants) {
      if (message.content) rows.push({ key: `assistant:${message.id}`, type: 'assistant-content', turnId, message })
    }
    for (const message of errors) rows.push({ key: `error:${message.id}`, type: 'error', turnId, message })
    if (turn.diffSummary?.length) {
      rows.push({ key: `diff:${turnId}`, type: 'turn-diff', turnId, diff: turn.diffSummary })
    }
  }

  appendUnassignedMessages(rows, state, messagesByTurn)
  return reuseRows(rows, previousRows)
}

function groupMessagesByTurn(state: SessionControllerState): Map<string, RealtimeMessage[]> {
  const grouped = new Map<string, RealtimeMessage[]>()
  for (const id of state.orderedMessageIds) {
    const message = state.messagesById.get(id)
    if (!message?.turnId) continue
    const list = grouped.get(message.turnId) ?? []
    list.push(message)
    grouped.set(message.turnId, list)
  }
  return grouped
}

function deriveWorkRows(turnId: string, parts: MessagePart[]): TimelineRow[] {
  const rows: TimelineRow[] = []
  let exploration: ToolPart[] = []
  const flushExploration = () => {
    if (exploration.length === 1) rows.push({ key: `tool:${exploration[0]!.callID}`, type: 'tool', turnId, tool: exploration[0]! })
    if (exploration.length > 1) {
      rows.push({
        key: `work-group:${exploration[0]!.callID}`,
        type: 'work-group',
        turnId,
        label: explorationLabel(exploration),
        tools: exploration,
      })
    }
    exploration = []
  }
  for (const part of parts) {
    if (part.type === 'tool' && isExplorationTool(part)) {
      exploration.push(part)
      continue
    }
    flushExploration()
    if (part.type === 'tool') rows.push({ key: `tool:${part.callID}`, type: 'tool', turnId, tool: part })
    else if (part.type === 'reasoning' && part.text) {
      rows.push({ key: `reasoning:${part.id}`, type: 'reasoning', turnId, id: part.id, text: part.text })
    } else if (part.type === 'plan') rows.push({ key: `plan:${part.id}`, type: 'plan', turnId, part })
  }
  flushExploration()
  return rows
}

function isWorkPart(part: MessagePart): boolean {
  return part.type === 'tool' || part.type === 'reasoning' || part.type === 'plan'
}

function isExplorationTool(part: ToolPart): boolean {
  if (part.state.status === 'error') return false
  const value = `${part.tool} ${part.displayLabel ?? ''} ${part.activityKind ?? ''}`.toLowerCase()
  if (/write|edit|patch|delete|remove|commit|push|merge|subagent|approve|question/.test(value)) return false
  return /read|search|grep|glob|find|list|inspect|status|show|pwd|ls\b/.test(value)
}

function explorationLabel(tools: ToolPart[]): string {
  const targets = new Set(
    tools.flatMap((tool) => Object.values(tool.state.input).filter((value): value is string => typeof value === 'string')),
  )
  return `Explored ${targets.size || tools.length} ${targets.size === 1 ? 'target' : 'targets'}`
}

function currentPlanStatus(parts: MessagePart[]): string | undefined {
  const plan = [...parts].reverse().find((part) => part.type === 'plan')
  if (!plan || plan.type !== 'plan') return undefined
  return plan.items.find((item) => item.status === 'in_progress')?.title
}

function appendUnassignedMessages(
  rows: TimelineRow[],
  state: SessionControllerState,
  grouped: ReadonlyMap<string, RealtimeMessage[]>,
): void {
  const assigned = new Set([...grouped.values()].flat().map((message) => message.id))
  for (const id of state.orderedMessageIds) {
    if (assigned.has(id)) continue
    const message = state.messagesById.get(id)
    if (!message) continue
    const turnId = message.turnId ?? `unassigned:${message.id}`
    if (message.role === 'user') rows.push({ key: `user:${id}`, type: 'user-message', turnId, message })
    else if (message.role === 'assistant') rows.push({ key: `assistant:${id}`, type: 'assistant-content', turnId, message })
    else rows.push({ key: `error:${id}`, type: 'error', turnId, message })
  }
}

function reuseRows(rows: TimelineRow[], previousRows: readonly TimelineRow[]): TimelineRow[] {
  const previous = new Map(previousRows.map((row) => [row.key, row]))
  return rows.map((row) => {
    const old = previous.get(row.key)
    return old && rowSignature(old) === rowSignature(row) ? old : row
  })
}

function rowSignature(row: TimelineRow): string {
  switch (row.type) {
    case 'user-message':
    case 'assistant-content':
    case 'error':
      return `${row.type}:${row.message.content}:${row.message.parts?.length ?? 0}`
    case 'tool':
      return `${row.type}:${row.tool.state.status}:${row.tool.state.outputPreview ?? row.tool.state.output ?? ''}`
    case 'work-group':
      return `${row.type}:${row.tools.map((tool) => `${tool.callID}:${tool.state.status}`).join('|')}`
    case 'reasoning':
      return `${row.type}:${row.text}`
    case 'plan':
      return `${row.type}:${row.part.items.map((item) => `${item.id}:${item.status}`).join('|')}`
    case 'work-summary':
      return `${row.type}:${row.turn.status}:${row.stepCount}:${row.changedFiles}:${row.turn.completedAt ?? 0}`
    case 'working':
      return `${row.type}:${row.status}`
    case 'turn-diff':
      return `${row.type}:${row.diff.map((file) => `${file.filename}:${file.additions}:${file.deletions}`).join('|')}`
    case 'load-earlier':
      return `${row.type}:${row.hasMore}:${row.loading}:${row.error ?? ''}`
    default: {
      const exhaustive: never = row
      return exhaustive
    }
  }
}
