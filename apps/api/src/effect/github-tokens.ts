/**
 * GitHub OAuth token resolution, expressed as an Effect service.
 *
 * This is a faithful port of the original `getGitHubAccessTokenForUser` logic:
 * the observable behaviour and {@link GitHubTokenResult} contract are identical,
 * but the implementation now lives in the Effect world — database access and the
 * OAuth refresh call run through the typed error channel, and the D1 binding /
 * OAuth credentials are injected via {@link Database} / {@link OAuthConfig}.
 *
 * @packageDocumentation
 */

import { Context, Effect, Layer } from 'effect'

import { DatabaseError, GitHubApiError } from './errors'
import { Database, OAuthConfig } from './services'

/** Public result contract returned to callers (unchanged from the original). */
export type GitHubTokenResult =
  | { token: string; refreshed?: boolean }
  | { token: null; reason: 'not_connected' | 'refresh_failed'; message: string }

interface AccountRow {
  access_token: string | null
  refresh_token: string | null
  expires_at: number | null
}

const TOKEN_REFRESH_BUFFER_SEC = 120

const NOT_CONNECTED_MESSAGE =
  'GitHub is not connected. Open Settings and connect GitHub to use private repositories.'

const REFRESH_FAILED_MESSAGE =
  'Your GitHub login has expired or was revoked. Open Settings, disconnect GitHub, and sign in again to restore access to private repositories.'

/** Encode `client_id:client_secret` as an HTTP Basic auth header value. */
function basicAuthHeader(clientId: string, clientSecret: string): string {
  const pair = `${clientId}:${clientSecret}`
  // Workers provide btoa; encode UTF-8 safely for client id/secret
  const bytes = new TextEncoder().encode(pair)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!)
  return `Basic ${btoa(binary)}`
}

interface RefreshedTokens {
  access_token: string
  refresh_token: string | null
  expires_at: number | null
}

/** Service interface for resolving a usable GitHub access token. */
export interface GitHubTokensService {
  /** Resolve a token for a user, refreshing OAuth tokens when expired. */
  readonly getForUser: (
    userId: string,
  ) => Effect.Effect<GitHubTokenResult, DatabaseError | GitHubApiError>
}

/** Injectable {@link GitHubTokensService}. */
export class GitHubTokens extends Context.Tag('GitHubTokens')<GitHubTokens, GitHubTokensService>() {}

/** Live implementation backed by the {@link Database} and {@link OAuthConfig} services. */
export const GitHubTokensLive = Layer.effect(
  GitHubTokens,
  Effect.gen(function* () {
    const db = yield* Database
    const oauth = yield* OAuthConfig

    const refresh = (
      userId: string,
      refreshToken: string,
    ): Effect.Effect<RefreshedTokens | null, DatabaseError | GitHubApiError> =>
      Effect.gen(function* () {
        if (!oauth.clientId || !oauth.clientSecret) return null

        const body = new URLSearchParams()
        body.set('grant_type', 'refresh_token')
        body.set('refresh_token', refreshToken)

        const res = yield* Effect.tryPromise({
          try: () =>
            fetch('https://github.com/login/oauth/access_token', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                Accept: 'application/json',
                Authorization: basicAuthHeader(oauth.clientId!, oauth.clientSecret!),
              },
              body,
              signal: AbortSignal.timeout(15_000),
            }),
          catch: (cause) => new GitHubApiError({ operation: 'oauth.refresh', cause }),
        })

        if (!res.ok) return null

        const data = yield* Effect.tryPromise({
          try: () =>
            res.json() as Promise<{
              access_token?: string
              refresh_token?: string
              expires_in?: number
              error?: string
              error_description?: string
            }>,
          catch: (cause) =>
            new GitHubApiError({ operation: 'oauth.refresh.parse', status: res.status, cause }),
        })

        if (data.error || !data.access_token) return null

        const nowSec = Math.floor(Date.now() / 1000)
        const expiresAt = typeof data.expires_in === 'number' ? nowSec + data.expires_in : null
        const newRefresh = data.refresh_token ?? refreshToken

        yield* Effect.tryPromise({
          try: () =>
            db
              .prepare(
                `UPDATE accounts SET access_token = ?, refresh_token = ?, expires_at = ? WHERE user_id = ? AND provider = 'github'`,
              )
              .bind(data.access_token!, newRefresh, expiresAt, userId)
              .run(),
          catch: (cause) => new DatabaseError({ operation: 'accounts.update', cause }),
        })

        return { access_token: data.access_token, refresh_token: newRefresh, expires_at: expiresAt }
      })

    const getForUser = (
      userId: string,
    ): Effect.Effect<GitHubTokenResult, DatabaseError | GitHubApiError> =>
      Effect.gen(function* () {
        const row = yield* Effect.tryPromise({
          try: () =>
            db
              .prepare(
                'SELECT access_token, refresh_token, expires_at FROM accounts WHERE user_id = ? AND provider = ? LIMIT 1',
              )
              .bind(userId, 'github')
              .first<AccountRow>(),
          catch: (cause) => new DatabaseError({ operation: 'accounts.select', cause }),
        })

        if (!row?.access_token && !row?.refresh_token) {
          return { token: null, reason: 'not_connected', message: NOT_CONNECTED_MESSAGE }
        }

        const nowSec = Math.floor(Date.now() / 1000)
        const expiresAt = row.expires_at
        const accessStillValid =
          row.access_token && (!expiresAt || expiresAt - TOKEN_REFRESH_BUFFER_SEC > nowSec)

        if (accessStillValid && row.access_token) {
          return { token: row.access_token }
        }

        if (row.refresh_token) {
          const refreshed = yield* refresh(userId, row.refresh_token)
          if (refreshed) {
            return { token: refreshed.access_token, refreshed: true }
          }
        }

        if (row.access_token && !expiresAt) {
          // Classic OAuth tokens without expiry metadata — use stored access token
          return { token: row.access_token }
        }

        return { token: null, reason: 'refresh_failed', message: REFRESH_FAILED_MESSAGE }
      })

    return GitHubTokens.of({ getForUser })
  }),
)

/**
 * Build the fully-wired program that resolves a GitHub token for a user from a
 * raw D1 binding and OAuth credentials. Used by the thin compatibility wrapper
 * in `lib/github-token.ts` so existing callers keep an identical signature.
 */
export function resolveGitHubTokenEffect(
  db: D1Database,
  oauth: { clientId?: string; clientSecret?: string },
  userId: string,
): Effect.Effect<GitHubTokenResult, DatabaseError | GitHubApiError> {
  return Effect.gen(function* () {
    const tokens = yield* GitHubTokens
    return yield* tokens.getForUser(userId)
  }).pipe(
    Effect.provide(GitHubTokensLive),
    Effect.provideService(Database, db),
    Effect.provideService(OAuthConfig, oauth),
  )
}
