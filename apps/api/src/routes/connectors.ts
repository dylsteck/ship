import { Hono } from 'hono'
import type { Env } from '../env.d'

const connectors = new Hono<{ Bindings: Env }>()

/**
 * Connector types
 */
type ConnectorName = 'github' | 'linear' | 'vercel'

/**
 * Connector status
 */
interface ConnectorStatus {
  name: ConnectorName
  connected: boolean
  enabled: boolean
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

    const connectors: ConnectorName[] = ['github', 'linear', 'vercel']
    const statuses: ConnectorStatus[] = []

    for (const name of connectors) {
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

      statuses.push({ name, connected, enabled })
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

    if (!['github', 'linear', 'vercel'].includes(name)) {
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

    if (!['github', 'linear', 'vercel'].includes(name)) {
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

    if (!['github', 'linear', 'vercel'].includes(name)) {
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
