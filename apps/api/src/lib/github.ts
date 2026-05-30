/**
 * GitHub API wrapper using Octokit
 *
 * Provides authenticated GitHub operations:
 * - Create pull requests (draft by default)
 * - Get repository information
 * - Update PR status (mark ready for review)
 *
 * Pattern: All operations use user's GitHub token for attribution
 * Security: Tokens passed per-operation, never stored
 */

import { Cause, Effect, Exit } from 'effect'
import {
  GitHubRepos,
  makeGitHubReposLive,
  type CreatePullRequestParams,
  type GitHubReposService,
  type PullRequestResponse,
} from '../effect/github-repos'
import { runPromiseExit } from '../effect/runtime'

/**
 * GitHub API error types
 */
export class GitHubError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode?: number,
  ) {
    super(message)
    this.name = 'GitHubError'
  }
}

/**
 * Parse repository owner and name from GitHub URL
 * Supports both HTTPS and SSH formats
 *
 * @param url - GitHub repository URL
 * @returns { owner, repo } or throws if invalid
 */
export function parseRepoUrl(url: string): { owner: string; repo: string } {
  // Remove .git suffix if present
  const cleanUrl = url.replace(/\.git$/, '')

  // Match HTTPS format: https://github.com/owner/repo
  const httpsMatch = cleanUrl.match(/github\.com[/:]([\w-]+)\/([\w-]+)/)
  if (httpsMatch) {
    return {
      owner: httpsMatch[1],
      repo: httpsMatch[2],
    }
  }

  throw new GitHubError('Invalid GitHub URL format', 'INVALID_URL')
}

export type { CreatePullRequestParams, PullRequestResponse }

/**
 * GitHubClient class
 * Wraps Octokit with user token authentication
 *
 * Usage:
 *   const client = new GitHubClient(userToken)
 *   await client.createPullRequest({ ... })
 */
export class GitHubClient {
  private token: string

  constructor(token: string) {
    this.token = token
  }

  /** Return the user token backing this compatibility client. */
  getToken(): string {
    return this.token
  }

  private async run<A>(
    use: (repos: GitHubReposService) => Effect.Effect<A, import('../effect/errors').GitHubRepoError>,
  ): Promise<A> {
    const exit = await runPromiseExit(
      Effect.gen(function* () {
        const repos = yield* GitHubRepos
        return yield* use(repos)
      }).pipe(Effect.provide(makeGitHubReposLive(this.token))),
    )

    if (Exit.isSuccess(exit)) return exit.value

    const failure = Cause.failureOption(exit.cause)
    if (failure._tag === 'Some' && failure.value._tag === 'GitHubRepoError') {
      throw new GitHubError(failure.value.message, failure.value.code, failure.value.status)
    }

    const defect = Cause.squash(exit.cause)
    throw new GitHubError(defect instanceof Error ? defect.message : String(defect), 'UNKNOWN')
  }

  /**
   * Get repository information
   *
   * @param owner - Repository owner
   * @param repo - Repository name
   * @returns Repository data
   */
  async getRepository(owner: string, repo: string) {
    return this.run((repos) => repos.getRepository(owner, repo))
  }

  /**
   * Check if a pull request already exists for the given branch
   *
   * @param owner - Repository owner
   * @param repo - Repository name
   * @param head - Branch name to check
   * @returns PR number if exists, null otherwise
   */
  async findExistingPR(owner: string, repo: string, head: string): Promise<number | null> {
    return this.run((repos) => repos.findExistingPR(owner, repo, head))
  }

  /**
   * Create a pull request
   * Checks for existing PR before creating (per CONTEXT.md)
   *
   * @param params - PR creation parameters
   * @returns Pull request response
   */
  async createPullRequest(params: CreatePullRequestParams): Promise<PullRequestResponse> {
    return this.run((repos) => repos.createPullRequest(params))
  }

  /**
   * Update pull request properties
   * Used to mark PR as ready for review or update description
   *
   * @param prNumber - Pull request number
   * @param owner - Repository owner
   * @param repo - Repository name
   * @param updates - Fields to update
   */
  async updatePullRequest(
    prNumber: number,
    owner: string,
    repo: string,
    updates: {
      title?: string
      body?: string
      draft?: boolean
      state?: 'open' | 'closed'
    },
  ): Promise<PullRequestResponse> {
    return this.run((repos) => repos.updatePullRequest(prNumber, owner, repo, updates))
  }

  /**
   * Mark a draft PR as ready for review
   * Convenience method for common operation
   *
   * @param prNumber - Pull request number
   * @param owner - Repository owner
   * @param repo - Repository name
   */
  async markReadyForReview(prNumber: number, owner: string, repo: string): Promise<PullRequestResponse> {
    return this.updatePullRequest(prNumber, owner, repo, { draft: false })
  }
}

/**
 * Create a GitHub client with user token
 * Factory function for consistency with other lib modules
 *
 * @param token - User's GitHub personal access token
 * @returns GitHubClient instance
 */
export function createGitHubClient(token: string): GitHubClient {
  return new GitHubClient(token)
}
