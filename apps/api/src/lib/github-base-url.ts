/**
 * Resolve the active GitHub REST + OAuth base URLs for Worker code.
 *
 * No new env vars: when {@link Env.GITHUB_CLIENT_ID} is the sentinel
 * `emulate` (and we're not in production), all GitHub traffic is routed
 * to `<first-localhost-origin-from-ALLOWED_ORIGINS>/emulate/github`. The
 * web app mounts the emulator there.
 *
 * Production is double-guarded — `ENVIRONMENT === 'production'` always
 * wins, even if the sentinel leaks into a prod environment.
 *
 * @packageDocumentation
 */

import type { Env } from '../env.d'

/** Magic value of {@link Env.GITHUB_CLIENT_ID} that turns on emulate. */
export const EMULATE_SENTINEL = 'emulate'

const REAL_GITHUB_API = 'https://api.github.com'
const REAL_GITHUB_OAUTH = 'https://github.com'

type EmulateEnv = Pick<Env, 'GITHUB_CLIENT_ID' | 'ENVIRONMENT' | 'ALLOWED_ORIGINS'>

/**
 * `true` when the emulator should intercept Worker GitHub traffic.
 *
 * @remarks
 * Both gating conditions must hold — production wins regardless of the
 * sentinel, and the sentinel must be set explicitly to opt in.
 */
export function isGitHubEmulatorActive(env: EmulateEnv): boolean {
  if (env.ENVIRONMENT === 'production') return false
  return env.GITHUB_CLIENT_ID === EMULATE_SENTINEL
}

/**
 * Pick the GitHub REST API base URL.
 *
 * @example
 * ```ts
 * new Octokit({ auth: token, baseUrl: getGitHubApiBaseUrl(c.env) })
 * ```
 */
export function getGitHubApiBaseUrl(env: EmulateEnv): string {
  return resolveEmulatorBase(env) ?? REAL_GITHUB_API
}

/**
 * Pick the GitHub OAuth host (used when refreshing access tokens).
 *
 * Real GitHub serves `/login/oauth/access_token` from `github.com`; the
 * emulator serves the same path from its own base URL.
 */
export function getGitHubOAuthBaseUrl(env: EmulateEnv): string {
  return resolveEmulatorBase(env) ?? REAL_GITHUB_OAUTH
}

/**
 * Derive the emulator base URL from existing env, or `null` when off.
 *
 * Picks the first `http://localhost*` entry from `ALLOWED_ORIGINS`,
 * falling back to the first entry overall.
 */
function resolveEmulatorBase(env: EmulateEnv): string | null {
  if (!isGitHubEmulatorActive(env)) return null
  const origins = (env.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
  if (origins.length === 0) return null
  const localhost = origins.find((origin) => /^https?:\/\/localhost(:|\/|$)/.test(origin))
  const origin = (localhost ?? origins[0]).replace(/\/+$/, '')
  return `${origin}/emulate/github`
}
