/**
 * ACP backend command and environment resolution for the sandbox bridge.
 *
 * @packageDocumentation
 */

/** ACP backends supported by Ship. */
export type BackendKind = 'codex' | 'claude' | 'cursor' | 'opencode'

/** Increment when startup behavior changes so old sandbox bridge processes restart. */
export const BRIDGE_VERSION = '7'

/** Resolve the subprocess command used for a backend. */
export function backendArgv(kind: BackendKind, model?: string): { cmd: string; args: string[] } {
  const overrides: Partial<Record<BackendKind, string>> = {
    codex: process.env.SHIP_ACP_CODEX_CMD || '',
    claude: process.env.SHIP_ACP_CLAUDE_CMD || '',
    cursor: process.env.SHIP_ACP_CURSOR_CMD || '',
    opencode: process.env.SHIP_ACP_OPENCODE_CMD || '',
  }
  const raw = overrides[kind]?.trim()
  if (raw) {
    const parts = raw.split(/\s+/).filter(Boolean)
    return { cmd: parts[0]!, args: parts.slice(1) }
  }
  switch (kind) {
    case 'codex':
      return npxFallback('codex-acp', '@zed-industries/codex-acp@latest')
    case 'claude':
      return npxFallback('claude-agent-acp', '@agentclientprotocol/claude-agent-acp@latest')
    case 'cursor':
      return cursorArgv(model)
    case 'opencode':
      return npxFallback('opencode acp', 'opencode-ai@latest acp')
    default:
      throw new Error(`unknown backend ${kind}`)
  }
}

/** Resolve extra environment variables for the selected backend. */
export function backendEnv(kind: BackendKind, model?: string): Record<string, string> {
  if (!model) return {}
  const common = { SHIP_ACP_SELECTED_MODEL: model }
  switch (kind) {
    case 'claude':
      return { ...common, ANTHROPIC_MODEL: model }
    case 'codex':
      return { ...common, CODEX_MODEL: model, OPENAI_MODEL: model }
    case 'cursor':
      return { ...common, CURSOR_AGENT_MODEL: model }
    case 'opencode':
      return { ...common, OPENCODE_MODEL: model, OPENCODE_CONFIG_CONTENT: opencodeConfigContent(model) }
    default:
      return common
  }
}

function npxFallback(existingCommand: string, npxCommand: string): { cmd: string; args: string[] } {
  const [binary, ...binaryArgs] = existingCommand.split(/\s+/).filter(Boolean)
  const existingExec = `exec ${[binary!, ...binaryArgs].map(shellQuote).join(' ')}`
  return {
    cmd: 'bash',
    args: [
      '-lc',
      `if command -v ${shellQuote(binary!)} >/dev/null 2>&1; then ${existingExec}; fi; exec npx --yes ${npxCommand}`,
    ],
  }
}

function cursorArgv(model?: string): { cmd: string; args: string[] } {
  const args: string[] = []
  if (process.env.CURSOR_API_KEY) {
    args.push('--api-key', process.env.CURSOR_API_KEY)
  } else if (process.env.CURSOR_AUTH_TOKEN) {
    args.push('--auth-token', process.env.CURSOR_AUTH_TOKEN)
  } else {
    throw new Error('Cursor ACP requires CURSOR_API_KEY or CURSOR_AUTH_TOKEN.')
  }
  if (model && model !== 'auto') {
    args.push('--model', model)
  }
  args.push('acp')
  return {
    cmd: 'bash',
    args: ['-lc', `export PATH="$HOME/.local/bin:$PATH"; exec agent ${args.map(shellQuote).join(' ')}`],
  }
}

function opencodeConfigContent(model: string): string {
  const raw = process.env.OPENCODE_CONFIG_CONTENT
  if (!raw) return JSON.stringify({ model })
  try {
    const parsed = JSON.parse(raw) as unknown
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return JSON.stringify({ ...(parsed as Record<string, unknown>), model })
    }
  } catch {
    /* fall back to a minimal runtime override */
  }
  return JSON.stringify({ model })
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, "'\\''")}'`
}
