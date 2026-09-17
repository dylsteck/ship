/**
 * D1-backed construction and publication of shell session summaries.
 *
 * @packageDocumentation
 */

import type { SessionRuntime, ShellSessionSummary } from '@ship/contracts'

import type { Env } from '../env.d'
import { DEFAULT_ACP_MODEL_ID } from './agent-registry'
import { acpBackendFromModelId } from './acp-types'

/** D1 row needed to construct a shell session projection. */
export interface ShellSessionRow {
  id: string
  user_id: string
  repo_owner: string
  repo_name: string
  status: string
  last_activity: number
  created_at: number
  archived_at: number | null
  title: string | null
  model: string | null
  agent_type: string | null
  revision: number
}

/** Read one persistent session row without consulting its SessionDO. */
export async function readShellSessionRow(env: Env, sessionId: string): Promise<ShellSessionRow | null> {
  return env.DB.prepare(
    `SELECT id, user_id, repo_owner, repo_name, status, last_activity, created_at,
            archived_at, title, model, agent_type, revision
     FROM chat_sessions WHERE id = ?`,
  )
    .bind(sessionId)
    .first<ShellSessionRow>()
}

/** Build the stable shell DTO from a D1 row plus an optional live runtime overlay. */
export function toShellSessionSummary(
  row: ShellSessionRow,
  runtime: SessionRuntime = { state: 'idle' },
): ShellSessionSummary {
  const modelId = row.model || DEFAULT_ACP_MODEL_ID
  return {
    id: row.id as ShellSessionSummary['id'],
    repoOwner: row.repo_owner,
    repoName: row.repo_name,
    title: row.title || row.repo_name || 'Untitled session',
    status: row.status,
    createdAt: row.created_at,
    lastActivity: row.last_activity,
    archivedAt: row.archived_at,
    revision: Math.max(1, row.revision || 1),
    agentId: row.agent_type || acpBackendFromModelId(modelId),
    modelId,
    runtime,
    diffStats: { additions: 0, deletions: 0, files: 0 },
  }
}

/** Publish the latest persistent and runtime state to the authenticated user's shell DO. */
export async function publishShellSession(
  env: Env,
  sessionId: string,
  runtime?: SessionRuntime,
): Promise<ShellSessionSummary | null> {
  const row = await readShellSessionRow(env, sessionId)
  if (!row || row.status === 'deleted') return null
  const summary = toShellSessionSummary(row, runtime)
  const shell = env.USER_SHELL_DO.getByName(row.user_id)
  await shell.initialize(row.user_id)
  await shell.upsertSummary(summary)
  return summary
}

/** Remove a deleted session from the user-scoped shell projection. */
export async function publishShellRemoval(env: Env, userId: string, sessionId: string): Promise<void> {
  const shell = env.USER_SHELL_DO.getByName(userId)
  await shell.initialize(userId)
  await shell.removeSession(sessionId)
}
