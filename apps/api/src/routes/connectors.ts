import { Hono } from 'hono'
import type { Env } from '../env.d'
import { getGitHubApiBaseUrl } from '../lib/github-base-url'
import { requireJwtUserId } from '../lib/session-authorization'

const connectors = new Hono<{ Bindings: Env; Variables: { userId?: string; authKind?: 'user' | 'service' } }>()

/**
 * Connector types
 */
type ConnectorName = 'github'

/**
 * Connector status
 */
interface ConnectorStatus {
  name: ConnectorName
  connected: boolean
  enabled: boolean
  tokenExpired?: boolean
}

/**
 * Validate a GitHub access token by hitting `/user`.
 *
 * Honors the GitHub emulator base URL when active (see
 * `lib/github-base-url.ts`).
 */
async function isGitHubTokenValid(env: Env, accessToken: string): Promise<boolean> {
  try {
    const res = await fetch(`${getGitHubApiBaseUrl(env)}/user`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'User-Agent': 'Ship',
      },
      signal: AbortSignal.timeout(5000),
    })
    return res.ok
  } catch {
    return false
  }
}

/**
 * GET /connectors
 * List all connectors with enabled status (JWT user).
 */
connectors.get('/', async (c) => {
  try {
    const userIdOrRes = requireJwtUserId(c)
    if (typeof userIdOrRes !== 'string') {
      return userIdOrRes
    }
    const userId = userIdOrRes

    const connectorNames: ConnectorName[] = ['github']
    const statuses: ConnectorStatus[] = []

    for (const name of connectorNames) {
      let connected = false
      let enabled = false

      let tokenExpired = false

      try {
        // Check if account is connected and get token
        const account = await c.env.DB.prepare(
          'SELECT id, access_token FROM accounts WHERE user_id = ? AND provider = ?',
        )
          .bind(userId, name)
          .first<{ id: string; access_token: string | null }>()

        connected = !!account

        // Validate token if connected
        if (connected && account?.access_token) {
          const valid = await isGitHubTokenValid(c.env, account.access_token)
          if (!valid) {
            tokenExpired = true
          }
        } else if (connected && !account?.access_token) {
          tokenExpired = true
        }

        // Check if connector is enabled
        const preference = await c.env.DB.prepare(
          'SELECT value FROM user_preferences WHERE user_id = ? AND key = ?',
        )
          .bind(userId, `connector.${name}.enabled`)
          .first<{ value: string }>()

        // Default to enabled if connected, disabled if not connected
        enabled = preference?.value === 'true' || (connected && preference === null)
      } catch (err) {
        console.warn(`Error checking connector ${name} for user ${userId}:`, err)
      }

      statuses.push({ name, connected, enabled, tokenExpired })
    }

    return c.json({ connectors: statuses })
  } catch (error) {
    console.error('Error listing connectors:', error)
    return c.json({ error: 'Failed to list connectors' }, 500)
  }
})

/**
 * GET /connectors/:name/status
 * Get connector connection and enabled status
 */
connectors.get('/:name/status', async (c) => {
  try {
    const name = c.req.param('name') as ConnectorName
    const userIdOrRes = requireJwtUserId(c)
    if (typeof userIdOrRes !== 'string') {
      return userIdOrRes
    }
    const userId = userIdOrRes

    if (name !== 'github') {
      return c.json({ error: 'Invalid connector name' }, 400)
    }

    // Check if account is connected
    const account = await c.env.DB.prepare(
      'SELECT id FROM accounts WHERE user_id = ? AND provider = ?',
    )
      .bind(userId, name)
      .first<{ id: string }>()

    const connected = !!account

    // Check if connector is enabled
    const preference = await c.env.DB.prepare(
      'SELECT value FROM user_preferences WHERE user_id = ? AND key = ?',
    )
      .bind(userId, `connector.${name}.enabled`)
      .first<{ value: string }>()

    // Default to enabled if connected, disabled if not connected
    const enabled = preference?.value === 'true' || (connected && preference === null)

    return c.json({ name, connected, enabled })
  } catch (error) {
    console.error('Error getting connector status:', error)
    return c.json({ error: 'Failed to get connector status' }, 500)
  }
})

/**
 * POST /connectors/:name/enable
 * Enable connector
 */
connectors.post('/:name/enable', async (c) => {
  try {
    const name = c.req.param('name') as ConnectorName
    const userIdOrRes = requireJwtUserId(c)
    if (typeof userIdOrRes !== 'string') {
      return userIdOrRes
    }
    const userId = userIdOrRes

    if (name !== 'github') {
      return c.json({ error: 'Invalid connector name' }, 400)
    }

    // Store enabled state in user_preferences
    await c.env.DB.prepare(
      `INSERT INTO user_preferences (user_id, key, value)
       VALUES (?, ?, 'true')
       ON CONFLICT(user_id, key) DO UPDATE SET value = 'true'`,
    )
      .bind(userId, `connector.${name}.enabled`)
      .run()

    return c.json({ success: true, enabled: true })
  } catch (error) {
    console.error('Error enabling connector:', error)
    return c.json({ error: 'Failed to enable connector' }, 500)
  }
})

/**
 * POST /connectors/:name/disable
 * Disable connector
 */
connectors.post('/:name/disable', async (c) => {
  try {
    const name = c.req.param('name') as ConnectorName
    const userIdOrRes = requireJwtUserId(c)
    if (typeof userIdOrRes !== 'string') {
      return userIdOrRes
    }
    const userId = userIdOrRes

    if (name !== 'github') {
      return c.json({ error: 'Invalid connector name' }, 400)
    }

    // Store disabled state in user_preferences
    await c.env.DB.prepare(
      `INSERT INTO user_preferences (user_id, key, value)
       VALUES (?, ?, 'false')
       ON CONFLICT(user_id, key) DO UPDATE SET value = 'false'`,
    )
      .bind(userId, `connector.${name}.enabled`)
      .run()

    return c.json({ success: true, enabled: false })
  } catch (error) {
    console.error('Error disabling connector:', error)
    return c.json({ error: 'Failed to disable connector' }, 500)
  }
})

export default connectors
