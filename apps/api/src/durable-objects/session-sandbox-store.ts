import { SandboxManager, type SandboxInfo } from '../lib/e2b'
import type { Env } from '../env.d'

/** Dependencies required by session sandbox helpers. */
export interface SessionSandboxHost {
  getEnv(): Env
  getDoInstanceId(): string
  getSessionMeta(): Promise<Record<string, string>>
  setSessionMeta(key: string, value: string): Promise<void>
  getSandboxManager(): SandboxManager | null
  setSandboxManager(manager: SandboxManager | null): void
}

function sessionIdFromHost(host: SessionSandboxHost): string {
  return host.getDoInstanceId()
}

function requireApiKey(host: SessionSandboxHost): string {
  const apiKey = host.getEnv().E2B_API_KEY
  if (!apiKey) throw new Error('E2B_API_KEY not configured')
  return apiKey
}

function ensureSandboxManager(host: SessionSandboxHost): SandboxManager {
  let manager = host.getSandboxManager()
  if (!manager) {
    manager = new SandboxManager(requireApiKey(host), sessionIdFromHost(host))
    host.setSandboxManager(manager)
  }
  return manager
}

/** Provision a new E2B sandbox for this session. */
export async function provisionSandbox(host: SessionSandboxHost): Promise<SandboxInfo> {
  const manager = ensureSandboxManager(host)

  const envs: Record<string, string> = {}
  const env = host.getEnv()
  if (env.ANTHROPIC_API_KEY) envs.ANTHROPIC_API_KEY = env.ANTHROPIC_API_KEY
  if (env.OPENAI_API_KEY) envs.OPENAI_API_KEY = env.OPENAI_API_KEY

  const info = await manager.provision(envs)

  await host.setSessionMeta('sandbox_id', info.id)
  await host.setSessionMeta('sandbox_status', info.status)

  return info
}

/** Current sandbox ID if provisioned. */
export async function getSandboxId(host: SessionSandboxHost): Promise<string | null> {
  const meta = await host.getSessionMeta()
  return meta['sandbox_id'] || null
}

/** Resume existing sandbox after hibernation. */
export async function resumeSandbox(host: SessionSandboxHost): Promise<SandboxInfo> {
  const sandboxId = await getSandboxId(host)
  if (!sandboxId) {
    throw new Error('No sandbox to resume')
  }

  const manager = ensureSandboxManager(host)
  const info = await manager.resume(sandboxId)
  await host.setSessionMeta('sandbox_status', info.status)
  return info
}

/** Pause sandbox to control costs. */
export async function pauseSandbox(host: SessionSandboxHost): Promise<void> {
  const manager = host.getSandboxManager()
  if (!manager) {
    throw new Error('No sandbox manager initialized')
  }

  await manager.pause()
  await host.setSessionMeta('sandbox_status', 'paused')
}

/** Terminate sandbox and clear local session data. */
export async function terminateSandbox(host: SessionSandboxHost, sql: SqlStorage): Promise<void> {
  const sandboxId = await getSandboxId(host)
  if (!sandboxId) {
    return
  }

  const manager = ensureSandboxManager(host)
  manager.setSandboxId(sandboxId)
  await manager.terminate()

  await host.setSessionMeta('sandbox_status', 'terminated')
  await host.setSessionMeta('sandbox_id', '')

  sql.exec('DELETE FROM messages')
  sql.exec('DELETE FROM tasks')
  sql.exec('DELETE FROM session_meta')
}

/**
 * Sandbox status from session meta.
 *
 * @remarks
 * `sandboxAgentUrl` and `agentSessionId` are kept for backwards compatibility;
 * both always return `null` now that the agent harness lives in the worker.
 */
export async function getSandboxStatus(host: SessionSandboxHost): Promise<{
  sandboxId: string | null
  status: string | null
  ready?: boolean
  sandboxAgentUrl?: string | null
  agentSessionId?: string | null
  agentType?: string | null
}> {
  const meta = await host.getSessionMeta()
  const sandboxId = meta['sandbox_id'] || null
  const status = meta['sandbox_status'] || null
  return {
    sandboxId,
    status,
    ready: !!(sandboxId && (status === 'active' || status === 'ready')),
    sandboxAgentUrl: null,
    agentSessionId: null,
    agentType: meta['agent_type'] || 'ship',
  }
}
