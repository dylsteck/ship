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
import { ACP_BRIDGE_BUNDLE } from '../generated/acp-bridge-bundled'
import { writeStatus, type SSEWriter } from './chat-stream-helpers'

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

export async function ensureAcpBridgeReady(input: {
  sandbox: Sandbox
  stub: { fetch: typeof fetch }
  env: Env
  workingDirectory: string
  stream: SSEWriter
}): Promise<{ httpsOrigin: string; token: string; port: number }> {
  await writeStatus(input.stream, 'sandbox-ready', 'Starting ACP bridge…')

  const meta = await readMeta(input.stub)

  let token = meta['acp_bridge_token']
  if (!token) {
    token = randomHex(32)
    await patchMeta(input.stub, { acp_bridge_token: token })
  }

  let portStr = meta['acp_relay_port']
  if (!portStr) {
    portStr = String(ACP_RELAY_PORT_DEFAULT)
    await patchMeta(input.stub, { acp_relay_port: portStr })
  }

  const port = Number.parseInt(portStr, 10)

  await input.sandbox.writeFile('/tmp/ship-acp-bridge.mjs', ACP_BRIDGE_BUNDLE, 'utf-8')

  const exportsPrefix = [
    shellExport('SHIP_BRIDGE_TOKEN', token),
    shellExport('SHIP_REPO_CWD', input.workingDirectory),
    shellExport('CURSOR_API_KEY', input.env.CURSOR_API_KEY),
    shellExport('CURSOR_AUTH_TOKEN', input.env.CURSOR_AUTH_TOKEN),
    shellExport('OPENCODE_API_KEY', input.env.OPENCODE_API_KEY),
    shellExport('OPENAI_API_KEY', input.env.OPENAI_API_KEY),
    shellExport('ANTHROPIC_API_KEY', input.env.ANTHROPIC_API_KEY),
  ]
    .filter(Boolean)
    .join(' ; ')

  const startCmd = `${exportsPrefix ? `${exportsPrefix} ; ` : ''}nohup node /tmp/ship-acp-bridge.mjs --port ${port} > /tmp/acp-bridge.log 2>&1 & sleep 1 ; echo bridge_started`

  const run = await input.sandbox.exec(startCmd, input.workingDirectory, 120_000)
  if (!run.success) {
    const tail = await input.sandbox.exec(`tail -n 60 /tmp/acp-bridge.log 2>/dev/null || true`, input.workingDirectory, 30_000)
    throw new Error(
      `ACP bridge failed to start (exit ${run.exitCode}): ${run.stderr || run.stdout}. Log tail:\n${tail.stdout}`,
    )
  }

  const domainFn = input.sandbox.domain
  if (!domainFn) throw new Error('Sandbox backend missing domain() — cannot reach ACP bridge')

  const httpsOrigin = domainFn.call(input.sandbox, port)

  const deadline = Date.now() + 45_000
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${httpsOrigin}/healthz`, { signal: AbortSignal.timeout(8000) })
      if (res.ok) return { httpsOrigin, token, port }
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 600))
  }

  const tail = await input.sandbox.exec(`tail -n 120 /tmp/acp-bridge.log 2>/dev/null || true`, input.workingDirectory, 30_000)
  throw new Error(`ACP bridge health check timed out. Log tail:\n${tail.stdout}`)
}

export function toBridgeWsUrl(httpsOrigin: string, token: string): string {
  const u = new URL(httpsOrigin)
  u.protocol = u.protocol === 'https:' ? 'wss:' : 'ws:'
  u.pathname = '/ship-acp'
  u.searchParams.set('token', token)
  return u.toString()
}
