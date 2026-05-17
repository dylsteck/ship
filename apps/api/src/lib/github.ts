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

import { Octokit } from '@octokit/rest'
import { createPullRequest } from 'octokit-plugin-create-pull-request'

// Extend Octokit with createPullRequest plugin
const OctokitWithPlugin = Octokit.plugin(createPullRequest)

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

/**
 * Parameters for creating a pull request
 */
export interface CreatePullRequestParams {
  owner: string
  repo: string
  title: string
  body?: string
  head: string // Branch name containing changes
  base?: string // Base branch (defaults to 'main')
  draft?: boolean // Create as draft PR (defaults to true per CONTEXT.md)
}

/**
 * Pull request response
 */
export interface PullRequestResponse {
  number: number
  url: string
  htmlUrl: string
  draft: boolean
  state: string
  head: string
  base: string
}

/**
 * GitHubClient class
 * Wraps Octokit with user token authentication
 *
 * Usage:
 *   const client = new GitHubClient(userToken)
 *   await client.createPullRequest({ ... })
 */
export class GitHubClient {
  private octokit: InstanceType<typeof OctokitWithPlugin>

  constructor(token: string) {
    this.octokit = new OctokitWithPlugin({
      auth: token,
    })
  }

  /**
   * Get repository information
   *
   * @param owner - Repository owner
   * @param repo - Repository name
   * @returns Repository data
   */
  async getRepository(owner: string, repo: string) {
    try {
      const { data } = await this.octokit.rest.repos.get({
        owner,
        repo,
      })
      return data
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      throw new GitHubError(`Failed to get repository: ${message}`, 'REPO_NOT_FOUND')
    }
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
    try {
      const { data: pulls } = await this.octokit.rest.pulls.list({
        owner,
        repo,
        head: `${owner}:${head}`,
        state: 'open',
      })

      return pulls.length > 0 ? pulls[0].number : null
    } catch (error) {
      // If we can't check, return null (will attempt to create)
      return null
    }
  }

  /**
   * Create a pull request
   * Checks for existing PR before creating (per CONTEXT.md)
   *
   * @param params - PR creation parameters
   * @returns Pull request response
   */
  async createPullRequest(params: CreatePullRequestParams): Promise<PullRequestResponse> {
    const { owner, repo, title, body, head, base = 'main', draft = true } = params

    try {
      // Check for existing PR on this branch
      const existingPR = await this.findExistingPR(owner, repo, head)
      if (existingPR) {
        // Return existing PR instead of creating duplicate
        const { data: pr } = await this.octokit.rest.pulls.get({
          owner,
          repo,
          pull_number: existingPR,
        })

        return {
          number: pr.number,
          url: pr.url,
          htmlUrl: pr.html_url,
          draft: pr.draft ?? false,
          state: pr.state,
          head: pr.head.ref,
          base: pr.base.ref,
        }
      }

      // Create new pull request
      const { data: pr } = await this.octokit.rest.pulls.create({
        owner,
        repo,
        title,
        body: body || '',
        head,
        base,
        draft, // Draft by default per CONTEXT.md
      })

      return {
        number: pr.number,
        url: pr.url,
        htmlUrl: pr.html_url,
        draft: pr.draft ?? false,
        state: pr.state,
        head: pr.head.ref,
        base: pr.base.ref,
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      const statusCode = (error as { status?: number }).status

      throw new GitHubError(`Failed to create pull request: ${message}`, 'PR_CREATE_FAILED', statusCode)
    }
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
    try {
      const { data: pr } = await this.octokit.rest.pulls.update({
        owner,
        repo,
        pull_number: prNumber,
        ...updates,
      })

      return {
        number: pr.number,
        url: pr.url,
        htmlUrl: pr.html_url,
        draft: pr.draft ?? false,
        state: pr.state,
        head: pr.head.ref,
        base: pr.base.ref,
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      throw new GitHubError(`Failed to update pull request: ${message}`, 'PR_UPDATE_FAILED')
    }
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
