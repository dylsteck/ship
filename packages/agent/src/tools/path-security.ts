/**
 * Path-security helpers used by file tools.
 *
 * These functions detect attempts to read or write secret files (`.env`,
 * SSH keys, AWS credentials, etc.) and dangerous bash patterns. They are
 * cheap to evaluate so we run them in `needsApproval` for every call.
 *
 * @packageDocumentation
 */

const DOTENV_FILENAME_PATTERN = /(?:^|\/)\.env(\..*)?$/i

/**
 * `true` when the filename ends in `.env` or `.env.<suffix>` — the canonical
 * dotenv shape we always want to gate behind explicit approval.
 */
export function isDotEnvFilePath(filePath: string): boolean {
  return DOTENV_FILENAME_PATTERN.test(filePath)
}

/**
 * `true` when the path could expose user secrets even if obfuscated.
 *
 * Covers SSH keys, AWS credentials, `/proc/self/environ`, and shell-quoted
 * variants of `.env`. The patterns are intentionally permissive — false
 * positives mean an extra approval prompt; false negatives leak secrets.
 */
const SENSITIVE_PATTERNS: readonly RegExp[] = [
  DOTENV_FILENAME_PATTERN,
  /\.e['"]{2}nv/i,
  /\baws\/credentials\b/i,
  /\bid_(?:rsa|ed25519|ecdsa|dsa)\b/i,
  /\b\.ssh\b/i,
  /\bproc\/self\/environ\b/i,
]

/** Run all sensitive-path checks. */
export function isSensitivePath(filePath: string): boolean {
  return SENSITIVE_PATTERNS.some((p) => p.test(filePath))
}

/**
 * Patterns that should always require explicit approval for `bash`.
 *
 * Catches `rm -rf`, fork bombs, dd/mkfs, find -delete/-exec rm, and any
 * command that references a sensitive path.
 */
const DANGEROUS_BASH_PATTERNS: readonly RegExp[] = [
  /\brm\s+(?:[^\n;&|]*\s)?(?:-[A-Za-z]*r[A-Za-z]*f|-[A-Za-z]*f[A-Za-z]*r|-r\s+-f|-f\s+-r)/,
  /\bfind\b[^\n;&|]*(?:-delete|-exec\s+rm\b)/,
  /\b(?:shred|mkfs|dd)\b/,
  /:\(\)\s*\{\s*:\|:/,
]

/**
 * Inspect a bash command and decide whether the agent should ask before
 * running it.
 *
 * @returns `true` when the command matches a dangerous pattern OR references
 *   a sensitive path; `false` otherwise.
 */
export function bashCommandNeedsApproval(command: string): boolean {
  if (DANGEROUS_BASH_PATTERNS.some((p) => p.test(command))) return true
  return SENSITIVE_PATTERNS.some((p) => p.test(command))
}
