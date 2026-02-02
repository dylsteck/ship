import { Hono } from 'hono'
import type { Env } from '../env.d'

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

export default accounts
