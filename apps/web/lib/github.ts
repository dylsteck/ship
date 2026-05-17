/**
 * GitHub OAuth client.
 *
 * Defaults to arctic's real `GitHub` provider. When the GitHub emulator is
 * active (see {@link getGitHubEmulatorBaseUrl}), returns a thin wrapper
 * around arctic's generic {@link OAuth2Client} pointed at the emulator's
 * `/login/oauth/authorize` and `/login/oauth/access_token` endpoints.
 *
 * Both code paths expose the same `{ createAuthorizationURL,
 * validateAuthorizationCode }` shape, so the auth route handler
 * (`app/api/auth/github/route.ts` + `callback/route.ts`) doesn't change.
 *
 * @packageDocumentation
 */

import { GitHub, OAuth2Client, type OAuth2Tokens } from 'arctic'
import { getGitHubEmulatorBaseUrl } from './emulate/env'

/**
 * Minimal interface used by Ship's auth routes.
 *
 * Keeping the surface tiny (just the two methods we actually call) makes
 * it easy to swap implementations without changing call sites.
 */
export interface GitHubOAuthClient {
  createAuthorizationURL(state: string, scopes: string[]): URL
  validateAuthorizationCode(code: string): Promise<OAuth2Tokens>
}

const GITHUB_AUTHORIZE_PATH = '/login/oauth/authorize'
const GITHUB_TOKEN_PATH = '/login/oauth/access_token'

/**
 * Build the active GitHub OAuth client.
 *
 * Read fresh from env on every call so flipping `GITHUB_CLIENT_ID` during a
 * `next dev` session takes effect on the next request.
 */
export function getGitHub(): GitHubOAuthClient {
  const emulatorBaseUrl = getGitHubEmulatorBaseUrl()
  const clientId = requireEnv('GITHUB_CLIENT_ID')
  const clientSecret = requireEnv('GITHUB_CLIENT_SECRET')
  const callbackUrl = `${requireEnv('NEXT_PUBLIC_APP_URL')}/api/auth/github/callback`

  if (!emulatorBaseUrl) {
    return new GitHub(clientId, clientSecret, callbackUrl)
  }

  return new EmulatedGitHubOAuthClient({
    clientId,
    clientSecret,
    callbackUrl,
    authorizationEndpoint: `${emulatorBaseUrl}${GITHUB_AUTHORIZE_PATH}`,
    tokenEndpoint: `${emulatorBaseUrl}${GITHUB_TOKEN_PATH}`,
  })
}

/**
 * Lazy proxy preserving the previous module-level `github` export so
 * existing call sites (`github.createAuthorizationURL(...)` etc.) keep
 * working unchanged.
 */
export const github: GitHubOAuthClient = new Proxy({} as GitHubOAuthClient, {
  get(_target, prop) {
    const client = getGitHub() as unknown as Record<string | symbol, unknown>
    const value = client[prop]
    return typeof value === 'function' ? (value as (...args: unknown[]) => unknown).bind(client) : value
  },
})

interface EmulatedClientConfig {
  clientId: string
  clientSecret: string
  callbackUrl: string
  authorizationEndpoint: string
  tokenEndpoint: string
}

/**
 * Generic OAuth 2.0 client wired to the emulator's authorize / token
 * endpoints. Implements the same surface as arctic's `GitHub` class.
 */
class EmulatedGitHubOAuthClient implements GitHubOAuthClient {
  private readonly client: OAuth2Client
  private readonly authorizationEndpoint: string
  private readonly tokenEndpoint: string

  constructor(config: EmulatedClientConfig) {
    this.client = new OAuth2Client(config.clientId, config.clientSecret, config.callbackUrl)
    this.authorizationEndpoint = config.authorizationEndpoint
    this.tokenEndpoint = config.tokenEndpoint
  }

  createAuthorizationURL(state: string, scopes: string[]): URL {
    return this.client.createAuthorizationURL(this.authorizationEndpoint, state, scopes)
  }

  validateAuthorizationCode(code: string): Promise<OAuth2Tokens> {
    return this.client.validateAuthorizationCode(this.tokenEndpoint, code, null)
  }
}

function requireEnv(name: 'GITHUB_CLIENT_ID' | 'GITHUB_CLIENT_SECRET' | 'NEXT_PUBLIC_APP_URL'): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required env var: ${name}`)
  }
  return value
}
