/**
 * Resolves a valid GitHub OAuth access token for a user, refreshing when possible.
 *
 * This is a thin compatibility wrapper: the implementation now lives in the
 * Effect layer (`../effect/github-tokens`). The public signature and the
 * {@link GitHubTokenResult} contract are unchanged, so every existing caller
 * behaves identically while the internals gain typed errors and DI.
 */

import type { Env } from '../env.d'
import { resolveGitHubTokenEffect, type GitHubTokenResult } from '../effect/github-tokens'
import { runPromise } from '../effect/runtime'

export type { GitHubTokenResult }

/**
 * Returns a GitHub access token for API/git operations, refreshing OAuth tokens when expired.
 */
export async function getGitHubAccessTokenForUser(
  db: D1Database,
  env: Env,
  userId: string,
): Promise<GitHubTokenResult> {
  return runPromise(
    resolveGitHubTokenEffect(
      db,
      { clientId: env.GITHUB_CLIENT_ID, clientSecret: env.GITHUB_CLIENT_SECRET },
      userId,
    ),
  )
}
