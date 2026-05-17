/**
 * Detect when the optional GitHub emulator should intercept traffic.
 *
 * No new env vars: the activation signal is the sentinel value
 * `GITHUB_CLIENT_ID === 'emulate'`. The URL is derived from the existing
 * `NEXT_PUBLIC_APP_URL` (the emulator route is mounted at
 * `/emulate/github` on the web app's own origin).
 *
 * Production deploys are double-guarded — `NODE_ENV === 'production'`
 * always wins, even if someone leaks `GITHUB_CLIENT_ID=emulate` into a
 * prod environment. The flag is server-only and never reaches the browser
 * bundle.
 *
 * @packageDocumentation
 */

/** Magic value of {@link process.env.GITHUB_CLIENT_ID} that turns on emulate. */
export const EMULATE_SENTINEL = 'emulate'

/**
 * `true` when the emulator should intercept GitHub traffic.
 *
 * Strict order of checks:
 *   1. `NODE_ENV !== 'production'` (defense in depth).
 *   2. `GITHUB_CLIENT_ID === 'emulate'` (operator opt-in).
 */
export function isGitHubEmulatorActive(): boolean {
  if (process.env.NODE_ENV === 'production') return false
  return process.env.GITHUB_CLIENT_ID === EMULATE_SENTINEL
}

/**
 * Resolve the emulator base URL.
 *
 * @returns Origin + `/emulate/github` when the emulator is on, otherwise
 *   `null` (callers should fall back to real github.com endpoints).
 */
export function getGitHubEmulatorBaseUrl(): string | null {
  if (!isGitHubEmulatorActive()) return null
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/+$/, '')
  if (!appUrl) return null
  return `${appUrl}/emulate/github`
}

/**
 * Resolve the GitHub REST API base.
 *
 * - Real:    `https://api.github.com`
 * - Emulator: `${NEXT_PUBLIC_APP_URL}/emulate/github`
 */
export function getGitHubApiBaseUrl(): string {
  return getGitHubEmulatorBaseUrl() ?? 'https://api.github.com'
}

/**
 * Resolve the GitHub OAuth host (used to build authorize/token URLs).
 *
 * - Real:    `https://github.com`
 * - Emulator: `${NEXT_PUBLIC_APP_URL}/emulate/github`
 */
export function getGitHubOAuthBaseUrl(): string {
  return getGitHubEmulatorBaseUrl() ?? 'https://github.com'
}
