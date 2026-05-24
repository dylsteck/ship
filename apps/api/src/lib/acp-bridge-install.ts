/**
 * Write and start `ship-acp-bridge` inside the E2B VM.
 *
 * @packageDocumentation
 */

import type { Sandbox } from '@ship/sandbox'
import { ACP_BRIDGE_BUNDLE } from '../generated/acp-bridge-bundled'

/** Must match {@link packages/acp-bridge/src/backends.ts}. */
export const ACP_BRIDGE_VERSION = '11'

const BRIDGE_PATH = '/tmp/ship-acp-bridge.mjs'
const BRIDGE_LOG = '/tmp/acp-bridge.log'
const BRIDGE_PID = '/tmp/acp-bridge.pid'

function utf8ToBase64(text: string): string {
  const bytes = new TextEncoder().encode(text)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`
}

/** Install the bundled bridge into `/tmp/ship-acp-bridge.mjs`. */
export async function installBridgeBundle(sandbox: Sandbox, cwd: string): Promise<void> {
  try {
    await sandbox.writeFile(BRIDGE_PATH, ACP_BRIDGE_BUNDLE, 'utf-8')
    const verify = await sandbox.exec(`test -s ${BRIDGE_PATH}`, cwd, 15_000)
    if (verify.success) return
  } catch {
    // Fall back to chunked base64 writes when files.write is unavailable.
  }

  await installBridgeBundleViaBase64(sandbox, cwd)
}

/** Fallback when {@link Sandbox.writeFile} fails — one small exec per base64 chunk. */
async function installBridgeBundleViaBase64(sandbox: Sandbox, cwd: string): Promise<void> {
  const b64 = utf8ToBase64(ACP_BRIDGE_BUNDLE)
  const chunkSize = 16_000
  const b64Path = '/tmp/ship-acp-bridge.mjs.b64'

  const init = await sandbox.exec(`rm -f ${BRIDGE_PATH} ${b64Path} ; : > ${b64Path}`, cwd, 15_000)
  if (!init.success) {
    throw new Error(`ACP bridge install failed (init): ${(init.stderr || init.stdout).trim()}`)
  }

  for (let i = 0; i < b64.length; i += chunkSize) {
    const chunk = b64.slice(i, i + chunkSize)
    const run = await sandbox.exec(`printf '%s' '${chunk}' >> ${b64Path}`, cwd, 30_000)
    if (!run.success) {
      throw new Error(
        `ACP bridge install failed (chunk ${i / chunkSize + 1}, exit ${run.exitCode}): ${(run.stderr || run.stdout).trim()}`,
      )
    }
  }

  const decode = await sandbox.exec(`base64 -d ${b64Path} > ${BRIDGE_PATH} ; test -s ${BRIDGE_PATH}`, cwd, 30_000)
  if (!decode.success) {
    throw new Error(`ACP bridge install failed (decode): ${(decode.stderr || decode.stdout).trim()}`)
  }
}

/** Poll bridge `/healthz` from inside the sandbox (avoids Worker→E2B edge fetch quirks). */
export async function checkBridgeHealthInSandbox(input: {
  sandbox: Sandbox
  cwd: string
  port: number
  token: string
  workingDirectory: string
}): Promise<boolean> {
  const url = `http://127.0.0.1:${input.port}/healthz?token=${encodeURIComponent(input.token)}`
  const run = await input.sandbox.exec(
    `command -v curl >/dev/null 2>&1 && curl -sf -m 3 ${shellQuote(url)} || wget -qO- --timeout=3 ${shellQuote(url)}`,
    input.cwd,
    15_000,
  )
  if (!run.success || !run.stdout.trim()) return false

  try {
    const json = JSON.parse(run.stdout.trim()) as { ok?: boolean; cwd?: string; version?: string }
    return (
      json.ok === true &&
      json.cwd === input.workingDirectory &&
      json.version === ACP_BRIDGE_VERSION
    )
  } catch {
    return false
  }
}

/** Stop any prior bridge, export env, and launch node in the background. */
export async function startBridgeProcess(input: {
  sandbox: Sandbox
  cwd: string
  port: number
  envExports: string
  codexLoginShell: string
}): Promise<void> {
  const stopCmd = [
    `if [ -f ${BRIDGE_PID} ]; then kill "$(cat ${BRIDGE_PID})" 2>/dev/null || true; fi`,
    `pids="$(pgrep -f '^node /tmp/ship-acp-bridge\\.mjs' 2>/dev/null || true)"`,
    `if [ -n "$pids" ]; then kill $pids 2>/dev/null || true; fi`,
    `rm -f ${BRIDGE_PID}`,
    `: > ${BRIDGE_LOG}`,
  ].join(' ; ')

  const stop = await input.sandbox.exec(stopCmd, input.cwd, 30_000)
  if (!stop.success) {
    throw new Error(`ACP bridge stop failed (exit ${stop.exitCode}): ${(stop.stderr || stop.stdout).trim()}`)
  }

  const launchCmd = [
    input.envExports,
    input.codexLoginShell,
    `command -v node >/dev/null 2>&1 || { echo "node missing in sandbox template" >&2; exit 127; }`,
    `nohup node ${BRIDGE_PATH} --port ${input.port} > ${BRIDGE_LOG} 2>&1 & echo $! > ${BRIDGE_PID}`,
    `sleep 2`,
    `kill -0 "$(cat ${BRIDGE_PID})" 2>/dev/null || { echo "bridge failed to stay alive:" >&2; cat ${BRIDGE_LOG}; exit 1; }`,
    `echo bridge_started`,
  ]
    .filter(Boolean)
    .join(' ; ')

  const run = await input.sandbox.exec(launchCmd, input.cwd, 60_000)
  if (!run.success) {
    const tail = await input.sandbox.exec(`tail -n 80 ${BRIDGE_LOG} 2>/dev/null || true`, input.cwd, 15_000)
    throw new Error(
      `ACP bridge failed to start (exit ${run.exitCode}): ${(run.stderr || run.stdout).trim()}\nLog tail:\n${tail.stdout}`,
    )
  }
}

/** Read bridge stderr log tail for error messages. */
export async function readBridgeLogTail(sandbox: Sandbox, cwd: string, lines = 120): Promise<string> {
  const tail = await sandbox.exec(`tail -n ${lines} ${BRIDGE_LOG} 2>/dev/null || true`, cwd, 15_000)
  return tail.stdout
}
