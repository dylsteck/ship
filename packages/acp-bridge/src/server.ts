/**
 * ship-acp-bridge — runs inside the E2B VM (localhost-only HTTP + WebSocket hop).
 *
 * Multiplexes Worker WebSocket frames ↔ NDJSON JSON-RPC lines on the selected ACP backend stdin/stdout.
 *
 * Env:
 * - SHIP_BRIDGE_TOKEN — shared secret (Worker generates per session; compare query ?token= or Authorization header).
 * - SHIP_REPO_CWD — cwd for spawned backends (cloned repo root).
 *
 * CLI: node bundle.mjs --port 9847
 *
 * @packageDocumentation
 */

import * as fs from 'node:fs'
import * as http from 'node:http'
import { spawn, spawnSync, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { URL } from 'node:url'
import { WebSocketServer, type WebSocket } from 'ws'
import { backendArgv, backendEnv, BRIDGE_VERSION, type BackendKind } from './backends.js'

const CODEX_AUTH_PATH = '/home/user/.codex/auth.json'

function codexUsesChatGptAuth(): boolean {
  return process.env.SHIP_CODEX_CHATGPT_AUTH === '1' || fs.existsSync(CODEX_AUTH_PATH)
}

let child: ChildProcessWithoutNullStreams | null = null
let stdoutBuf = ''
let stderrRate: { count: number; resetAt: number } = { count: 0, resetAt: 0 }

function parseArgs(argv: string[]): { port: number } {
  let port = 9847
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--port' && argv[i + 1]) {
      port = Number.parseInt(argv[i + 1]!, 10)
      i++
    }
  }
  if (!Number.isFinite(port)) port = 9847
  return { port }
}

function killChild(): void {
  if (child && !child.killed) {
    try {
      child.kill('SIGTERM')
    } catch {
      /* ignore */
    }
    child = null
  }
  stdoutBuf = ''
}

function sendCtl(ws: WebSocket, payload: Record<string, unknown>): void {
  try {
    ws.send(JSON.stringify({ type: 'ctl', ...payload }))
  } catch {
    /* socket closing */
  }
}

function sendLog(ws: WebSocket, stream: string, data: string): void {
  if (!data) return
  try {
    ws.send(JSON.stringify({ type: 'log', stream, data }))
  } catch {
    /* socket closing */
  }
}

function prepareBackend(kind: BackendKind, client: WebSocket, cwd: string): boolean {
  if (kind !== 'cursor') return true
  const script = [
    'export PATH="$HOME/.local/bin:$PATH"',
    'if command -v agent >/dev/null 2>&1; then exit 0; fi',
    'if ! command -v curl >/dev/null 2>&1; then',
    '  echo "Cursor CLI missing and curl is not available to install it." >&2',
    '  exit 127',
    'fi',
    'echo "[ship-acp-bridge] installing Cursor CLI" >&2',
    'curl https://cursor.com/install -fsS | bash',
    'export PATH="$HOME/.local/bin:$PATH"',
    'command -v agent >/dev/null 2>&1',
  ].join('\n')
  const result = spawnSync('bash', ['-lc', script], {
    cwd,
    env: { ...process.env, PATH: `${process.env.HOME}/.local/bin:${process.env.PATH ?? ''}` },
    encoding: 'utf8',
    timeout: 120_000,
    maxBuffer: 1024 * 1024,
  })
  sendLog(client, 'stdout', result.stdout ?? '')
  sendLog(client, 'stderr', result.stderr ?? '')
  if (result.error) {
    sendCtl(client, { op: 'spawn', status: 'error', backend: kind, message: result.error.message })
    return false
  }
  if (result.status !== 0) {
    sendCtl(client, {
      op: 'spawn',
      status: 'error',
      backend: kind,
      message: `Cursor CLI install check failed with exit ${result.status}`,
    })
    return false
  }
  return true
}

function spawnBackend(kind: BackendKind, client: WebSocket, model?: string): void {
  killChild()
  const cwd = process.env.SHIP_REPO_CWD || process.cwd()
  if (!prepareBackend(kind, client, cwd)) return
  const { cmd, args } = backendArgv(kind, model)
  if (kind === 'cursor') {
    sendLog(client, 'stderr', `[ship-acp-bridge] launching Cursor ACP (model=${model && model !== 'auto' ? model : 'default'})\n`)
  }
  try {
    const spawnEnv: Record<string, string | undefined> = {
      ...process.env,
      ...backendEnv(kind, model),
    }
    if (kind === 'codex') {
      spawnEnv.HOME = spawnEnv.HOME || '/home/user'
      spawnEnv.CODEX_HOME = `${spawnEnv.HOME}/.codex`
      spawnEnv.NO_BROWSER = '1'
      if (codexUsesChatGptAuth()) {
        delete spawnEnv.OPENAI_API_KEY
        delete spawnEnv.CODEX_API_KEY
      }
    }
    child = spawn(cmd, args, {
      cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: spawnEnv as NodeJS.ProcessEnv,
    })
  } catch (err) {
    sendCtl(client, { op: 'spawn', status: 'error', backend: kind, message: `spawn failed: ${String(err)}` })
    return
  }

  sendCtl(client, { op: 'spawn', status: 'ok', backend: kind, pid: child.pid, ...(model ? { model } : {}) })

  child.stdout?.on('data', (chunk: Buffer) => {
    stdoutBuf += chunk.toString('utf8')
    let nl = stdoutBuf.indexOf('\n')
    while (nl >= 0) {
      const line = stdoutBuf.slice(0, nl).trimEnd()
      stdoutBuf = stdoutBuf.slice(nl + 1)
      if (line.length > 0) {
        try {
          client.send(JSON.stringify({ type: 'rpc_in', line }))
        } catch {
          /* socket closing */
        }
      }
      nl = stdoutBuf.indexOf('\n')
    }
  })

  child.stderr?.on('data', (chunk: Buffer) => {
    const now = Date.now()
    if (now > stderrRate.resetAt) {
      stderrRate = { count: 0, resetAt: now + 1000 }
    }
    if (stderrRate.count++ > 40) return
    const s = chunk.toString('utf8').slice(0, 4000)
    try {
      client.send(JSON.stringify({ type: 'log', stream: 'stderr', data: s }))
    } catch {
      /* ignore */
    }
  })

  child.on('error', (err) => {
    sendCtl(client, {
      op: 'spawn',
      status: 'error',
      backend: kind,
      message: `ACP backend failed to start: ${err.message}`,
    })
    child = null
  })

  child.on('exit', (code, signal) => {
    try {
      client.send(JSON.stringify({ type: 'log', stream: 'stderr', data: `child exit code=${code} signal=${signal}` }))
    } catch {
      /* ignore */
    }
    sendCtl(client, {
      op: 'child',
      status: 'exit',
      backend: kind,
      code,
      signal,
      message: `ACP backend exited code=${code} signal=${signal}`,
    })
    child = null
  })
}

function parseBearer(auth: string | undefined): string | null {
  if (!auth) return null
  const m = /^Bearer\s+(.+)$/i.exec(auth.trim())
  return m?.[1] ?? null
}

function authorize(req: http.IncomingMessage, expected: string | undefined): boolean {
  if (!expected) return false
  const u = new URL(req.url || '/', 'http://127.0.0.1')
  const q = u.searchParams.get('token')
  if (q && q === expected) return true
  const bearer = parseBearer(req.headers.authorization)
  return !!bearer && bearer === expected
}

function handleCtl(ws: WebSocket, msg: { op?: string; backend?: string; model?: string }): void {
  if (msg.op === 'reset') {
    killChild()
    return
  }
  if (msg.op === 'spawn' && msg.backend) {
    spawnBackend(msg.backend as BackendKind, ws as unknown as WebSocket, msg.model)
  }
}

function handleRpcOut(line: string): void {
  if (!child?.stdin) return
  child.stdin.write(`${line.replace(/\r?\n/g, '')}\n`)
}

const { port } = parseArgs(process.argv)
const token = process.env.SHIP_BRIDGE_TOKEN

const server = http.createServer((req, res) => {
  const u = new URL(req.url || '/', `http://${req.headers.host || '127.0.0.1'}`)
  if (req.method === 'GET' && u.pathname === '/healthz') {
    if (!authorize(req, token)) {
      res.writeHead(401, { 'Content-Type': 'application/json; charset=utf-8' })
      res.end(JSON.stringify({ ok: false, error: 'unauthorized' }))
      return
    }
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' })
    res.end(
      JSON.stringify({
        ok: true,
        version: BRIDGE_VERSION,
        cwd: process.env.SHIP_REPO_CWD || process.cwd(),
        pid: process.pid,
        childPid: child?.pid ?? null,
      }),
    )
    return
  }
  res.writeHead(404)
  res.end()
})

const wss = new WebSocketServer({ noServer: true })

server.on('upgrade', (req, socket, head) => {
  const u = new URL(req.url || '/', `http://${req.headers.host || '127.0.0.1'}`)
  if (u.pathname !== '/ship-acp') {
    socket.destroy()
    return
  }
  if (!authorize(req, token)) {
    socket.write('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n')
    socket.destroy()
    return
  }
  wss.handleUpgrade(req, socket, head, (ws) => {
    wss.emit('connection', ws, req)
  })
})

wss.on('connection', (ws: WebSocket) => {
  ws.on('message', (raw) => {
    let msg: unknown
    try {
      msg = JSON.parse(raw.toString())
    } catch {
      return
    }
    if (!msg || typeof msg !== 'object') return
    const m = msg as { type?: string; op?: string; backend?: string; line?: string }
    if (m.type === 'ctl') {
      handleCtl(ws, m)
      return
    }
    if (m.type === 'rpc_out' && typeof m.line === 'string') {
      handleRpcOut(m.line)
    }
  })

  ws.on('close', () => {
    killChild()
  })
})

server.listen(port, '0.0.0.0', () => {
  process.stderr.write(`[ship-acp-bridge] listening 0.0.0.0:${port}\n`)
})
