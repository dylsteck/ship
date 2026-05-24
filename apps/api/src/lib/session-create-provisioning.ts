import type { Env } from '../env.d'
import type { createSessionBodySchema } from './api-schemas'
import type { z } from 'zod'

type CreateSessionInput = z.infer<typeof createSessionBodySchema>

/** Session DO stub used for background provisioning. */
export interface SessionDoStub {
  setSessionMeta(key: string, value: string): Promise<void>
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>
}

/**
 * Initialize SessionDO metadata and provision sandbox in the background.
 *
 * @param env - Worker bindings
 * @param sessionId - New chat session id
 * @param userId - Authenticated user id from JWT
 * @param input - Validated create-session body
 * @param now - Unix timestamp used for createdAt meta
 */
export async function provisionSessionInBackground(
  env: Env,
  sessionId: string,
  userId: string,
  input: CreateSessionInput,
  now: number,
): Promise<void> {
  const doId = env.SESSION_DO.idFromName(sessionId)
  const doStub = env.SESSION_DO.get(doId) as unknown as SessionDoStub

  await doStub.setSessionMeta('session_id', sessionId)
  await doStub.setSessionMeta('userId', userId)
  await doStub.setSessionMeta('repoOwner', input.repoOwner)
  await doStub.setSessionMeta('repoName', input.repoName)
  await doStub.setSessionMeta('createdAt', now.toString())
  if (input.model) {
    await doStub.setSessionMeta('model', input.model)
  }
  if (input.agentType) {
    await doStub.setSessionMeta('agent_type', input.agentType)
  }
  await doStub.setSessionMeta('base_branch', input.baseBranch || 'main')

  try {
    const userRow = await env.DB.prepare('SELECT name, email, username FROM users WHERE id = ? LIMIT 1')
      .bind(userId)
      .first<{ name: string | null; email: string | null; username: string | null }>()
    if (userRow) {
      if (userRow.name || userRow.username) {
        await doStub.setSessionMeta('user_name', userRow.name || userRow.username!)
      }
      if (userRow.email) {
        await doStub.setSessionMeta('user_email', userRow.email)
      }
    }
  } catch {
    /* ignore — git commits will fall back to Ship Agent */
  }

  await doStub.setSessionMeta('sandbox_status', 'provisioning')

  const res = await doStub.fetch(`http://do/sandbox/provision`, { method: 'POST' })
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Unknown error' }))
    console.error(`[sessions] Sandbox provisioning failed for ${sessionId}:`, error)
    await doStub.setSessionMeta('sandbox_status', 'error')
    await doStub.fetch(`http://do/broadcast`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'sandbox-status',
        status: 'error',
        error: (error as { error?: string }).error || 'Sandbox provisioning failed',
      }),
    })
  }
}

/** Mark sandbox provisioning failed and broadcast error to connected clients. */
export async function broadcastSandboxProvisioningError(
  env: Env,
  sessionId: string,
  err: unknown,
): Promise<void> {
  try {
    const doId = env.SESSION_DO.idFromName(sessionId)
    const doStub = env.SESSION_DO.get(doId) as unknown as SessionDoStub
    await doStub.setSessionMeta('sandbox_status', 'error')
    await doStub.fetch(`http://do/broadcast`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'sandbox-status',
        status: 'error',
        error: err instanceof Error ? err.message : 'Sandbox provisioning failed',
      }),
    })
  } catch {
    /* ignore */
  }
}
