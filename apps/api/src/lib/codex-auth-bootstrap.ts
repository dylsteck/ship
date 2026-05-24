/**
 * Seed Codex ChatGPT-subscription auth in the E2B sandbox.
 *
 * @remarks
 * Two supported paths (see https://developers.openai.com/codex/auth):
 *
 * - **`CODEX_AUTH_JSON`** — personal Plus/Pro: paste `~/.codex/auth.json` after local `codex login`
 * - **`CODEX_ACCESS_TOKEN`** — enterprise agent-identity tokens from chatgpt.com/admin/access-tokens
 *   (not the OAuth JWT from auth.json)
 *
 * @packageDocumentation
 */

import type { Sandbox } from '@ship/sandbox'
import type { Env } from '../env.d'

/** Default Codex home inside the stock E2B template user. */
export const CODEX_AUTH_PATH = '/home/user/.codex/auth.json'

/** Whether Worker env configures ChatGPT-subscription Codex auth (not API-key billing). */
export function hasCodexSubscriptionAuth(env: Env): boolean {
  return Boolean(env.CODEX_AUTH_JSON?.trim() || env.CODEX_ACCESS_TOKEN)
}

/** Core login body — requires `CODEX_ACCESS_TOKEN` in the environment. */
export function codexAccessTokenLoginBody(): string {
  return `mkdir -p "$HOME/.codex"; if command -v codex >/dev/null 2>&1; then printenv CODEX_ACCESS_TOKEN | codex login --with-access-token; elif command -v npx >/dev/null 2>&1; then printenv CODEX_ACCESS_TOKEN | npx --yes @openai/codex login --with-access-token; else echo "CODEX_ACCESS_TOKEN set but codex CLI missing — bake @openai/codex into the E2B template" >&2; exit 1; fi; test -f "$HOME/.codex/auth.json"`
}

/** Bash fragment for bridge start — no-op when the token is unset. */
export function codexAccessTokenLoginShell(): string {
  return `[ -z "$CODEX_ACCESS_TOKEN" ] || { ${codexAccessTokenLoginBody()}; }`
}

const ACCESS_TOKEN_HINT =
  'CODEX_ACCESS_TOKEN must be an enterprise agent-identity token from https://chatgpt.com/admin/access-tokens — not the OAuth JWT from ~/.codex/auth.json. For personal ChatGPT subs, use CODEX_AUTH_JSON instead.'

/** Write ~/.codex/auth.json or run `codex login --with-access-token` before bridge/codex-acp start. */
export async function ensureCodexAuthInSandbox(input: {
  sandbox: Sandbox
  env: Env
  workingDirectory: string
}): Promise<void> {
  const authJson = input.env.CODEX_AUTH_JSON?.trim()
  if (authJson) {
    let parsed: unknown
    try {
      parsed = JSON.parse(authJson)
    } catch {
      throw new Error(
        'CODEX_AUTH_JSON is not valid JSON — paste the contents of ~/.codex/auth.json after running `codex login` locally',
      )
    }
    if (!parsed || typeof parsed !== 'object') {
      throw new Error('CODEX_AUTH_JSON must be a JSON object (contents of ~/.codex/auth.json)')
    }
    await input.sandbox.writeFile(CODEX_AUTH_PATH, authJson, 'utf-8')
    const verify = await input.sandbox.exec(
      `test -s '${CODEX_AUTH_PATH.replace(/'/g, `'\\''`)}'`,
      input.workingDirectory,
      30_000,
    )
    if (!verify.success) {
      throw new Error('Failed to write Codex auth.json into the sandbox (~/.codex/auth.json)')
    }
    return
  }

  if (!input.env.CODEX_ACCESS_TOKEN) return

  const escaped = input.env.CODEX_ACCESS_TOKEN.replace(/'/g, `'\\''`)
  const cmd = [`export CODEX_ACCESS_TOKEN='${escaped}'`, codexAccessTokenLoginBody()].join(' ; ')

  const run = await input.sandbox.exec(cmd, input.workingDirectory, 120_000)
  if (!run.success) {
    const detail = (run.stderr || run.stdout || 'missing ~/.codex/auth.json').trim()
    throw new Error(`Codex access-token login failed (exit ${run.exitCode}): ${detail}\n${ACCESS_TOKEN_HINT}`)
  }
}
