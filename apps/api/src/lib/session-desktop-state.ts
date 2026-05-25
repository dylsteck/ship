/** Desktop bridge startup for session sandboxes. */

import { Sandbox } from '@e2b/code-interpreter'
import type { Env } from '../env.d'

const DO_URL = 'https://do'
const NOVNC_PORT = 6080
const VNC_PORT = 5900
const DESKTOP_BRIDGE_VERSION = '2'

/** Desktop state exposed to the web right sidebar. */
export interface SessionDesktopState {
  status: 'starting' | 'ready' | 'unavailable' | 'error'
  url?: string
  message?: string
}

interface CollectSessionDesktopStateInput {
  env: Env
  stub: { fetch: typeof fetch }
  connectSandbox?: (sandboxId: string, env: Env) => Promise<DesktopSandbox>
  createToken?: () => string
  force?: boolean
}

interface DesktopSandbox {
  getHost(port: number): string
  commands: {
    run(command: string, options?: { timeoutMs?: number }): Promise<CommandOutput>
  }
}

interface CommandOutput {
  stdout?: string
  stderr?: string
  exitCode?: number
}

interface SandboxStatus {
  sandboxId?: string | null
  status?: string | null
}

/** Collect or lazily start the browser-accessible desktop for a session. */
export async function collectSessionDesktopState(input: CollectSessionDesktopStateInput): Promise<SessionDesktopState> {
  const [meta, sandboxStatus] = await Promise.all([fetchMeta(input.stub), fetchSandboxStatus(input.stub)])
  if (!input.force && meta['desktop_status'] === 'ready' && meta['desktop_bridge_version'] === DESKTOP_BRIDGE_VERSION && meta['desktop_url']) {
    return { status: 'ready', url: meta['desktop_url'] }
  }
  if (!sandboxStatus.sandboxId) {
    return { status: 'unavailable', message: 'Session has no sandbox yet. Send a message to start the session.' }
  }

  const token = !input.force && meta['desktop_token'] ? meta['desktop_token'] : input.createToken?.() || createDesktopToken()
  await setMeta(input.stub, { desktop_status: 'starting', desktop_token: token, desktop_updated_at: Date.now().toString() })

  try {
    const connect = input.connectSandbox ?? connectE2BSandbox
    const sandbox = await connect(sandboxStatus.sandboxId, input.env)
    await ensureDesktopBridge(sandbox)
    const url = buildDesktopUrl(sandbox)
    await setMeta(input.stub, {
      desktop_status: 'ready',
      desktop_url: url,
      desktop_port: NOVNC_PORT.toString(),
      desktop_vnc_port: VNC_PORT.toString(),
      desktop_token: token,
      desktop_bridge_version: DESKTOP_BRIDGE_VERSION,
      desktop_message: '',
      desktop_updated_at: Date.now().toString(),
    })
    return { status: 'ready', url }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await setMeta(input.stub, {
      desktop_status: 'error',
      desktop_message: message,
      desktop_updated_at: Date.now().toString(),
    }).catch(() => undefined)
    return { status: 'error', message }
  }
}

async function connectE2BSandbox(sandboxId: string, env: Env): Promise<DesktopSandbox> {
  return Sandbox.connect(sandboxId, { apiKey: env.E2B_API_KEY, timeoutMs: 5 * 60 * 1000 }) as Promise<DesktopSandbox>
}

function buildDesktopUrl(sandbox: DesktopSandbox): string {
  const host = sandbox.getHost(NOVNC_PORT)
  const params = new URLSearchParams({
    autoconnect: '1',
    resize: 'scale',
    reconnect: '1',
  })
  return `https://${host}/vnc.html?${params.toString()}`
}

async function ensureDesktopBridge(sandbox: DesktopSandbox): Promise<void> {
  const command = buildDesktopStartupScript()
  const result = await sandbox.commands.run(command, { timeoutMs: 240_000 })
  if (typeof result.exitCode === 'number' && result.exitCode !== 0) {
    throw new Error(trimCommandOutput(result) || `Desktop startup failed with exit code ${result.exitCode}`)
  }
}

function buildDesktopStartupScript(): string {
  return `
set -euo pipefail

export DEBIAN_FRONTEND=noninteractive
export DISPLAY=:99

NOVNC_PORT=${NOVNC_PORT}
VNC_PORT=${VNC_PORT}
WORK_DIR=/tmp/ship-desktop

mkdir -p "$WORK_DIR"

install_desktop_deps() {
  missing=""
  for bin in Xvfb x11vnc git python3; do
    if ! command -v "$bin" >/dev/null 2>&1; then
      missing="$missing $bin"
    fi
  done
  if [ -z "$missing" ] && [ -f "$WORK_DIR/noVNC/vnc.html" ]; then
    return 0
  fi
  if ! command -v apt-get >/dev/null 2>&1; then
    echo "Desktop dependencies are missing and apt-get is unavailable in this sandbox."
    exit 86
  fi
  SUDO=""
  if command -v sudo >/dev/null 2>&1; then
    SUDO="sudo"
  fi
  $SUDO apt-get update -y
  $SUDO apt-get install -y xvfb x11vnc openbox xterm dbus-x11 git python3 python3-pip curl wget net-tools x11-apps
}

start_if_missing() {
  pattern="$1"
  shift
  if ! pgrep -f "$pattern" >/dev/null 2>&1; then
    nohup "$@" >/tmp/ship-desktop/$(echo "$pattern" | tr -cd '[:alnum:]').log 2>&1 &
  fi
}

install_desktop_deps

start_if_missing "Xvfb :99" Xvfb :99 -screen 0 1440x900x24 -ac +extension GLX +render -noreset
sleep 0.5

if command -v openbox >/dev/null 2>&1; then
  start_if_missing "openbox.*ship-desktop" env SHIP_DESKTOP_PROCESS=1 DISPLAY=:99 openbox
fi

if command -v xterm >/dev/null 2>&1; then
  start_if_missing "xterm.*ship-desktop" env SHIP_DESKTOP_PROCESS=1 DISPLAY=:99 xterm -geometry 100x30+40+40
fi

if command -v google-chrome >/dev/null 2>&1; then
  start_if_missing "google-chrome.*ship-desktop" env SHIP_DESKTOP_PROCESS=1 DISPLAY=:99 google-chrome --no-sandbox --disable-dev-shm-usage --window-size=1200,800 about:blank
elif command -v chromium >/dev/null 2>&1; then
  start_if_missing "chromium.*ship-desktop" env SHIP_DESKTOP_PROCESS=1 DISPLAY=:99 chromium --no-sandbox --disable-dev-shm-usage --window-size=1200,800 about:blank
fi

start_if_missing "x11vnc.*-rfbport $VNC_PORT" x11vnc -display :99 -forever -shared -rfbport "$VNC_PORT" -nopw -noxdamage -noxfixes -nowf -noscr -ping 1 -repeat -speeds lan

NOVNC_WEB="$WORK_DIR/noVNC"
if [ ! -f "$NOVNC_WEB/vnc.html" ]; then
  rm -rf "$NOVNC_WEB"
  git clone --depth 1 --branch e2b-desktop https://github.com/e2b-dev/noVNC.git "$NOVNC_WEB"
  ln -sf "$NOVNC_WEB/vnc.html" "$NOVNC_WEB/index.html"
fi
if [ ! -d "$NOVNC_WEB/utils/websockify" ]; then
  rm -rf "$NOVNC_WEB/utils/websockify"
  git clone --depth 1 --branch v0.12.0 https://github.com/novnc/websockify "$NOVNC_WEB/utils/websockify"
fi
if [ ! -f "$NOVNC_WEB/vnc.html" ]; then
  echo "noVNC web assets were not found after installation."
  exit 87
fi

pkill -f "novnc_proxy.*$NOVNC_PORT" >/dev/null 2>&1 || true
pkill -f "websockify.*$NOVNC_PORT" >/dev/null 2>&1 || true
cd "$NOVNC_WEB/utils"
nohup ./novnc_proxy --vnc localhost:"$VNC_PORT" --listen "$NOVNC_PORT" --web "$NOVNC_WEB" --heartbeat 30 >/tmp/ship-desktop/novnc.log 2>&1 &

for _ in $(seq 1 45); do
  if curl -fsS "http://127.0.0.1:$NOVNC_PORT/vnc.html" >/dev/null 2>&1; then
    exit 0
  fi
  sleep 1
done

echo "Timed out waiting for noVNC on port $NOVNC_PORT."
cat /tmp/ship-desktop/novnc.log 2>/dev/null || true
exit 88
`.trim()
}

async function fetchMeta(stub: { fetch: typeof fetch }): Promise<Record<string, string>> {
  const response = await stub.fetch(new Request(`${DO_URL}/meta`))
  if (!response.ok) return {}
  return response.json().catch(() => ({})) as Promise<Record<string, string>>
}

async function fetchSandboxStatus(stub: { fetch: typeof fetch }): Promise<SandboxStatus> {
  const response = await stub.fetch(new Request(`${DO_URL}/sandbox/status`))
  if (!response.ok) return {}
  return response.json().catch(() => ({})) as Promise<SandboxStatus>
}

async function setMeta(stub: { fetch: typeof fetch }, patch: Record<string, string>): Promise<void> {
  await stub.fetch(
    new Request(`${DO_URL}/meta`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    }),
  )
}

function createDesktopToken(): string {
  return crypto.randomUUID().replaceAll('-', '')
}

function trimCommandOutput(output: CommandOutput): string {
  return [output.stderr, output.stdout].filter(Boolean).join('\n').trim().slice(0, 1000)
}
