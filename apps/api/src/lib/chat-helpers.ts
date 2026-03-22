/**
 * Shared utilities for chat route handlers.
 * Extracted from routes/chat.ts to reduce duplication and file size.
 */

import type { Env } from '../env.d'

// ============ Status Constants ============

export const SandboxStatus = {
  Provisioning: 'provisioning',
  Active: 'active',
  Error: 'error',
  Resuming: 'resuming',
} as const

export const StreamStatus = {
  Initializing: 'initializing',
  Provisioning: 'provisioning',
  SandboxReady: 'sandbox-ready',
  StartingAgent: 'starting-agent-server',
  Cloning: 'cloning',
  RepoReady: 'repo-ready',
  Reconnecting: 'reconnecting',
  SendingPrompt: 'sending-prompt',
  CreatingSession: 'creating-session',
} as const

// ============ Helpers ============

export function buildAgentEnvVars(env: Env): Record<string, string> {
  const envVars: Record<string, string> = {}
  if (env.ANTHROPIC_API_KEY) envVars.ANTHROPIC_API_KEY = env.ANTHROPIC_API_KEY
  if (env.OPENAI_API_KEY) envVars.OPENAI_API_KEY = env.OPENAI_API_KEY
  if (env.BANKR_API_KEY) envVars.BANKR_API_KEY = env.BANKR_API_KEY
  return envVars
}

export function getSessionStub(env: Env, sessionId: string) {
  const id = env.SESSION_DO.idFromName(sessionId)
  return env.SESSION_DO.get(id)
}

export async function getSessionStubAndMeta(env: Env, sessionId: string) {
  const stub = getSessionStub(env, sessionId)
  const metaRes = await stub.fetch(new Request('https://do/meta'))
  const meta = (await metaRes.json()) as Record<string, string>
  return { stub, meta }
}

type SSEStream = {
  writeSSE(data: { event: string; data: string }): Promise<void>
}

export async function writeStatusEvent(
  stream: SSEStream,
  status: string,
  message: string,
): Promise<void> {
  await stream.writeSSE({
    event: 'status',
    data: JSON.stringify({ type: 'status', status, message }),
  })
}

export async function writeErrorEvent(
  stream: SSEStream,
  error: string,
  category = 'persistent',
  retryable = false,
  details?: string,
): Promise<void> {
  await stream.writeSSE({
    event: 'error',
    data: JSON.stringify({ error, category, retryable, ...(details && { details }) }),
  })
}
