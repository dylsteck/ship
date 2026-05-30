/**
 * Git workflow utilities for E2B sandbox operations
 *
 * Provides Git operations within E2B sandboxes:
 * - Clone repository with user token authentication
 * - Create branches with timestamp-based naming
 * - Commit changes with user attribution
 * - Push to remote with authentication
 *
 * Pattern: All operations use the sandbox command compatibility layer.
 * Security: User tokens passed per-operation, never persisted in sandbox
 */

import { Cause, Effect, Exit } from 'effect'
import { GitWorkflow, GitWorkflowLive, type GitWorkflowService } from '../effect/git-workflow'
import { SandboxCommandsLive } from '../effect/sandbox-commands'
import { runPromiseExit } from '../effect/runtime'
import type { ComputeCommandSandbox } from './sandbox-command'

/** Parse https://github.com/owner/repo(.git) into owner + repo name */
export function parseGitHubHttpsRepo(repoUrl: string): { owner: string; repo: string } | null {
  try {
    const withGit = repoUrl.endsWith('.git') ? repoUrl : `${repoUrl}.git`
    const u = new URL(withGit)
    if (u.hostname !== 'github.com') return null
    const seg = u.pathname.replace(/^\//, '').replace(/\.git$/i, '').split('/').filter(Boolean)
    if (seg.length < 2) return null
    return { owner: seg[0]!, repo: seg[1]! }
  } catch {
    return null
  }
}

export interface CloneGitHubRepoOptions {
  timeoutMs?: number
  depth?: number
  singleBranch?: boolean
}

/**
 * Clone github.com/{owner}/{repo} using several HTTPS auth strategies.
 * GitHub OAuth / PAT auth over HTTPS is most reliable with x-access-token in the URL;
 * Bearer via http.extraHeader fails on some git versions or sandboxes.
 * Token is passed as GITHUB_CLONE_TOKEN in the environment to avoid shell quoting bugs.
 */
export async function cloneGitHubRepoWithStrategies(
  sandbox: ComputeCommandSandbox,
  owner: string,
  repo: string,
  destPath: string,
  token: string,
  options?: CloneGitHubRepoOptions,
): Promise<void> {
  return runGitWorkflow((workflow) =>
    workflow.cloneGitHubRepoWithStrategies(sandbox, owner, repo, destPath, token, options),
  )
}

/**
 * Git workflow error types
 */
export class GitWorkflowError extends Error {
  constructor(
    message: string,
    public code: string,
    public command?: string,
  ) {
    super(message)
    this.name = 'GitWorkflowError'
  }
}

async function runGitWorkflow<A>(
  use: (workflow: GitWorkflowService) => Effect.Effect<A, import('../effect/errors').GitWorkflowEffectError, import('../effect/sandbox-commands').SandboxCommands>,
): Promise<A> {
  const exit = await runPromiseExit(
    Effect.gen(function* () {
      const workflow = yield* GitWorkflow
      return yield* use(workflow)
    }).pipe(Effect.provide(GitWorkflowLive), Effect.provide(SandboxCommandsLive)),
  )

  if (Exit.isSuccess(exit)) return exit.value

  const failure = Cause.failureOption(exit.cause)
  if (failure._tag === 'Some' && failure.value._tag === 'GitWorkflowEffectError') {
    throw new GitWorkflowError(failure.value.message, failure.value.code, failure.value.command)
  }

  const defect = Cause.squash(exit.cause)
  throw new GitWorkflowError(defect instanceof Error ? defect.message : String(defect), 'UNKNOWN')
}

/**
 * Git user configuration for commits
 */
export interface GitUser {
  name: string
  email: string
}

/**
 * Generate branch name from task description and session ID
 * Format: ship-{slug}-{timestamp}-{sessionSuffix}
 *
 * Per CONTEXT.md:
 * - Prefix: "ship-"
 * - Slug: lowercase task description, alphanumeric only, max 30 chars
 * - Timestamp: ISO date with hyphens (git-safe, no colons)
 * - Session suffix: Last 8 chars of session ID for uniqueness
 *
 * @param taskDescription - User's task description
 * @param sessionId - Session ID for uniqueness
 * @returns Git-safe branch name
 */
export function generateBranchName(taskDescription: string, sessionId: string): string {
  // Create slug from task description
  const slug = taskDescription
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-') // Replace non-alphanumeric with hyphens
    .replace(/^-+|-+$/g, '') // Remove leading/trailing hyphens
    .slice(0, 30) // Max 30 chars for readability

  // Create timestamp (ISO date format with hyphens, no colons)
  const timestamp = new Date().toISOString().split('T')[0] // YYYY-MM-DD

  // Use last 8 chars of session ID for uniqueness
  const sessionSuffix = sessionId.slice(-8)

  // Combine into branch name
  const branchName = `ship-${slug}-${timestamp}-${sessionSuffix}`

  // Ensure no leading/trailing hyphens (git safety check)
  return branchName.replace(/^-+|-+$/g, '')
}

/**
 * Clone repository to sandbox with token authentication
 * Clones to /home/user/repo directory in sandbox
 *
 * @param sandbox - E2B sandbox instance
 * @param repoUrl - GitHub repository URL (HTTPS)
 * @param token - User's GitHub token for authentication
 * @returns Path to cloned repository
 */
export async function cloneRepo(sandbox: ComputeCommandSandbox, repoUrl: string, token: string): Promise<string> {
  return runGitWorkflow((workflow) => workflow.cloneRepo(sandbox, repoUrl, token))
}

/**
 * Create a new branch in the repository
 * Handles case where branch already exists gracefully
 *
 * @param sandbox - E2B sandbox instance
 * @param branchName - Name of branch to create
 * @param repoPath - Path to repository (defaults to /home/user/repo)
 */
export async function createBranch(
  sandbox: ComputeCommandSandbox,
  branchName: string,
  repoPath: string = '/home/user/repo',
): Promise<void> {
  return runGitWorkflow((workflow) => workflow.createBranch(sandbox, branchName, repoPath))
}

/**
 * Configure git user for commits
 * Sets user.name and user.email in repository config
 *
 * @param sandbox - E2B sandbox instance
 * @param user - Git user configuration
 * @param repoPath - Path to repository (defaults to /home/user/repo)
 */
export async function configureGitUser(
  sandbox: ComputeCommandSandbox,
  user: GitUser,
  repoPath: string = '/home/user/repo',
): Promise<void> {
  return runGitWorkflow((workflow) => workflow.configureGitUser(sandbox, user, repoPath))
}

/**
 * Commit changes in the repository
 * Per CONTEXT.md: Called per AI response/answer for atomic commits
 *
 * @param sandbox - E2B sandbox instance
 * @param message - Commit message
 * @param user - Git user for attribution
 * @param repoPath - Path to repository (defaults to /home/user/repo)
 * @returns Commit hash
 */
export async function commitChanges(
  sandbox: ComputeCommandSandbox,
  message: string,
  user: GitUser,
  repoPath: string = '/home/user/repo',
): Promise<string> {
  return runGitWorkflow((workflow) => workflow.commitChanges(sandbox, message, user, repoPath))
}

/**
 * Push branch to remote
 * Uses token in remote URL for authentication
 *
 * @param sandbox - E2B sandbox instance
 * @param branchName - Branch to push
 * @param token - User's GitHub token for authentication
 * @param repoPath - Path to repository (defaults to /home/user/repo)
 */
export async function pushBranch(
  sandbox: ComputeCommandSandbox,
  branchName: string,
  token: string,
  repoPath: string = '/home/user/repo',
): Promise<void> {
  return runGitWorkflow((workflow) => workflow.pushBranch(sandbox, branchName, token, repoPath))
}
