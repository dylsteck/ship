import { Hono } from 'hono'
import type { Env } from '../env.d'
import { listAgents, getDefaultAgentId } from '../lib/agent-registry'

const models = new Hono<{ Bindings: Env }>()

// Default model if no preference set - Big Pickle (via OpenCode Zen)
// Format: opencode/<model-id> per OpenCode docs
const DEFAULT_MODEL = 'opencode/big-pickle'

// Fallback static model list when OpenCode is unavailable
// Ordered by recommendation - default model first
// OpenCode Zen models use format "opencode/<model-id>" per OpenCode docs
const FALLBACK_MODELS = [
  {
    id: 'opencode/big-pickle',
    name: 'Big Pickle',
    provider: 'OpenCode Zen',
    description: 'Free stealth model optimized for coding agents (200K context)',
    contextWindow: 200000,
    maxTokens: 128000,
    isDefault: true,
  },
  {
    id: 'opencode/glm-4.7-free',
    name: 'GLM 4.7 Free',
    provider: 'OpenCode Zen',
    description: 'Free GLM model from Zhipu AI (128K context)',
    contextWindow: 128000,
    maxTokens: 64000,
  },
  {
    id: 'opencode/claude-opus-4-6',
    name: 'Claude Opus 4.6',
    provider: 'OpenCode Zen',
    description: 'Most capable Claude model — Opus 4.6 via OpenCode (200K context)',
    contextWindow: 200000,
    maxTokens: 32000,
  },
  {
    id: 'opencode/claude-opus-4-5',
    name: 'Claude Opus 4.5',
    provider: 'OpenCode Zen',
    description: 'Previous-gen Opus model via OpenCode (200K context)',
    contextWindow: 200000,
    maxTokens: 32000,
  },
  {
    id: 'opencode/claude-sonnet-4-5',
    name: 'Claude Sonnet 4.5',
    provider: 'OpenCode Zen',
    description: 'Fast and capable Claude Sonnet 4.5 via OpenCode (200K context)',
    contextWindow: 200000,
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
]

// Bankr LLM Gateway models — available when user has Bankr enabled
// These route through https://llm.bankr.bot via OpenCode's bankr provider config
const BANKR_MODELS = [
  { id: 'bankr/claude-opus-4.6', name: 'Claude Opus 4.6', provider: 'Bankr', description: 'Most capable Claude model via Bankr', contextWindow: 200000, maxTokens: 32000 },
  { id: 'bankr/claude-sonnet-4.6', name: 'Claude Sonnet 4.6', provider: 'Bankr', description: 'Fast and capable Claude via Bankr', contextWindow: 200000, maxTokens: 64000 },
  { id: 'bankr/claude-haiku-4.5', name: 'Claude Haiku 4.5', provider: 'Bankr', description: 'Fastest Claude model via Bankr', contextWindow: 200000, maxTokens: 64000 },
  { id: 'bankr/gpt-5.2', name: 'GPT-5.2', provider: 'Bankr', description: 'Latest GPT model via Bankr', contextWindow: 1000000, maxTokens: 128000 },
  { id: 'bankr/gpt-5.2-codex', name: 'GPT-5.2 Codex', provider: 'Bankr', description: 'GPT-5.2 optimized for code via Bankr', contextWindow: 1000000, maxTokens: 128000 },
  { id: 'bankr/gpt-5-mini', name: 'GPT-5 Mini', provider: 'Bankr', description: 'Compact GPT-5 via Bankr', contextWindow: 1000000, maxTokens: 65536 },
  { id: 'bankr/gpt-5-nano', name: 'GPT-5 Nano', provider: 'Bankr', description: 'Smallest GPT-5 via Bankr', contextWindow: 1000000, maxTokens: 65536 },
  { id: 'bankr/kimi-k2.5', name: 'Kimi K2.5', provider: 'Bankr', description: 'High-performance model from Moonshot AI via Bankr', contextWindow: 256000, maxTokens: 128000 },
  { id: 'bankr/qwen3-coder', name: 'Qwen3 Coder', provider: 'Bankr', description: 'Code-focused model from Alibaba via Bankr', contextWindow: 256000, maxTokens: 65536 },
]

/**
 * Validate model ID against available models (with fallback)
 * Since OpenCode runs in sandbox, we just validate against fallback list
 */
function validateModelWithFallback(modelId: string): boolean {
  // Handle legacy IDs for backwards compatibility (without opencode/ prefix)
  const legacyIds = ['kimi-k2.5-free', 'big-pickle', 'glm-4.7-free']
  if (legacyIds.includes(modelId)) return true

  // Check if it's the new format with opencode/ prefix
  if (FALLBACK_MODELS.some((m) => m.id === modelId)) return true

  // Check Bankr models
  if (BANKR_MODELS.some((m) => m.id === modelId)) return true

  // Check agent-specific models (e.g. codex/default)
  const agents = listAgents()
  return agents.some((a) => a.models.some((m) => m.id === modelId))
}

/**
 * Check if user has Bankr enabled
 */
async function isUserBankrEnabled(db: D1Database, userId: string): Promise<boolean> {
  try {
    const result = await db.prepare('SELECT value FROM user_preferences WHERE user_id = ? AND key = ?')
      .bind(userId, 'use_bankr')
      .first<{ value: string }>()
    return result?.value === 'true'
  } catch {
    return false
  }
}

/**
 * GET /models/available
 * List all available models
 * Returns static list - OpenCode runs in sandbox so we can't query it from here
 * When Bankr is enabled (checked via userId query param), includes Bankr models
 */
models.get('/available', async (c) => {
  const userId = c.req.query('userId')

  if (userId) {
    const bankrEnabled = await isUserBankrEnabled(c.env.DB, userId)
    if (bankrEnabled) {
      // Bankr on: OpenCode Zen free models + Bankr models
      const zenModels = FALLBACK_MODELS.filter((m) => m.provider === 'OpenCode Zen')
      return c.json([...zenModels, ...BANKR_MODELS])
    }
  }

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

/**
 * GET /models/agents
 * List all available agents with their models and modes
 */
models.get('/agents', (c) => {
  const agents = listAgents()
  return c.json(agents)
})

/**
 * GET /models/default-agent
 * Get user's default agent preference
 * Query param: userId (required)
 */
models.get('/default-agent', async (c) => {
  try {
    const userId = c.req.query('userId')

    if (!userId) {
      return c.json({ error: 'userId query parameter is required' }, 400)
    }

    const result = await c.env.DB.prepare('SELECT value FROM user_preferences WHERE user_id = ? AND key = ?')
      .bind(userId, 'default_agent')
      .first<{ value: string }>()

    const agentId = result?.value || getDefaultAgentId()

    return c.json({ agentId })
  } catch (error) {
    console.error('Error fetching default agent:', error)
    return c.json({ error: 'Failed to fetch default agent' }, 500)
  }
})

/**
 * POST /models/default-agent
 * Set user's default agent preference
 * Body: { userId: string, agentId: string }
 */
models.post('/default-agent', async (c) => {
  try {
    const { userId, agentId } = await c.req.json<{ userId: string; agentId: string }>()

    if (!userId || !agentId) {
      return c.json({ error: 'userId and agentId are required' }, 400)
    }

    // Validate agent exists
    const agents = listAgents()
    if (!agents.some((a) => a.id === agentId)) {
      return c.json({ error: 'Invalid agent ID' }, 400)
    }

    await c.env.DB.prepare(
      `INSERT INTO user_preferences (user_id, key, value)
       VALUES (?, ?, ?)
       ON CONFLICT(user_id, key) DO UPDATE SET value = excluded.value`,
    )
      .bind(userId, 'default_agent', agentId)
      .run()

    return c.json({ success: true, agentId })
  } catch (error) {
    console.error('Error setting default agent:', error)
    return c.json({ error: 'Failed to set default agent' }, 500)
  }
})

/**
 * GET /models/default-agent-model
 * Get user's default model for a specific agent
 * Query params: userId (required), agentId (required)
 */
models.get('/default-agent-model', async (c) => {
  try {
    const userId = c.req.query('userId')
    const agentId = c.req.query('agentId')

    if (!userId || !agentId) {
      return c.json({ error: 'userId and agentId query parameters are required' }, 400)
    }

    const result = await c.env.DB.prepare('SELECT value FROM user_preferences WHERE user_id = ? AND key = ?')
      .bind(userId, `default_model:${agentId}`)
      .first<{ value: string }>()

    if (!result?.value) {
      return c.json({ model: null })
    }

    return c.json({ model: result.value })
  } catch (error) {
    console.error('Error fetching default agent model:', error)
    return c.json({ error: 'Failed to fetch default agent model' }, 500)
  }
})

/**
 * POST /models/default-agent-model
 * Set user's default model for a specific agent
 * Body: { userId: string, agentId: string, model: string }
 */
models.post('/default-agent-model', async (c) => {
  try {
    const { userId, agentId, model } = await c.req.json<{ userId: string; agentId: string; model: string }>()

    if (!userId || !agentId || !model) {
      return c.json({ error: 'userId, agentId, and model are required' }, 400)
    }

    // Validate agent exists
    const agents = listAgents()
    if (!agents.some((a) => a.id === agentId)) {
      return c.json({ error: 'Invalid agent ID' }, 400)
    }

    // Validate model exists
    const isValid = validateModelWithFallback(model)
    if (!isValid) {
      return c.json({ error: 'Invalid model ID' }, 400)
    }

    await c.env.DB.prepare(
      `INSERT INTO user_preferences (user_id, key, value)
       VALUES (?, ?, ?)
       ON CONFLICT(user_id, key) DO UPDATE SET value = excluded.value`,
    )
      .bind(userId, `default_model:${agentId}`, model)
      .run()

    return c.json({ success: true, model })
  } catch (error) {
    console.error('Error setting default agent model:', error)
    return c.json({ error: 'Failed to set default agent model' }, 500)
  }
})

/**
 * GET /models/bankr
 * Get user's Bankr preference
 * Query param: userId (required)
 */
models.get('/bankr', async (c) => {
  try {
    const userId = c.req.query('userId')
    if (!userId) {
      return c.json({ error: 'userId query parameter is required' }, 400)
    }

    const enabled = await isUserBankrEnabled(c.env.DB, userId)
    return c.json({ enabled })
  } catch (error) {
    console.error('Error fetching Bankr preference:', error)
    return c.json({ error: 'Failed to fetch Bankr preference' }, 500)
  }
})

/**
 * POST /models/bankr
 * Set user's Bankr preference
 * Body: { userId: string, enabled: boolean }
 */
models.post('/bankr', async (c) => {
  try {
    const { userId, enabled } = await c.req.json<{ userId: string; enabled: boolean }>()

    if (!userId || typeof enabled !== 'boolean') {
      return c.json({ error: 'userId and enabled (boolean) are required' }, 400)
    }

    await c.env.DB.prepare(
      `INSERT INTO user_preferences (user_id, key, value)
       VALUES (?, ?, ?)
       ON CONFLICT(user_id, key) DO UPDATE SET value = excluded.value`,
    )
      .bind(userId, 'use_bankr', String(enabled))
      .run()

    return c.json({ success: true, enabled })
  } catch (error) {
    console.error('Error setting Bankr preference:', error)
    return c.json({ error: 'Failed to set Bankr preference' }, 500)
  }
})

export default models
