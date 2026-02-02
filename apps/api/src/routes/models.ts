import { Hono } from 'hono'
import type { Env } from '../env.d'
import { getAvailableModels, validateModel, switchModel } from '../lib/opencode'

const models = new Hono<{ Bindings: Env }>()

// Default model if no preference set
const DEFAULT_MODEL = 'anthropic/claude-sonnet-4-20250514'

/**
 * GET /models/available
 * List all available models from OpenCode providers
 */
models.get('/available', async (c) => {
  try {
    const availableModels = await getAvailableModels()
    return c.json(availableModels)
  } catch (error) {
    console.error('Error fetching available models:', error)
    return c.json({ error: 'Failed to fetch available models' }, 500)
  }
})

/**
 * GET /models/default
 * Get user's default model preference
 * Query param: userId (required)
 */
models.get('/default', async (c) => {
  try {
    const userId = c.req.query('userId')

    if (!userId) {
      return c.json({ error: 'userId query parameter is required' }, 400)
    }

    // Check user_preferences table for default model
    const result = await c.env.DB.prepare(
      'SELECT value FROM user_preferences WHERE user_id = ? AND key = ?'
    )
      .bind(userId, 'default_model')
      .first<{ value: string }>()

    const defaultModel = result?.value || DEFAULT_MODEL

    // Validate model exists
    const isValid = await validateModel(defaultModel)
    if (!isValid) {
      // Fall back to default if stored model is invalid
      return c.json({ model: DEFAULT_MODEL })
    }

    return c.json({ model: defaultModel })
  } catch (error) {
    console.error('Error fetching default model:', error)
    return c.json({ error: 'Failed to fetch default model' }, 500)
  }
})

/**
 * POST /models/default
 * Set user's default model preference
 * Body: { userId: string, model: string }
 */
models.post('/default', async (c) => {
  try {
    const { userId, model } = await c.req.json<{ userId: string; model: string }>()

    if (!userId || !model) {
      return c.json({ error: 'userId and model are required' }, 400)
    }

    // Validate model exists
    const isValid = await validateModel(model)
    if (!isValid) {
      return c.json({ error: 'Invalid model ID' }, 400)
    }

    // Upsert into user_preferences
    await c.env.DB.prepare(
      `INSERT INTO user_preferences (user_id, key, value)
       VALUES (?, ?, ?)
       ON CONFLICT(user_id, key) DO UPDATE SET value = excluded.value`
    )
      .bind(userId, 'default_model', model)
      .run()

    return c.json({ success: true, model })
  } catch (error) {
    console.error('Error setting default model:', error)
    return c.json({ error: 'Failed to set default model' }, 500)
  }
})

/**
 * POST /models/sessions/:id
 * Set model for specific session (override)
 * Body: { model: string }
 */
models.post('/sessions/:id', async (c) => {
  try {
    const sessionId = c.req.param('id')
    const { model } = await c.req.json<{ model: string }>()

    if (!model) {
      return c.json({ error: 'model is required' }, 400)
    }

    // Validate model exists
    const isValid = await validateModel(model)
    if (!isValid) {
      return c.json({ error: 'Invalid model ID' }, 400)
    }

    // Store in SessionDO metadata
    const doId = c.env.SESSION_DO.idFromName(sessionId)
    const doStub = c.env.SESSION_DO.get(doId)
    await doStub.setSessionMeta('model', model)

    // Update OpenCode session model
    try {
      await switchModel(sessionId, model)
    } catch (switchError) {
      console.error('Error switching OpenCode session model:', switchError)
      // Continue - model is stored in metadata even if OpenCode update fails
    }

    return c.json({ success: true, model })
  } catch (error) {
    console.error('Error setting session model:', error)
    return c.json({ error: 'Failed to set session model' }, 500)
  }
})

/**
 * GET /models/sessions/:id
 * Get current model for a session
 */
models.get('/sessions/:id', async (c) => {
  try {
    const sessionId = c.req.param('id')

    // Get from SessionDO metadata
    const doId = c.env.SESSION_DO.idFromName(sessionId)
    const doStub = c.env.SESSION_DO.get(doId)
    const meta = await doStub.getSessionMeta()

    const sessionModel = meta['model']

    if (sessionModel) {
      return c.json({ model: sessionModel, override: true })
    }

    // Fall back to user's default
    const userId = meta['userId']
    if (userId) {
      const result = await c.env.DB.prepare(
        'SELECT value FROM user_preferences WHERE user_id = ? AND key = ?'
      )
        .bind(userId, 'default_model')
        .first<{ value: string }>()

      const defaultModel = result?.value || DEFAULT_MODEL
      return c.json({ model: defaultModel, override: false })
    }

    // Fall back to system default
    return c.json({ model: DEFAULT_MODEL, override: false })
  } catch (error) {
    console.error('Error getting session model:', error)
    return c.json({ error: 'Failed to get session model' }, 500)
  }
})

export default models
