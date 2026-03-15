import { Hono } from 'hono'
import type { Env } from '../env.d'

const connectors = new Hono<{ Bindings: Env }>()

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
 * Validate a GitHub access token by calling the GitHub API
 */
async function isGitHubTokenValid(accessToken: string): Promise<boolean> {
  try {
    const res = await fetch('https://api.github.com/user', {
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
 * List all connectors with enabled status
 * Query param: userId (required)
 */
connectors.get('/', async (c) => {
  try {
    const userId = c.req.query('userId')

    if (!userId) {
      return c.json({ error: 'userId query parameter is required' }, 400)
    }

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
          const valid = await isGitHubTokenValid(account.access_token)
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
 * Query param: userId (required)
 */
connectors.get('/:name/status', async (c) => {
  try {
    const name = c.req.param('name') as ConnectorName
    const userId = c.req.query('userId')

    if (!userId) {
      return c.json({ error: 'userId query parameter is required' }, 400)
    }

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
 * Body: { userId }
 */
connectors.post('/:name/enable', async (c) => {
  try {
    const name = c.req.param('name') as ConnectorName
    const body = await c.req.json()
    const { userId } = body

    if (!userId) {
      return c.json({ error: 'userId is required' }, 400)
    }

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
 * Body: { userId }
 */
connectors.post('/:name/disable', async (c) => {
  try {
    const name = c.req.param('name') as ConnectorName
    const body = await c.req.json()
    const { userId } = body

    if (!userId) {
      return c.json({ error: 'userId is required' }, 400)
    }

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
