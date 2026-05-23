import { Hono } from 'hono'
import type { Env } from '../env.d'
import { listAgents, getDefaultAgentId } from '../lib/agent-registry'
import { ACP_MODEL_IDS, acpBackendFromModelId } from '../lib/acp-types'
import { requireJwtUserId, requireSessionOwner } from '../lib/session-authorization'

const models = new Hono<{ Bindings: Env; Variables: { userId?: string; authKind?: 'user' | 'service' } }>()

const DEFAULT_MODEL = ACP_MODEL_IDS.opencode

const STATIC_ACP_MODELS = [
  {
    id: ACP_MODEL_IDS.opencode,
    name: 'OpenCode (ACP)',
    provider: 'ACP — OpenCode',
    description: 'Sandbox `opencode acp` backend',
    isDefault: true,
  },
  {
    id: ACP_MODEL_IDS.cursor,
    name: 'Cursor Agent (ACP)',
    provider: 'ACP — Cursor',
    description: 'Sandbox `agent acp` backend',
  },
  {
    id: ACP_MODEL_IDS.claude,
    name: 'Claude Agent (ACP)',
    provider: 'ACP — Claude',
    description: 'Sandbox `claude-agent-acp` backend',
  },
  {
    id: ACP_MODEL_IDS.codex,
    name: 'Codex (ACP)',
    provider: 'ACP — Codex',
    description: 'Sandbox `codex-acp` backend',
  },
]

function validateModelWithFallback(modelId: string): boolean {
  if (STATIC_ACP_MODELS.some((m) => m.id === modelId)) return true
  const agents = listAgents()
  return agents.some((a) => a.models.some((m) => m.id === modelId))
}

/**
 * GET /models/available
 * List ACP backends as model ids for pickers.
 */
models.get('/available', async (c) => {
  const userIdOrRes = requireJwtUserId(c)
  if (typeof userIdOrRes !== 'string') {
    return userIdOrRes
  }
  return c.json(STATIC_ACP_MODELS)
})

/**
 * GET /models/default
 * Get user's default model preference
 */
models.get('/default', async (c) => {
  try {
    const userIdOrRes = requireJwtUserId(c)
    if (typeof userIdOrRes !== 'string') {
      return userIdOrRes
    }
    const userId = userIdOrRes

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
 */
models.post('/default', async (c) => {
  try {
    const userIdOrRes = requireJwtUserId(c)
    if (typeof userIdOrRes !== 'string') {
      return userIdOrRes
    }
    const userId = userIdOrRes

    const { model } = await c.req.json<{ model: string }>()

    if (!model) {
      return c.json({ error: 'model is required' }, 400)
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
    const gate = await requireSessionOwner(c, sessionId)
    if (!gate.ok) {
      return gate.response
    }

    const { model } = await c.req.json<{ model: string }>()

    if (!model) {
      return c.json({ error: 'model is required' }, 400)
    }

    // Validate model exists
    const isValid = validateModelWithFallback(model)
    if (!isValid) {
      return c.json({ error: 'Invalid model ID' }, 400)
    }

    const doId = c.env.SESSION_DO.idFromName(sessionId)
    const doStub = c.env.SESSION_DO.get(doId)
    const meta = await doStub.getSessionMeta()
    await doStub.setSessionMeta('model', model)
    await doStub.setSessionMeta('acp_backend_kind', acpBackendFromModelId(model))
    if (meta['model'] !== model || meta['acp_backend_kind'] !== acpBackendFromModelId(model)) {
      await doStub.setSessionMeta('acp_protocol_session_id', '')
      await doStub.setSessionMeta('acp_protocol_session_backend', '')
      await doStub.setSessionMeta('acp_protocol_session_cwd', '')
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
    const gate = await requireSessionOwner(c, sessionId)
    if (!gate.ok) {
      return gate.response
    }

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
 */
models.get('/default-agent', async (c) => {
  try {
    const userIdOrRes = requireJwtUserId(c)
    if (typeof userIdOrRes !== 'string') {
      return userIdOrRes
    }
    const userId = userIdOrRes

    const result = await c.env.DB.prepare('SELECT value FROM user_preferences WHERE user_id = ? AND key = ?')
      .bind(userId, 'default_agent')
      .first<{ value: string }>()

    const agents = listAgents()
    const storedAgentId = result?.value
    const agentId =
      storedAgentId && agents.some((agent) => agent.id === storedAgentId) ? storedAgentId : getDefaultAgentId()

    return c.json({ agentId })
  } catch (error) {
    console.error('Error fetching default agent:', error)
    return c.json({ error: 'Failed to fetch default agent' }, 500)
  }
})

/**
 * POST /models/default-agent
 * Set user's default agent preference
 */
models.post('/default-agent', async (c) => {
  try {
    const userIdOrRes = requireJwtUserId(c)
    if (typeof userIdOrRes !== 'string') {
      return userIdOrRes
    }
    const userId = userIdOrRes

    const { agentId } = await c.req.json<{ agentId: string }>()

    if (!agentId) {
      return c.json({ error: 'agentId is required' }, 400)
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
 * Query param: agentId (required)
 */
models.get('/default-agent-model', async (c) => {
  try {
    const userIdOrRes = requireJwtUserId(c)
    if (typeof userIdOrRes !== 'string') {
      return userIdOrRes
    }
    const userId = userIdOrRes

    const agentId = c.req.query('agentId')

    if (!agentId) {
      return c.json({ error: 'agentId query parameter is required' }, 400)
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
 */
models.post('/default-agent-model', async (c) => {
  try {
    const userIdOrRes = requireJwtUserId(c)
    if (typeof userIdOrRes !== 'string') {
      return userIdOrRes
    }
    const userId = userIdOrRes

    const { agentId, model } = await c.req.json<{ agentId: string; model: string }>()

    if (!agentId || !model) {
      return c.json({ error: 'agentId and model are required' }, 400)
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

export default models
