/**
 * Git workflow utilities for E2B sandbox operations
 *
 * Provides Git operations within E2B sandboxes:
 * - Clone repository with user token authentication
 * - Create branches with timestamp-based naming
 * - Commit changes with user attribution
 * - Push to remote with authentication
 *
 * Pattern: All operations use sandbox.commands.run() for E2B integration
 * Security: User tokens passed per-operation, never persisted in sandbox
 */

import type { Sandbox } from '@e2b/code-interpreter'

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
  sandbox: Sandbox,
  owner: string,
  repo: string,
  destPath: string,
  token: string,
  options?: CloneGitHubRepoOptions,
): Promise<void> {
  const depth = options?.depth ?? 1
  const singleBranch = options?.singleBranch !== false
  const timeoutMs = options?.timeoutMs ?? 120_000
  const singleFlag = singleBranch ? '--single-branch ' : ''
  const dest = destPath
  const o = owner.trim()
  const r = repo.replace(/\.git$/i, '').trim()

  const attempts: { name: string; cmd: string }[] = [
    {
      name: 'x-access-token-in-url',
      cmd: `GIT_TERMINAL_PROMPT=0 git clone --depth ${depth} ${singleFlag}"https://x-access-token:\${GITHUB_CLONE_TOKEN}@github.com/${o}/${r}.git" "${dest}"`,
    },
    {
      name: 'oauth2-in-url',
      cmd: `GIT_TERMINAL_PROMPT=0 git clone --depth ${depth} ${singleFlag}"https://oauth2:\${GITHUB_CLONE_TOKEN}@github.com/${o}/${r}.git" "${dest}"`,
    },
    {
      name: 'token-userinfo-github',
      cmd: `GIT_TERMINAL_PROMPT=0 git clone --depth ${depth} ${singleFlag}"https://\${GITHUB_CLONE_TOKEN}@github.com/${o}/${r}.git" "${dest}"`,
    },
    {
      name: 'bearer-extraHeader',
      cmd: `GIT_TERMINAL_PROMPT=0 git -c http.extraHeader="Authorization: Bearer \${GITHUB_CLONE_TOKEN}" clone --depth ${depth} ${singleFlag}"https://github.com/${o}/${r}.git" "${dest}"`,
    },
  ]

  let lastErr: unknown
  for (const a of attempts) {
    try {
      await sandbox.commands.run(a.cmd, {
        timeoutMs,
        envs: { GITHUB_CLONE_TOKEN: token },
      })
      console.log(`[git-workflow] GitHub clone succeeded (${a.name}) ${o}/${r}`)
      return
    } catch (e) {
      lastErr = e
      console.warn(`[git-workflow] GitHub clone attempt ${a.name} failed:`, e instanceof Error ? e.message : String(e))
      await sandbox.commands.run(`rm -rf "${dest}"`).catch(() => {})
    }
  }
  throw lastErr
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
export async function cloneRepo(sandbox: Sandbox, repoUrl: string, token: string): Promise<string> {
  const repoPath = '/home/user/repo'

  try {
    const gh = parseGitHubHttpsRepo(repoUrl)
    if (gh) {
      await cloneGitHubRepoWithStrategies(sandbox, gh.owner, gh.repo, repoPath, token)
      return repoPath
    }

    const url = repoUrl.endsWith('.git') ? repoUrl : `${repoUrl}.git`
    const result = await sandbox.commands.run(
      `GIT_TERMINAL_PROMPT=0 git -c http.extraHeader="Authorization: Bearer \${GITHUB_CLONE_TOKEN}" clone ${url} ${repoPath}`,
      { envs: { GITHUB_CLONE_TOKEN: token } },
    )

    if (result.error) {
      throw new GitWorkflowError(
        `Git clone failed: ${result.error}`,
        'CLONE_FAILED',
        `git clone`,
      )
    }

    return repoPath
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    throw new GitWorkflowError(`Failed to clone repository: ${message}`, 'CLONE_FAILED')
  }
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
  sandbox: Sandbox,
  branchName: string,
  repoPath: string = '/home/user/repo',
): Promise<void> {
  try {
    // Check if branch exists
    const checkResult = await sandbox.commands.run(`cd ${repoPath} && git rev-parse --verify ${branchName} 2>/dev/null`)

    if (!checkResult.error) {
      // Branch exists, check it out
      const checkoutResult = await sandbox.commands.run(`cd ${repoPath} && git checkout ${branchName}`)
      if (checkoutResult.error) {
        throw new GitWorkflowError(
          `Failed to checkout existing branch: ${checkoutResult.error}`,
          'CHECKOUT_FAILED',
          `git checkout ${branchName}`,
        )
      }
    } else {
      // Branch doesn't exist, create it
      const createResult = await sandbox.commands.run(`cd ${repoPath} && git checkout -b ${branchName}`)
      if (createResult.error) {
        throw new GitWorkflowError(
          `Failed to create branch: ${createResult.error}`,
          'BRANCH_CREATE_FAILED',
          `git checkout -b ${branchName}`,
        )
      }
    }
  } catch (error) {
    if (error instanceof GitWorkflowError) {
      throw error
    }
    const message = error instanceof Error ? error.message : 'Unknown error'
    throw new GitWorkflowError(`Failed to create branch: ${message}`, 'BRANCH_CREATE_FAILED')
  }
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
  sandbox: Sandbox,
  user: GitUser,
  repoPath: string = '/home/user/repo',
): Promise<void> {
  try {
    // Set user.name
    const nameResult = await sandbox.commands.run(`cd ${repoPath} && git config user.name "${user.name}"`)
    if (nameResult.error) {
      throw new GitWorkflowError(
        `Failed to set git user.name: ${nameResult.error}`,
        'CONFIG_FAILED',
        'git config user.name',
      )
    }

    // Set user.email
    const emailResult = await sandbox.commands.run(`cd ${repoPath} && git config user.email "${user.email}"`)
    if (emailResult.error) {
      throw new GitWorkflowError(
        `Failed to set git user.email: ${emailResult.error}`,
        'CONFIG_FAILED',
        'git config user.email',
      )
    }
  } catch (error) {
    if (error instanceof GitWorkflowError) {
      throw error
    }
    const message = error instanceof Error ? error.message : 'Unknown error'
    throw new GitWorkflowError(`Failed to configure git user: ${message}`, 'CONFIG_FAILED')
  }
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
  sandbox: Sandbox,
  message: string,
  user: GitUser,
  repoPath: string = '/home/user/repo',
): Promise<string> {
  try {
    // Configure git user first
    await configureGitUser(sandbox, user, repoPath)

    // Check for changes
    const statusResult = await sandbox.commands.run(`cd ${repoPath} && git status --porcelain`)
    if (!statusResult.stdout || statusResult.stdout.trim() === '') {
      throw new GitWorkflowError('No changes to commit', 'NO_CHANGES')
    }

    // Add all changes
    const addResult = await sandbox.commands.run(`cd ${repoPath} && git add -A`)
    if (addResult.error) {
      throw new GitWorkflowError(
        `Failed to stage changes: ${addResult.error}`,
        'ADD_FAILED',
        'git add -A',
      )
    }

    // Commit with message + Ship co-author trailer
    // Using two -m flags: first is commit message, second is the co-author trailer paragraph
    const escapedMessage = message.replace(/"/g, '\\"')
    const commitResult = await sandbox.commands.run(
      `cd ${repoPath} && git commit -m "${escapedMessage}" -m "Co-Authored-By: Ship <shipagent@dylansteck.com>"`,
    )
    if (commitResult.error) {
      throw new GitWorkflowError(
        `Failed to commit: ${commitResult.error}`,
        'COMMIT_FAILED',
        'git commit',
      )
    }

    // Get commit hash
    const hashResult = await sandbox.commands.run(`cd ${repoPath} && git rev-parse --short HEAD`)
    if (hashResult.error || !hashResult.stdout) {
      throw new GitWorkflowError('Failed to get commit hash', 'HASH_FAILED', 'git rev-parse')
    }

    return hashResult.stdout.trim()
  } catch (error) {
    if (error instanceof GitWorkflowError) {
      throw error
    }
    const message = error instanceof Error ? error.message : 'Unknown error'
    throw new GitWorkflowError(`Failed to commit changes: ${message}`, 'COMMIT_FAILED')
  }
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
  sandbox: Sandbox,
  branchName: string,
  token: string,
  repoPath: string = '/home/user/repo',
): Promise<void> {
  try {
    // Get current remote URL
    const remoteResult = await sandbox.commands.run(`cd ${repoPath} && git remote get-url origin`)
    if (remoteResult.error || !remoteResult.stdout) {
      throw new GitWorkflowError('Failed to get remote URL', 'REMOTE_FAILED', 'git remote get-url')
    }

    const remoteUrl = remoteResult.stdout.trim()

    // Update remote URL with token for authentication
    let authUrl = remoteUrl
    if (remoteUrl.startsWith('https://github.com/')) {
      const enc = encodeURIComponent(token)
      authUrl = remoteUrl.replace('https://github.com/', `https://x-access-token:${enc}@github.com/`)
    } else if (remoteUrl.startsWith('https://') && !remoteUrl.includes('@')) {
      const enc = encodeURIComponent(token)
      authUrl = remoteUrl.replace('https://', `https://x-access-token:${enc}@`)
    }

    // Set remote URL temporarily for this push
    await sandbox.commands.run(`cd ${repoPath} && git remote set-url origin "${authUrl}"`)

    // Push branch
    const pushResult = await sandbox.commands.run(`cd ${repoPath} && git push -u origin ${branchName}`)
    if (pushResult.error) {
      throw new GitWorkflowError(
        `Failed to push branch: ${pushResult.error}`,
        'PUSH_FAILED',
        `git push origin ${branchName}`,
      )
    }

    // Reset remote URL (remove token)
    await sandbox.commands.run(`cd ${repoPath} && git remote set-url origin "${remoteUrl}"`)
  } catch (error) {
    if (error instanceof GitWorkflowError) {
      throw error
    }
    const message = error instanceof Error ? error.message : 'Unknown error'
    throw new GitWorkflowError(`Failed to push branch: ${message}`, 'PUSH_FAILED')
  }
}
