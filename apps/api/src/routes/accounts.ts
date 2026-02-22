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
 * GET /accounts/github/default-repo
 * Get user's default repository preference
 * Query param: userId (required)
 */
accounts.get('/github/default-repo', async (c) => {
  try {
    const userId = c.req.query('userId')
    if (!userId) {
      return c.json({ error: 'userId query parameter is required' }, 400)
    }

    const result = await c.env.DB.prepare(
      'SELECT value FROM user_preferences WHERE user_id = ? AND key = ?',
    )
      .bind(userId, 'default_repo')
      .first<{ value: string }>()

    return c.json({ repoFullName: result?.value ?? null })
  } catch (error) {
    console.error('Error fetching default repo:', error)
    return c.json({ error: 'Failed to fetch default repo' }, 500)
  }
})

/**
 * POST /accounts/github/default-repo
 * Set user's default repository preference
 * Body: { userId: string, repoFullName: string }
 */
accounts.post('/github/default-repo', async (c) => {
  try {
    const { userId, repoFullName } = await c.req.json<{ userId: string; repoFullName: string }>()

    if (!userId || !repoFullName) {
      return c.json({ error: 'userId and repoFullName are required' }, 400)
    }

    await c.env.DB.prepare(
      `INSERT INTO user_preferences (user_id, key, value)
       VALUES (?, ?, ?)
       ON CONFLICT(user_id, key) DO UPDATE SET value = excluded.value`,
    )
      .bind(userId, 'default_repo', repoFullName)
      .run()

    return c.json({ success: true, repoFullName })
  } catch (error) {
    console.error('Error setting default repo:', error)
    return c.json({ error: 'Failed to set default repo' }, 500)
  }
})

const REPOS_CACHE_MAX_AGE = 300 // 5 minutes
const REPOS_PER_PAGE = 50

/**
 * GET /accounts/github/repos/:userId
 * Fetch user's GitHub repositories (paginated, cached)
 * Query params: page (default 1), per_page (default 50, max 100)
 */
accounts.get('/github/repos/:userId', async (c) => {
  try {
    const userId = c.req.param('userId')
    const page = Math.max(1, parseInt(c.req.query('page') || '1', 10))
    const perPage = Math.min(100, Math.max(10, parseInt(c.req.query('per_page') || String(REPOS_PER_PAGE), 10)))

    // Check cache (Cache API - data center local, 5 min TTL via Cache-Control)
    const cache = caches.default
    const cached = await cache.match(c.req.raw)
    if (cached) {
      return cached
    }

    // Get GitHub account with token
    const account = await c.env.DB.prepare(
      'SELECT access_token FROM accounts WHERE user_id = ? AND provider = ?',
    )
      .bind(userId, 'github')
      .first<{ access_token: string }>()

    if (!account || !account.access_token) {
      return c.json({ error: 'GitHub account not found or no access token' }, 404)
    }

    // Fetch repos from GitHub API (paginated)
    const octokit = new Octokit({ auth: account.access_token })
    const { data: repos } = await octokit.repos.listForAuthenticatedUser({
      sort: 'updated',
      per_page: perPage,
      page,
      type: 'all',
    })

    // Map to simplified response
    const simplifiedRepos = repos.map((repo) => ({
      id: repo.id,
      name: repo.name,
      fullName: repo.full_name,
      owner: repo.owner.login,
      description: repo.description,
      private: repo.private,
      updatedAt: repo.updated_at ?? '',
      language: repo.language,
      stars: repo.stargazers_count,
    }))

    const hasMore = repos.length === perPage
    const nextPage = hasMore ? page + 1 : null

    const body = { repos: simplifiedRepos, hasMore, nextPage }
    const response = c.json(body, 200, {
      'Cache-Control': `public, max-age=${REPOS_CACHE_MAX_AGE}, s-maxage=${REPOS_CACHE_MAX_AGE}`,
    })

    await cache.put(c.req.raw, response.clone())
    return response
  } catch (error) {
    console.error('Error fetching GitHub repos:', error)
    return c.json({ error: 'Failed to fetch GitHub repos' }, 500)
  }
})

export default accounts
