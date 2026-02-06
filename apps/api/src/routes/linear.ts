import { Hono } from 'hono'
import {
  LinearClient,
  createLinearClient,
  LinearError,
} from '../lib/linear'
import type { Env } from '../env.d'

const linear = new Hono<{ Bindings: Env }>()

/**
 * Helper to get Linear access token for user
 */
async function getLinearToken(env: Env, userId: string): Promise<string | null> {
  const account = await env.DB.prepare(
    'SELECT access_token FROM accounts WHERE user_id = ? AND provider = ?',
  )
    .bind(userId, 'linear')
    .first<{ access_token: string }>()

  return account?.access_token || null
}

/**
 * GET /linear/issues
 * List user's assigned Linear issues
 * Query param: userId (required)
 */
linear.get('/issues', async (c) => {
  try {
    const userId = c.req.query('userId')

    if (!userId) {
      return c.json({ error: 'userId query parameter is required' }, 400)
    }

    const accessToken = await getLinearToken(c.env, userId)
    if (!accessToken) {
      return c.json({ error: 'Linear account not connected' }, 401)
    }

    const client = createLinearClient(accessToken)
    const issues = await client.getIssues()

    return c.json({ issues })
  } catch (error) {
    console.error('Error fetching Linear issues:', error)
    if (error instanceof LinearError) {
      return c.json({ error: error.message }, error.statusCode || 500)
    }
    return c.json({ error: 'Failed to fetch Linear issues' }, 500)
  }
})

/**
 * GET /linear/issues/:id
 * Get specific Linear issue
 * Query param: userId (required)
 */
linear.get('/issues/:id', async (c) => {
  try {
    const issueId = c.req.param('id')
    const userId = c.req.query('userId')

    if (!userId) {
      return c.json({ error: 'userId query parameter is required' }, 400)
    }

    const accessToken = await getLinearToken(c.env, userId)
    if (!accessToken) {
      return c.json({ error: 'Linear account not connected' }, 401)
    }

    const client = createLinearClient(accessToken)
    const issue = await client.getIssue(issueId)

    if (!issue) {
      return c.json({ error: 'Issue not found' }, 404)
    }

    return c.json({ issue })
  } catch (error) {
    console.error('Error fetching Linear issue:', error)
    if (error instanceof LinearError) {
      return c.json({ error: error.message }, error.statusCode || 500)
    }
    return c.json({ error: 'Failed to fetch Linear issue' }, 500)
  }
})

/**
 * POST /linear/issues
 * Create new Linear issue
 * Body: { userId, title, description?, teamId, stateId? }
 */
linear.post('/issues', async (c) => {
  try {
    const body = await c.req.json()
    const { userId, title, description, teamId, stateId } = body

    if (!userId || !title || !teamId) {
      return c.json({ error: 'userId, title, and teamId are required' }, 400)
    }

    const accessToken = await getLinearToken(c.env, userId)
    if (!accessToken) {
      return c.json({ error: 'Linear account not connected' }, 401)
    }

    const client = createLinearClient(accessToken)
    const issue = await client.createIssue({ title, description, teamId, stateId })

    return c.json({ issue })
  } catch (error) {
    console.error('Error creating Linear issue:', error)
    if (error instanceof LinearError) {
      return c.json({ error: error.message }, error.statusCode || 500)
    }
    return c.json({ error: 'Failed to create Linear issue' }, 500)
  }
})

/**
 * PATCH /linear/issues/:id
 * Update Linear issue
 * Query param: userId (required)
 * Body: { title?, description?, stateId? }
 */
linear.patch('/issues/:id', async (c) => {
  try {
    const issueId = c.req.param('id')
    const userId = c.req.query('userId')
    const body = await c.req.json()

    if (!userId) {
      return c.json({ error: 'userId query parameter is required' }, 400)
    }

    const accessToken = await getLinearToken(c.env, userId)
    if (!accessToken) {
      return c.json({ error: 'Linear account not connected' }, 401)
    }

    const client = createLinearClient(accessToken)
    const issue = await client.updateIssue({
      issueId,
      title: body.title,
      description: body.description,
      stateId: body.stateId,
    })

    return c.json({ issue })
  } catch (error) {
    console.error('Error updating Linear issue:', error)
    if (error instanceof LinearError) {
      return c.json({ error: error.message }, error.statusCode || 500)
    }
    return c.json({ error: 'Failed to update Linear issue' }, 500)
  }
})

/**
 * POST /linear/link/:sessionId
 * Link Linear issue to session
 * Body: { userId, linearIssueId }
 */
linear.post('/link/:sessionId', async (c) => {
  try {
    const sessionId = c.req.param('sessionId')
    const body = await c.req.json()
    const { userId, linearIssueId } = body

    if (!userId || !linearIssueId) {
      return c.json({ error: 'userId and linearIssueId are required' }, 400)
    }

    const accessToken = await getLinearToken(c.env, userId)
    if (!accessToken) {
      return c.json({ error: 'Linear account not connected' }, 401)
    }

    // Verify issue exists and user has access
    const client = createLinearClient(accessToken)
    const issue = await client.getIssue(linearIssueId)
    if (!issue) {
      return c.json({ error: 'Linear issue not found or access denied' }, 404)
    }

    // Get SessionDO stub and link via meta endpoint
    const doId = c.env.SESSION_DO.idFromName(sessionId)
    const stub = c.env.SESSION_DO.get(doId)
    await stub.fetch('http://do/meta', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ linearIssueId }),
    })

    return c.json({ success: true, linearIssueId })
  } catch (error) {
    console.error('Error linking Linear issue:', error)
    if (error instanceof LinearError) {
      return c.json({ error: error.message }, error.statusCode || 500)
    }
    return c.json({ error: 'Failed to link Linear issue' }, 500)
  }
})

/**
 * GET /linear/link/:sessionId
 * Get linked Linear issue for session
 * Query param: userId (required)
 */
linear.get('/link/:sessionId', async (c) => {
  try {
    const sessionId = c.req.param('sessionId')
    const userId = c.req.query('userId')

    if (!userId) {
      return c.json({ error: 'userId query parameter is required' }, 400)
    }

    // Get SessionDO stub and fetch meta
    const doId = c.env.SESSION_DO.idFromName(sessionId)
    const stub = c.env.SESSION_DO.get(doId)
    const metaRes = await stub.fetch('http://do/meta')
    const meta = (await metaRes.json()) as Record<string, string>

    const linearIssueId = meta['linearIssueId'] || null

    return c.json({ linearIssueId })
  } catch (error) {
    console.error('Error fetching linked Linear issue:', error)
    return c.json({ error: 'Failed to fetch linked Linear issue' }, 500)
  }
})

/**
 * POST /linear/sync/:sessionId
 * OPTIONAL: Manual sync Linear issues to create tasks
 * Body: { userId }
 */
linear.post('/sync/:sessionId', async (c) => {
  try {
    const sessionId = c.req.param('sessionId')
    const body = await c.req.json()
    const { userId } = body

    if (!userId) {
      return c.json({ error: 'userId is required' }, 400)
    }

    const accessToken = await getLinearToken(c.env, userId)
    if (!accessToken) {
      return c.json({ error: 'Linear account not connected' }, 401)
    }

    // Get user's assigned issues
    const client = createLinearClient(accessToken)
    const issues = await client.getIssues(50) // Limit to 50 issues

    // Get SessionDO stub
    const doId = c.env.SESSION_DO.idFromName(sessionId)
    const stub = c.env.SESSION_DO.get(doId)

    // Create tasks for each issue
    let syncedCount = 0
    for (const issue of issues) {
      await stub.fetch('http://do/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `${issue.identifier}: ${issue.title}`,
          description: issue.description || undefined,
          mode: 'build',
        }),
      })
      syncedCount++
    }

    return c.json({ success: true, syncedCount })
  } catch (error) {
    console.error('Error syncing Linear issues:', error)
    if (error instanceof LinearError) {
      return c.json({ error: error.message }, error.statusCode || 500)
    }
    return c.json({ error: 'Failed to sync Linear issues' }, 500)
  }
})

export default linear
