/**
 * Bootstrap **`ship-acp-bridge`** inside the sandbox VM (writes bundled JS + polls `/healthz`).
 *
 * @remarks
 * `SHIP_BRIDGE_TOKEN` is minted once per SessionDO and passed only via `?token=` on WSS because
 * Workers WebSocket clients cannot always attach `Authorization` headers reliably — TLS still protects the tunnel.
 *
 * @packageDocumentation
 */

import type { Sandbox } from '@ship/sandbox'
import type { Env } from '../env.d'
import {
  ACP_BRIDGE_VERSION,
  checkBridgeHealthInSandbox,
  installBridgeBundle,
  readBridgeLogTail,
  startBridgeProcess,
} from './acp-bridge-install'
import { codexAccessTokenLoginShell, ensureCodexAuthInSandbox, hasCodexSubscriptionAuth } from './codex-auth-bootstrap'
import { writeStatus, type SSEWriter } from './chat-stream-helpers'

export { ACP_BRIDGE_VERSION }
export const ACP_RELAY_PORT_DEFAULT = 9847

function randomHex(bytes: number): string {
  const u = new Uint8Array(bytes)
  crypto.getRandomValues(u)
  return [...u].map((b) => b.toString(16).padStart(2, '0')).join('')
}

async function patchMeta(stub: { fetch: typeof fetch }, patch: Record<string, string>): Promise<void> {
  await stub.fetch(
    new Request('https://do/meta', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    }),
  )
}

async function readMeta(stub: { fetch: typeof fetch }): Promise<Record<string, string>> {
  const res = await stub.fetch(new Request('https://do/meta'))
  return (await res.json()) as Record<string, string>
}

function shellExport(key: string, value: string | undefined): string {
  if (!value) return ''
  const escaped = value.replace(/'/g, `'\\''`)
  return `export ${key}='${escaped}'`
}

function healthUrl(httpsOrigin: string, token: string): string {
  const u = new URL(httpsOrigin)
  u.pathname = '/healthz'
  u.searchParams.set('token', token)
  return u.toString()
}

async function checkBridgeHealthExternal(input: {
  httpsOrigin: string
  token: string
  workingDirectory: string
}): Promise<boolean> {
  try {
    const res = await fetch(healthUrl(input.httpsOrigin, input.token), {
      signal: AbortSignal.timeout(4_000),
    })
    if (!res.ok) return false
    const json = (await res.json()) as { ok?: boolean; cwd?: string; version?: string }
    return json.ok === true && json.cwd === input.workingDirectory && json.version === ACP_BRIDGE_VERSION
  } catch {
    return false
  }
}

async function isBridgeHealthy(input: {
  sandbox: Sandbox
  cwd: string
  port: number
  token: string
  workingDirectory: string
  httpsOrigin: string
}): Promise<boolean> {
  if (await checkBridgeHealthInSandbox(input)) return true
  return checkBridgeHealthExternal({
    httpsOrigin: input.httpsOrigin,
    token: input.token,
    workingDirectory: input.workingDirectory,
  })
}

function bridgeEnvExports(token: string, input: { env: Env; workingDirectory: string }): string {
  return [
    shellExport('SHIP_BRIDGE_TOKEN', token),
    shellExport('SHIP_REPO_CWD', input.workingDirectory),
    shellExport('CURSOR_API_KEY', input.env.CURSOR_API_KEY),
    shellExport('CURSOR_AUTH_TOKEN', input.env.CURSOR_AUTH_TOKEN),
    shellExport('OPENCODE_API_KEY', input.env.OPENCODE_API_KEY),
    shellExport('OPENAI_API_KEY', input.env.OPENAI_API_KEY),
    ...(hasCodexSubscriptionAuth(input.env) ? [shellExport('SHIP_CODEX_CHATGPT_AUTH', '1')] : []),
    shellExport('CODEX_ACCESS_TOKEN', input.env.CODEX_AUTH_JSON ? undefined : input.env.CODEX_ACCESS_TOKEN),
    shellExport('ANTHROPIC_API_KEY', input.env.ANTHROPIC_API_KEY),
    shellExport('SHIP_ACP_CURSOR_CMD', input.env.SHIP_ACP_CURSOR_CMD),
    shellExport('SHIP_ACP_CODEX_CMD', input.env.SHIP_ACP_CODEX_CMD),
    shellExport('SHIP_ACP_CLAUDE_CMD', input.env.SHIP_ACP_CLAUDE_CMD),
    shellExport('SHIP_ACP_OPENCODE_CMD', input.env.SHIP_ACP_OPENCODE_CMD),
  ]
    .filter(Boolean)
    .join(' ; ')
}

export async function ensureAcpBridgeReady(input: {
  sandbox: Sandbox
  stub: { fetch: typeof fetch }
  env: Env
  workingDirectory: string
  stream: SSEWriter
}): Promise<{ httpsOrigin: string; token: string; port: number }> {
  await writeStatus(input.stream, 'bridge-starting', 'Starting ACP bridge…')

  const meta = await readMeta(input.stub)

  let token = meta['acp_bridge_token']
  if (!token) {
    token = randomHex(32)
    await patchMeta(input.stub, { acp_bridge_token: token })
  }

  const domainFn = input.sandbox.domain
  if (!domainFn) throw new Error('Sandbox backend missing domain() — cannot reach ACP bridge')

  const portStr = meta['acp_relay_port'] || String(ACP_RELAY_PORT_DEFAULT)
  let port = Number.parseInt(portStr, 10)
  if (!Number.isFinite(port)) port = ACP_RELAY_PORT_DEFAULT

  const httpsOrigin = await domainFn.call(input.sandbox, port)
  const healthInput = {
    sandbox: input.sandbox,
    cwd: input.workingDirectory,
    port,
    token,
    workingDirectory: input.workingDirectory,
    httpsOrigin,
  }

  if (hasCodexSubscriptionAuth(input.env)) {
    await writeStatus(input.stream, 'bridge-auth', 'Configuring Codex auth…')
    await ensureCodexAuthInSandbox(input)
  }

  const forceBridgeRestart = hasCodexSubscriptionAuth(input.env)
  if (!forceBridgeRestart && (await isBridgeHealthy(healthInput))) {
    await writeStatus(input.stream, 'bridge-ready', 'ACP bridge ready')
    return { httpsOrigin, token, port }
  }

  await patchMeta(input.stub, { acp_relay_port: portStr })
  await writeStatus(input.stream, 'bridge-install', 'Installing ACP bridge…')
  await installBridgeBundle(input.sandbox, input.workingDirectory)

  await writeStatus(input.stream, 'bridge-launch', 'Launching ACP bridge…')
  await startBridgeProcess({
    sandbox: input.sandbox,
    cwd: input.workingDirectory,
    port,
    envExports: bridgeEnvExports(token, input),
    codexLoginShell: codexAccessTokenLoginShell(),
  })

  const deadline = Date.now() + 60_000
  while (Date.now() < deadline) {
    if (await isBridgeHealthy(healthInput)) {
      await writeStatus(input.stream, 'bridge-ready', 'ACP bridge ready')
      return { httpsOrigin, token, port }
    }
    await writeStatus(input.stream, 'bridge-wait', 'Waiting for ACP bridge…')
    await new Promise((r) => setTimeout(r, 800))
  }

  const logTail = await readBridgeLogTail(input.sandbox, input.workingDirectory)
  throw new Error(`ACP bridge health check timed out. Log tail:\n${logTail}`)
}

export function toBridgeWsUrl(httpsOrigin: string, token: string): string {
  const u = new URL(httpsOrigin)
  u.protocol = u.protocol === 'https:' ? 'wss:' : 'ws:'
  u.pathname = '/ship-acp'
  u.searchParams.set('token', token)
  return u.toString()
}
