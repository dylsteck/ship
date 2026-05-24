/**
 * ACP `initialize` / `authenticate` / `session/new` | `session/load` handshake.
 *
 * @packageDocumentation
 */

import type { Env } from '../env.d'
import type { AcpMultiplexer } from './acp-json-rpc'
import type { AcpBackendKind } from './agent-registry'
import { hasCodexSubscriptionAuth } from './codex-auth-bootstrap'

function sessionIdFromResult(raw: unknown): string {
  const obj = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  return String(obj.sessionId ?? obj.session_id ?? obj.id ?? '')
}

function configOptionsFromResult(raw: unknown): unknown[] | undefined {
  const obj = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  return Array.isArray(obj.configOptions) ? obj.configOptions : undefined
}

function hasAuthMethod(init: Record<string, unknown>, methodId: string): boolean {
  const methods = Array.isArray(init.authMethods) ? init.authMethods : []
  return methods.some((method) => {
    if (!method || typeof method !== 'object') return false
    return (method as Record<string, unknown>).id === methodId
  })
}

async function authenticateBackend(
  rpc: AcpMultiplexer,
  backend: AcpBackendKind,
  env: Env,
  init: Record<string, unknown>,
): Promise<void> {
  switch (backend) {
    case 'cursor':
      // Cursor's `cursor_login` auth method is for an existing interactive
      // login. In E2B we launch `agent acp` with API credentials up front;
      // sending `authenticate` after that hangs on Linux.
      break
    case 'codex':
      // Pre-seeded ~/.codex/auth.json (CODEX_AUTH_JSON or enterprise login) — do not call
      // authenticate(chatgpt): codex-acp starts a browser OAuth server and blocks until done.
      if (hasCodexSubscriptionAuth(env)) {
        break
      }
      if (env.OPENAI_API_KEY) {
        await rpc.request('authenticate', {
          methodId: 'openai-api-key',
          credentials: { apiKey: env.OPENAI_API_KEY },
        })
      }
      break
    case 'claude':
      if (env.ANTHROPIC_API_KEY) {
        await rpc.request('authenticate', {
          methodId: 'anthropic-api-key',
          credentials: { apiKey: env.ANTHROPIC_API_KEY },
        })
      }
      break
    case 'opencode':
      if (env.OPENCODE_API_KEY && hasAuthMethod(init, 'opencode-api-key')) {
        await rpc.request('authenticate', {
          methodId: 'opencode-api-key',
          credentials: { apiKey: env.OPENCODE_API_KEY },
        })
      }
      break
    default:
      break
  }
}

async function openOrLoadSession(
  rpc: AcpMultiplexer,
  cwd: string,
  persistedSessionId: string | undefined,
  canLoadSession: boolean,
  persistSessionId: (id: string) => Promise<void>,
  setSuppressNotifications: (value: boolean) => void,
  sessionTimeoutMs: number,
): Promise<{ sessionId: string; loadedExisting: boolean; configOptions?: unknown[] }> {
  const sessionRequest = (method: string, params: unknown) =>
    rpc.request(method, params, { timeoutMs: sessionTimeoutMs })

  let sid = persistedSessionId
  let loadedExisting = false
  let configOptions: unknown[] | undefined

  if (!sid) {
    const raw = await sessionRequest('session/new', { cwd, mcpServers: [] })
    sid = sessionIdFromResult(raw)
    configOptions = configOptionsFromResult(raw)
    if (!sid) throw new Error('ACP session/new missing session id')
    await persistSessionId(sid)
    return { sessionId: sid, loadedExisting, configOptions }
  }

  if (canLoadSession) {
    try {
      setSuppressNotifications(true)
      const raw = await sessionRequest('session/load', { sessionId: sid, cwd, mcpServers: [] })
      configOptions = configOptionsFromResult(raw)
      loadedExisting = true
    } catch {
      const raw = await sessionRequest('session/new', { cwd, mcpServers: [] })
      sid = sessionIdFromResult(raw)
      configOptions = configOptionsFromResult(raw)
      if (!sid) throw new Error('ACP session/new missing session id after load failure')
      await persistSessionId(sid)
    } finally {
      setSuppressNotifications(false)
    }
    return { sessionId: sid, loadedExisting, configOptions }
  }

  const raw = await sessionRequest('session/new', { cwd, mcpServers: [] })
  sid = sessionIdFromResult(raw)
  configOptions = configOptionsFromResult(raw)
  if (!sid) throw new Error('ACP session/new missing session id without load support')
  await persistSessionId(sid)
  return { sessionId: sid, loadedExisting, configOptions }
}

/** Result of a successful ACP session handshake. */
export interface AcpHandshakeResult {
  sessionId: string
  loadedExisting: boolean
  configOptions?: unknown[]
}

/** Per-backend RPC timeouts — Codex cold-starts via npx on first spawn. */
export function acpRpcTimeouts(backend: AcpBackendKind): { initializeMs: number; sessionMs: number } {
  if (backend === 'codex') return { initializeMs: 180_000, sessionMs: 180_000 }
  return { initializeMs: 45_000, sessionMs: 120_000 }
}

/**
 * Run `initialize` / `authenticate` / `session/new` | `session/load` for one bridge connection.
 */
export async function runAcpHandshake(
  rpc: AcpMultiplexer,
  backend: AcpBackendKind,
  env: Env,
  cwd: string,
  persistedSessionId: string | undefined,
  persistSessionId: (id: string) => Promise<void>,
  setSuppressNotifications: (value: boolean) => void,
): Promise<AcpHandshakeResult> {
  const { initializeMs, sessionMs } = acpRpcTimeouts(backend)
  const initRaw = await rpc.request('initialize', {
    protocolVersion: 1,
    clientCapabilities: { fs: { readTextFile: false, writeTextFile: false }, terminal: false },
    clientInfo: { name: 'Ship', version: '2.0.0' },
  }, { timeoutMs: initializeMs })
  const init = initRaw && typeof initRaw === 'object' ? (initRaw as Record<string, unknown>) : {}
  const capabilities =
    init.agentCapabilities && typeof init.agentCapabilities === 'object'
      ? (init.agentCapabilities as Record<string, unknown>)
      : {}
  const canLoadSession = capabilities.loadSession === true

  await authenticateBackend(rpc, backend, env, init)

  return openOrLoadSession(
    rpc,
    cwd,
    persistedSessionId,
    canLoadSession,
    persistSessionId,
    setSuppressNotifications,
    sessionMs,
  )
}

function optionValue(option: unknown): string | undefined {
  if (typeof option === 'string') return option
  if (!option || typeof option !== 'object') return undefined
  const obj = option as Record<string, unknown>
  const value = obj.value ?? obj.id ?? obj.name
  return typeof value === 'string' ? value : undefined
}

function findModelConfigOption(configOptions: unknown[] | undefined, upstreamModelId: string): string | undefined {
  for (const option of configOptions ?? []) {
    if (!option || typeof option !== 'object') continue
    const obj = option as Record<string, unknown>
    const id = typeof obj.id === 'string' ? obj.id : ''
    if (!/model/i.test(id)) continue
    const options = Array.isArray(obj.options) ? obj.options : []
    if (options.length === 0 || options.some((candidate) => optionValue(candidate) === upstreamModelId)) return id
  }
  return undefined
}

/** Apply upstream model id to the ACP session when the backend advertises a model config option. */
export async function setAdvertisedModelConfig(
  rpc: AcpMultiplexer,
  sessionId: string,
  configOptions: unknown[] | undefined,
  upstreamModelId: string | undefined,
): Promise<void> {
  if (!upstreamModelId) return
  const configId = findModelConfigOption(configOptions, upstreamModelId)
  if (!configId) return
  await rpc.request('session/set_config_option', { sessionId, configId, value: upstreamModelId })
}
