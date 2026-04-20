/**
 * Timeouts, persisted error messages, and agent session helpers for the chat HTTP routes.
 */

import {
  createAgentSession,
  resumeAgentSession,
  type SandboxAgent,
  type AgentSessionConfig,
} from '../lib/sandbox-agent'

export const CREATE_SESSION_TIMEOUT_MS = 25_000
export const RESUME_SESSION_TIMEOUT_MS = 15_000
export const SETTINGS_PATH = '/settings'

export function cloneFailureDetails(cmdErr: { stderr?: string; stdout?: string }, base: string): string {
  const extra = [cmdErr.stderr, cmdErr.stdout].filter(Boolean).join('\n').trim()
  if (!extra) return base
  return `${base}\n\n${extra.slice(0, 4000)}`
}

export async function persistChatErrorMessage(
  stub: { fetch: typeof fetch },
  doUrl: string,
  content: string,
  category: 'transient' | 'persistent' | 'user-action' | 'fatal',
  retryable: boolean,
  action?: { label: string; href: string },
) {
  try {
    await stub.fetch(
      new Request(`${doUrl}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: 'system',
          content,
          parts: JSON.stringify([
            {
              type: 'error',
              category,
              retryable,
              ...(action && { action }),
            },
          ]),
        }),
      }),
    )
  } catch (e) {
    console.warn('[chat] Failed to persist error message:', e)
  }
}

export async function createAgentSessionWithTimeout(
  client: SandboxAgent,
  agentType: string,
  repoPath: string,
  config: AgentSessionConfig,
) {
  return Promise.race([
    createAgentSession(client, agentType, repoPath, config),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Create agent session timed out')), CREATE_SESSION_TIMEOUT_MS),
    ),
  ])
}

export async function resumeAgentSessionWithTimeout(
  client: SandboxAgent,
  sessionId: string,
): Promise<Awaited<ReturnType<typeof resumeAgentSession>> | null> {
  try {
    return await Promise.race([
      resumeAgentSession(client, sessionId),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Resume agent session timed out')), RESUME_SESSION_TIMEOUT_MS),
      ),
    ])
  } catch {
    return null
  }
}
