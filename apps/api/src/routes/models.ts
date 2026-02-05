import { Hono } from 'hono'
import type { Env } from '../env.d'

const models = new Hono<{ Bindings: Env }>()

// Default model if no preference set - Kimi K2.5 Free (via OpenCode Zen)
const DEFAULT_MODEL = 'kimi-k2.5-free'

// Fallback static model list when OpenCode is unavailable
// Ordered by recommendation - default model first
const FALLBACK_MODELS = [
  {
    id: 'kimi-k2.5-free',
    name: 'Kimi K2.5 Free',
    provider: 'OpenCode Zen',
    description: 'Free high-performance model from Moonshot AI (256K context)',
    contextWindow: 256000,
    maxTokens: 128000,
    isDefault: true,
  },
  {
    id: 'big-pickle',
    name: 'Big Pickle',
    provider: 'OpenCode Zen',
    description: 'Free stealth model optimized for coding agents (200K context)',
    contextWindow: 200000,
    maxTokens: 128000,
  },
  {
    id: 'glm-4.7-free',
    name: 'GLM 4.7 Free',
    provider: 'OpenCode Zen',
    description: 'Free GLM model from Zhipu AI (128K context)',
    contextWindow: 128000,
    maxTokens: 64000,
  },
  {
    id: 'anthropic/claude-sonnet-4-20250514',
    name: 'Claude Sonnet 4',
    provider: 'Anthropic',
    description: 'Latest balanced Claude model',
  },
  {
    id: 'anthropic/claude-opus-4-20250514',
    name: 'Claude Opus 4',
    provider: 'Anthropic',
    description: 'Most capable Claude model',
  },
  {
    id: 'anthropic/claude-3-5-sonnet-20241022',
    name: 'Claude 3.5 Sonnet',
    provider: 'Anthropic',
    description: 'Fast and intelligent',
  },
  { id: 'openai/gpt-4o', name: 'GPT-4o', provider: 'OpenAI', description: 'Latest GPT-4 multimodal model' },
  { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini', provider: 'OpenAI', description: 'Fast and affordable' },
  { id: 'google/gemini-2.0-flash', name: 'Gemini 2.0 Flash', provider: 'Google', description: 'Fast multimodal model' },
  { id: 'google/gemini-1.5-pro', name: 'Gemini 1.5 Pro', provider: 'Google', description: 'Advanced reasoning' },
]

/**
 * Validate model ID against available models (with fallback)
 * Since OpenCode runs in sandbox, we just validate against fallback list
 */
function validateModelWithFallback(modelId: string): boolean {
  // Handle legacy IDs for backwards compatibility
  if (modelId === 'opencode/big-pickle') return true
  if (modelId === 'big-pickle') return true
  return FALLBACK_MODELS.some((m) => m.id === modelId)
}

/**
 * GET /models/available
 * List all available models
 * Returns static list - OpenCode runs in sandbox so we can't query it from here
 */
models.get('/available', (c) => {
  return c.json(FALLBACK_MODELS)
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
    const result = await c.env.DB.prepare('SELECT value FROM user_preferences WHERE user_id = ? AND key = ?')
      .bind(userId, 'default_model')
      .first<{ value: string }>()

    const defaultModel = result?.value || DEFAULT_MODEL

    // Validate model exists
    const isValid = validateModelWithFallback(defaultModel)
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
    const isValid = validateModelWithFallback(model)
    if (!isValid) {
      return c.json({ error: 'Invalid model ID' }, 400)
    }

    // Upsert into user_preferences
    await c.env.DB.prepare(
      `INSERT INTO user_preferences (user_id, key, value)
       VALUES (?, ?, ?)
       ON CONFLICT(user_id, key) DO UPDATE SET value = excluded.value`,
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
    const isValid = validateModelWithFallback(model)
    if (!isValid) {
      return c.json({ error: 'Invalid model ID' }, 400)
    }

    // Store in SessionDO metadata
    // Model will be used on next prompt - OpenCode picks it up from the prompt() call
    const doId = c.env.SESSION_DO.idFromName(sessionId)
    const doStub = c.env.SESSION_DO.get(doId)
    await doStub.setSessionMeta('model', model)

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
      const result = await c.env.DB.prepare('SELECT value FROM user_preferences WHERE user_id = ? AND key = ?')
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
