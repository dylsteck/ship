/**
 * Resolves a valid GitHub OAuth access token for a user, refreshing when possible.
 */

import type { Env } from '../env.d'

type AccountRow = {
  access_token: string | null
  refresh_token: string | null
  expires_at: number | null
}

const TOKEN_REFRESH_BUFFER_SEC = 120

export type GitHubTokenResult =
  | { token: string; refreshed?: boolean }
  | { token: null; reason: 'not_connected' | 'refresh_failed'; message: string }

function basicAuthHeader(clientId: string, clientSecret: string): string {
  const pair = `${clientId}:${clientSecret}`
  // Workers provide btoa; encode UTF-8 safely for client id/secret
  const bytes = new TextEncoder().encode(pair)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!)
  return `Basic ${btoa(binary)}`
}

async function refreshGitHubAccessToken(
  db: D1Database,
  userId: string,
  refreshToken: string,
  env: Env,
): Promise<{ access_token: string; refresh_token: string | null; expires_at: number | null } | null> {
  if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET) return null

  const body = new URLSearchParams()
  body.set('grant_type', 'refresh_token')
  body.set('refresh_token', refreshToken)

  const res = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
      Authorization: basicAuthHeader(env.GITHUB_CLIENT_ID, env.GITHUB_CLIENT_SECRET),
    },
    body,
    signal: AbortSignal.timeout(15_000),
  })

  if (!res.ok) return null

  const data = (await res.json()) as {
    access_token?: string
    refresh_token?: string
    expires_in?: number
    error?: string
    error_description?: string
  }

  if (data.error || !data.access_token) return null

  const nowSec = Math.floor(Date.now() / 1000)
  const expiresAt = typeof data.expires_in === 'number' ? nowSec + data.expires_in : null
  const newRefresh = data.refresh_token ?? refreshToken

  await db
    .prepare(
      `UPDATE accounts SET access_token = ?, refresh_token = ?, expires_at = ? WHERE user_id = ? AND provider = 'github'`,
    )
    .bind(data.access_token, newRefresh, expiresAt, userId)
    .run()

  return { access_token: data.access_token, refresh_token: newRefresh, expires_at: expiresAt }
}

/**
 * Returns a GitHub access token for API/git operations, refreshing OAuth tokens when expired.
 */
export async function getGitHubAccessTokenForUser(db: D1Database, env: Env, userId: string): Promise<GitHubTokenResult> {
  const row = await db
    .prepare(
      'SELECT access_token, refresh_token, expires_at FROM accounts WHERE user_id = ? AND provider = ? LIMIT 1',
    )
    .bind(userId, 'github')
    .first<AccountRow>()

  if (!row?.access_token && !row?.refresh_token) {
    return {
      token: null,
      reason: 'not_connected',
      message: 'GitHub is not connected. Open Settings and connect GitHub to use private repositories.',
    }
  }

  const nowSec = Math.floor(Date.now() / 1000)
  const expiresAt = row.expires_at
  const accessStillValid =
    row.access_token &&
    (!expiresAt || expiresAt - TOKEN_REFRESH_BUFFER_SEC > nowSec)

  if (accessStillValid && row.access_token) {
    return { token: row.access_token }
  }

  if (row.refresh_token) {
    const refreshed = await refreshGitHubAccessToken(db, userId, row.refresh_token, env)
    if (refreshed) {
      return { token: refreshed.access_token, refreshed: true }
    }
  }

  if (row.access_token && !expiresAt) {
    // Classic OAuth tokens without expiry metadata — use stored access token
    return { token: row.access_token }
  }

  return {
    token: null,
    reason: 'refresh_failed',
    message:
      'Your GitHub login has expired or was revoked. Open Settings, disconnect GitHub, and sign in again to restore access to private repositories.',
  }
}
