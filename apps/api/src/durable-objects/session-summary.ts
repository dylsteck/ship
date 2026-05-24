import type { SessionSummary } from '@ship/contracts'
import { broadcastToWebSockets } from './session-websocket'

/** Host surface for broadcasting session summary updates. */
export interface SessionSummaryHost {
  getWebSockets(): Iterable<WebSocket>
  broadcast(message: object): void
}

/** Options that overlay live turn state onto persisted session meta. */
export interface BuildSessionSummaryOptions {
  isStreaming?: boolean
  activeTool?: string
  latestTurnId?: string
  title?: string
}

function parseDiffStats(meta: Record<string, string>): SessionSummary['summary'] {
  const raw = meta['diff_stats']
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as SessionSummary['summary']
      if (
        parsed &&
        typeof parsed.additions === 'number' &&
        typeof parsed.deletions === 'number' &&
        typeof parsed.files === 'number'
      ) {
        return parsed
      }
    } catch {
      // fall through
    }
  }
  return { additions: 0, deletions: 0, files: 0 }
}

function slugFromSessionId(sessionId: string): string {
  const compact = sessionId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8)
  return compact || 'session'
}

/**
 * Build a {@link SessionSummary} payload from Session DO meta and live turn hints.
 *
 * @param meta - Flat `session_meta` key/value map
 * @param opts - Ephemeral UI state not stored in meta
 */
export function buildSessionSummary(
  meta: Record<string, string>,
  opts: BuildSessionSummaryOptions = {},
): SessionSummary {
  const sessionId = meta['session_id'] || meta['sessionId'] || 'unknown'
  const repoOwner = meta['repoOwner'] || meta['repo_owner'] || ''
  const repoName = meta['repoName'] || meta['repo_name'] || ''
  const created = Number.parseInt(meta['createdAt'] || meta['created_at'] || '', 10)
  const updated = Number.parseInt(meta['last_activity'] || meta['updatedAt'] || '', 10)
  const now = Math.floor(Date.now() / 1000)

  const summary: SessionSummary = {
    id: sessionId,
    slug: slugFromSessionId(sessionId),
    version: '1',
    projectID: repoOwner && repoName ? `${repoOwner}/${repoName}` : sessionId,
    directory: repoName || '/',
    title: opts.title || meta['title'] || 'Untitled session',
    time: {
      created: Number.isFinite(created) ? created : now,
      updated: Number.isFinite(updated) ? updated : now,
    },
    summary: parseDiffStats(meta),
    ...(meta['pr_url'] ? { share: { url: meta['pr_url'] } } : {}),
    ...(meta['agent_type'] || meta['model']
      ? { agentType: meta['agent_type'] || meta['model'] }
      : {}),
    ...(opts.isStreaming || opts.activeTool ? { streaming: true } : {}),
    ...(opts.activeTool ? { activeTool: opts.activeTool } : {}),
    ...(opts.latestTurnId ? { latestTurnId: opts.latestTurnId } : {}),
  }

  return summary
}

/** Broadcast a session summary update to all connected WebSocket clients. */
export function broadcastSessionSummary(host: SessionSummaryHost, summary: SessionSummary): void {
  broadcastToWebSockets(host, {
    type: 'session.summary.updated',
    properties: { summary },
  })
}
