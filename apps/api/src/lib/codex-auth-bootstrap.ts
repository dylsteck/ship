/**
 * Shell snippet to seed Codex ChatGPT-subscription auth in the sandbox via access token.
 *
 * @remarks
 * The Worker injects `CODEX_ACCESS_TOKEN`; this runs once during bridge bootstrap and writes
 * `~/.codex/auth.json` for `codex-acp` to reuse. See https://developers.openai.com/codex/auth
 *
 * Must be a single bash `-c` fragment (joined with ` ; ` in bridge bootstrap) — do not join
 * `if`/`then`/`else` lines with semicolons or bash rejects `then ;`.
 *
 * @packageDocumentation
 */

/** Bash commands that log in with `CODEX_ACCESS_TOKEN` when set (no-op otherwise). */
export function codexAccessTokenLoginShell(): string {
  return `[ -z "$CODEX_ACCESS_TOKEN" ] || { mkdir -p "$HOME/.codex"; if command -v codex >/dev/null 2>&1; then printenv CODEX_ACCESS_TOKEN | codex login --with-access-token; elif command -v npx >/dev/null 2>&1; then printenv CODEX_ACCESS_TOKEN | npx --yes @openai/codex login --with-access-token; else echo "CODEX_ACCESS_TOKEN set but codex CLI missing — bake @openai/codex into the E2B template" >&2; exit 1; fi; }`
}
