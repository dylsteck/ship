/**
 * Git operations routes
 *
 * Provides API endpoints for Git workflow:
 * - POST /git/clone - Clone repository to sandbox
 * - POST /git/commit - Commit changes
 * - POST /git/push - Push to remote
 * - POST /git/pr - Create draft PR
 *
 * Pattern: Routes orchestrate SessionDO + GitWorkflow + GitHubClient
 * Security: User's GitHub token retrieved from session, passed per-operation
 */

import { Hono } from 'hono'
import type { Env } from '../env.d'
import { cloneRepo, createBranch, commitChanges, pushBranch, generateBranchName } from '../lib/git-workflow'
import { createGitHubClient, parseRepoUrl } from '../lib/github'
import { Sandbox } from '@e2b/code-interpreter'

const git = new Hono<{ Bindings: Env }>()

/**
 * POST /git/clone
 * Clone repository to sandbox and create branch
 *
 * Body: {
 *   sessionId: string
 *   repoUrl: string
 *   taskDescription?: string (for branch naming)
 * }
 *
 * Returns: {
 *   success: boolean
 *   branchName: string
 *   path: string
 * }
 */
git.post('/clone', async (c) => {
  try {
    const body = await c.req.json<{
      sessionId: string
      repoUrl: string
      taskDescription?: string
    }>()

    const { sessionId, repoUrl, taskDescription } = body

    if (!sessionId || !repoUrl) {
      return c.json({ error: 'sessionId and repoUrl are required' }, 400)
    }

    // Get SessionDO stub
    const doId = c.env.SESSION_DO.idFromName(sessionId)
    const doStub = c.env.SESSION_DO.get(doId)

    // Get sandbox ID from session
    const sandboxResponse = await doStub.fetch('http://do/sandbox/status')
    if (!sandboxResponse.ok) {
      return c.json({ error: 'No sandbox found for session' }, 404)
    }

    const sandboxStatus = (await sandboxResponse.json()) as { sandboxId: string | null; status: string | null }
    if (!sandboxStatus.sandboxId) {
      return c.json({ error: 'Session has no sandbox' }, 404)
    }

    // Get user's GitHub token from session meta
    const metaResponse = await doStub.fetch('http://do/meta')
    const meta = (await metaResponse.json()) as Record<string, string>
    const githubToken = meta['github_token']

    if (!githubToken) {
      return c.json({ error: 'GitHub token not found in session' }, 401)
    }

    // Connect to sandbox
    const sandbox = await Sandbox.connect(sandboxStatus.sandboxId, {
      apiKey: c.env.E2B_API_KEY,
      timeoutMs: 5 * 60 * 1000,
    })

    // Clone repository
    const repoPath = await cloneRepo(sandbox, repoUrl, githubToken)

    // Generate branch name
    const branchName = generateBranchName(taskDescription || 'agent-task', sessionId)

    // Create branch
    await createBranch(sandbox, branchName, repoPath)

    // Store branch name in session meta
    await doStub.fetch('http://do/meta', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ current_branch: branchName, repo_url: repoUrl }),
    })

    return c.json({
      success: true,
      branchName,
      path: repoPath,
    })
  } catch (error) {
    console.error('Error cloning repository:', error)
    const message = error instanceof Error ? error.message : 'Failed to clone repository'
    return c.json({ error: message }, 500)
  }
})

/**
 * POST /git/commit
 * Commit changes in sandbox repository
 *
 * Body: {
 *   sessionId: string
 *   message: string
 * }
 *
 * Returns: {
 *   success: boolean
 *   commitHash: string
 * }
 */
git.post('/commit', async (c) => {
  try {
    const body = await c.req.json<{
      sessionId: string
      message: string
    }>()

    const { sessionId, message } = body

    if (!sessionId || !message) {
      return c.json({ error: 'sessionId and message are required' }, 400)
    }

    // Get SessionDO stub
    const doId = c.env.SESSION_DO.idFromName(sessionId)
    const doStub = c.env.SESSION_DO.get(doId)

    // Get sandbox ID from session
    const sandboxResponse = await doStub.fetch('http://do/sandbox/status')
    if (!sandboxResponse.ok) {
      return c.json({ error: 'No sandbox found for session' }, 404)
    }

    const sandboxStatus = (await sandboxResponse.json()) as { sandboxId: string | null; status: string | null }
    if (!sandboxStatus.sandboxId) {
      return c.json({ error: 'Session has no sandbox' }, 404)
    }

    // Get user info from session meta (for git config)
    const metaResponse = await doStub.fetch('http://do/meta')
    const meta = (await metaResponse.json()) as Record<string, string>
    const userName = meta['user_name'] || 'Ship Agent'
    const userEmail = meta['user_email'] || 'agent@ship.dev'

    // Connect to sandbox
    const sandbox = await Sandbox.connect(sandboxStatus.sandboxId, {
      apiKey: c.env.E2B_API_KEY,
      timeoutMs: 5 * 60 * 1000,
    })

    // Commit changes
    const commitHash = await commitChanges(
      sandbox,
      message,
      {
        name: userName,
        email: userEmail,
      },
      '/home/user/repo',
    )

    return c.json({
      success: true,
      commitHash,
    })
  } catch (error) {
    console.error('Error committing changes:', error)
    const message = error instanceof Error ? error.message : 'Failed to commit changes'
    return c.json({ error: message }, 500)
  }
})

/**
 * POST /git/push
 * Push branch to remote
 *
 * Body: {
 *   sessionId: string
 *   branchName?: string (optional, uses current_branch from meta if not provided)
 * }
 *
 * Returns: {
 *   success: boolean
 *   pushedBranch: string
 * }
 */
git.post('/push', async (c) => {
  try {
    const body = await c.req.json<{
      sessionId: string
      branchName?: string
    }>()

    const { sessionId, branchName: providedBranchName } = body

    if (!sessionId) {
      return c.json({ error: 'sessionId is required' }, 400)
    }

    // Get SessionDO stub
    const doId = c.env.SESSION_DO.idFromName(sessionId)
    const doStub = c.env.SESSION_DO.get(doId)

    // Get sandbox ID and meta from session
    const sandboxResponse = await doStub.fetch('http://do/sandbox/status')
    if (!sandboxResponse.ok) {
      return c.json({ error: 'No sandbox found for session' }, 404)
    }

    const sandboxStatus = (await sandboxResponse.json()) as { sandboxId: string | null; status: string | null }
    if (!sandboxStatus.sandboxId) {
      return c.json({ error: 'Session has no sandbox' }, 404)
    }

    // Get GitHub token and branch name from session meta
    const metaResponse = await doStub.fetch('http://do/meta')
    const meta = (await metaResponse.json()) as Record<string, string>
    const githubToken = meta['github_token']
    const branchName = providedBranchName || meta['current_branch']

    if (!githubToken) {
      return c.json({ error: 'GitHub token not found in session' }, 401)
    }

    if (!branchName) {
      return c.json({ error: 'No branch to push (provide branchName or clone first)' }, 400)
    }

    // Connect to sandbox
    const sandbox = await Sandbox.connect(sandboxStatus.sandboxId, {
      apiKey: c.env.E2B_API_KEY,
      timeoutMs: 5 * 60 * 1000,
    })

    // Push branch
    await pushBranch(sandbox, branchName, githubToken, '/home/user/repo')

    return c.json({
      success: true,
      pushedBranch: branchName,
    })
  } catch (error) {
    console.error('Error pushing branch:', error)
    const message = error instanceof Error ? error.message : 'Failed to push branch'
    return c.json({ error: message }, 500)
  }
})

/**
 * POST /git/pr
 * Create draft pull request
 * Auto-creates on first commit per CONTEXT.md
 *
 * Body: {
 *   sessionId: string
 *   title: string
 *   body?: string
 * }
 *
 * Returns: {
 *   prNumber: number
 *   prUrl: string
 *   draft: boolean
 * }
 */
git.post('/pr', async (c) => {
  try {
    const body = await c.req.json<{
      sessionId: string
      title: string
      body?: string
    }>()

    const { sessionId, title, body: prBody } = body

    if (!sessionId || !title) {
      return c.json({ error: 'sessionId and title are required' }, 400)
    }

    // Get SessionDO stub
    const doId = c.env.SESSION_DO.idFromName(sessionId)
    const doStub = c.env.SESSION_DO.get(doId)

    // Get GitHub token and repo info from session meta
    const metaResponse = await doStub.fetch('http://do/meta')
    const meta = (await metaResponse.json()) as Record<string, string>
    const githubToken = meta['github_token']
    const repoUrl = meta['repo_url']
    const branchName = meta['current_branch']

    if (!githubToken) {
      return c.json({ error: 'GitHub token not found in session' }, 401)
    }

    if (!repoUrl || !branchName) {
      return c.json({ error: 'No repository cloned (clone first)' }, 400)
    }

    // Parse repo URL
    const { owner, repo } = parseRepoUrl(repoUrl)

    // Create GitHub client
    const client = createGitHubClient(githubToken)

    // Create pull request (draft by default per CONTEXT.md)
    const pr = await client.createPullRequest({
      owner,
      repo,
      title,
      body: prBody,
      head: branchName,
      draft: true,
    })

    // Store PR number in session meta
    await doStub.fetch('http://do/meta', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pr_number: pr.number.toString(), pr_url: pr.htmlUrl }),
    })

    return c.json({
      prNumber: pr.number,
      prUrl: pr.htmlUrl,
      draft: pr.draft,
    })
  } catch (error) {
    console.error('Error creating pull request:', error)
    const message = error instanceof Error ? error.message : 'Failed to create pull request'
    return c.json({ error: message }, 500)
  }
})

export default git
