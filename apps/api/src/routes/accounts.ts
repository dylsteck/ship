import { Hono } from 'hono'
import type { Env } from '../env.d'
import { Octokit } from '@octokit/rest'

// Account input type
interface CreateAccountInput {
  userId: string
  providerAccountId: string
  accessToken: string
  refreshToken?: string | null
  expiresAt?: number | null
  tokenType?: string
  scope?: string
}

// GitHub repo response type
interface GitHubRepo {
  id: number
  name: string
  full_name: string
  owner: {
    login: string
  }
  description: string | null
  private: boolean
  updated_at: string
  language: string | null
  stargazers_count: number
}

const accounts = new Hono<{ Bindings: Env }>()

/**
 * POST /accounts/linear
 * Create or update Linear account for user
 */
accounts.post('/linear', async (c) => {
  try {
    const input: CreateAccountInput = await c.req.json()

    // Validate required fields
    if (!input.userId || !input.providerAccountId || !input.accessToken) {
      return c.json({ error: 'userId, providerAccountId, and accessToken are required' }, 400)
    }

    const accountId = crypto.randomUUID()
    const now = Math.floor(Date.now() / 1000)

    // Check if Linear account already exists for this user
    const existing = await c.env.DB.prepare(
      'SELECT id FROM accounts WHERE user_id = ? AND provider = ?',
    )
      .bind(input.userId, 'linear')
      .first<{ id: string }>()

    if (existing) {
      // Update existing account
      await c.env.DB.prepare(
        `UPDATE accounts
         SET provider_account_id = ?, access_token = ?, refresh_token = ?, expires_at = ?, token_type = ?, scope = ?
         WHERE id = ?`,
      )
        .bind(
          input.providerAccountId,
          input.accessToken, // In production, encrypt before storing
          input.refreshToken || null,
          input.expiresAt || null,
          input.tokenType || 'Bearer',
          input.scope || 'read write',
          existing.id,
        )
        .run()

      return c.json({ success: true, accountId: existing.id })
    } else {
      // Insert new account
      await c.env.DB.prepare(
        `INSERT INTO accounts (id, user_id, provider, provider_account_id, access_token, refresh_token, expires_at, token_type, scope, created_at)
         VALUES (?, ?, 'linear', ?, ?, ?, ?, ?, ?, ?)`,
      )
        .bind(
          accountId,
          input.userId,
          input.providerAccountId,
          input.accessToken, // In production, encrypt before storing
          input.refreshToken || null,
          input.expiresAt || null,
          input.tokenType || 'Bearer',
          input.scope || 'read write',
          now,
        )
        .run()

      return c.json({ success: true, accountId })
    }
  } catch (error) {
    console.error('Error creating Linear account:', error)
    return c.json({ error: 'Failed to create Linear account' }, 500)
  }
})

/**
 * GET /accounts/linear/:userId
 * Get Linear account for user
 */
accounts.get('/linear/:userId', async (c) => {
  try {
    const userId = c.req.param('userId')

    const account = await c.env.DB.prepare(
      'SELECT id, provider_account_id, access_token, expires_at FROM accounts WHERE user_id = ? AND provider = ?',
    )
      .bind(userId, 'linear')
      .first<{
        id: string
        provider_account_id: string
        access_token: string
        expires_at: number | null
      }>()

    if (!account) {
      return c.json({ error: 'Linear account not found' }, 404)
    }

    // Return account info (don't expose full token in response)
    return c.json({
      id: account.id,
      providerAccountId: account.provider_account_id,
      hasToken: !!account.access_token,
      expiresAt: account.expires_at,
    })
  } catch (error) {
    console.error('Error fetching Linear account:', error)
    return c.json({ error: 'Failed to fetch Linear account' }, 500)
  }
})

/**
 * POST /accounts/github
 * Create or update GitHub account for user
 */
accounts.post('/github', async (c) => {
  try {
    const input: CreateAccountInput = await c.req.json()

    // Validate required fields
    if (!input.userId || !input.providerAccountId || !input.accessToken) {
      return c.json({ error: 'userId, providerAccountId, and accessToken are required' }, 400)
    }

    const accountId = crypto.randomUUID()
    const now = Math.floor(Date.now() / 1000)

    // Check if GitHub account already exists for this user
    const existing = await c.env.DB.prepare(
      'SELECT id FROM accounts WHERE user_id = ? AND provider = ?',
    )
      .bind(input.userId, 'github')
      .first<{ id: string }>()

    if (existing) {
      // Update existing account
      await c.env.DB.prepare(
        `UPDATE accounts
         SET provider_account_id = ?, access_token = ?, refresh_token = ?, expires_at = ?, token_type = ?, scope = ?
         WHERE id = ?`,
      )
        .bind(
          input.providerAccountId,
          input.accessToken,
          input.refreshToken || null,
          input.expiresAt || null,
          input.tokenType || 'Bearer',
          input.scope || 'repo,read:user,user:email',
          existing.id,
        )
        .run()

      return c.json({ success: true, accountId: existing.id })
    } else {
      // Insert new account
      await c.env.DB.prepare(
        `INSERT INTO accounts (id, user_id, provider, provider_account_id, access_token, refresh_token, expires_at, token_type, scope, created_at)
         VALUES (?, ?, 'github', ?, ?, ?, ?, ?, ?, ?)`,
      )
        .bind(
          accountId,
          input.userId,
          input.providerAccountId,
          input.accessToken,
          input.refreshToken || null,
          input.expiresAt || null,
          input.tokenType || 'Bearer',
          input.scope || 'repo,read:user,user:email',
          now,
        )
        .run()

      return c.json({ success: true, accountId })
    }
  } catch (error) {
    console.error('Error creating GitHub account:', error)
    return c.json({ error: 'Failed to create GitHub account' }, 500)
  }
})

/**
 * GET /accounts/github/repos/:userId
 * Fetch user's GitHub repositories
 */
accounts.get('/github/repos/:userId', async (c) => {
  try {
    const userId = c.req.param('userId')

    // Get GitHub account with token
    const account = await c.env.DB.prepare(
      'SELECT access_token FROM accounts WHERE user_id = ? AND provider = ?',
    )
      .bind(userId, 'github')
      .first<{ access_token: string }>()

    if (!account || !account.access_token) {
      return c.json({ error: 'GitHub account not found or no access token' }, 404)
    }

    // Fetch repos from GitHub API
    const octokit = new Octokit({ auth: account.access_token })
    
    const { data: repos } = await octokit.repos.listForAuthenticatedUser({
      sort: 'updated',
      per_page: 100,
      type: 'all',
    })

    // Map to simplified response
    const simplifiedRepos = repos.map((repo: GitHubRepo) => ({
      id: repo.id,
      name: repo.name,
      fullName: repo.full_name,
      owner: repo.owner.login,
      description: repo.description,
      private: repo.private,
      updatedAt: repo.updated_at,
      language: repo.language,
      stars: repo.stargazers_count,
    }))

    return c.json(simplifiedRepos)
  } catch (error) {
    console.error('Error fetching GitHub repos:', error)
    return c.json({ error: 'Failed to fetch GitHub repos' }, 500)
  }
})

export default accounts
