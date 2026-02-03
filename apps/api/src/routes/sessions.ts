import { Hono } from 'hono'
import type { Env } from '../env.d'

// Session DTO type
interface SessionDTO {
  id: string
  userId: string
  repoOwner: string
  repoName: string
  status: string
  lastActivity: number
  createdAt: number
  archivedAt: number | null
}

// Database row type
interface SessionRow {
  id: string
  user_id: string
  repo_owner: string
  repo_name: string
  status: string
  last_activity: number
  created_at: number
  archived_at: number | null
}

// Create session input
interface CreateSessionInput {
  userId: string
  repoOwner: string
  repoName: string
  model?: string
}

const sessions = new Hono<{ Bindings: Env }>()

/**
 * GET /sessions
 * List user's sessions
 * Query param: userId (required - auth validation in Phase 3)
 */
sessions.get('/', async (c) => {
  try {
    const userId = c.req.query('userId')

    if (!userId) {
      return c.json({ error: 'userId query parameter is required' }, 400)
    }

    const cursor = await c.env.DB.prepare(
      `SELECT id, user_id, repo_owner, repo_name, status, last_activity, created_at, archived_at
       FROM chat_sessions
       WHERE user_id = ? AND status != 'deleted'
       ORDER BY last_activity DESC`
    )
      .bind(userId)
      .all<SessionRow>()

    // Map to DTO (camelCase)
    const sessionDTOs: SessionDTO[] = cursor.results.map((row) => ({
      id: row.id,
      userId: row.user_id,
      repoOwner: row.repo_owner,
      repoName: row.repo_name,
      status: row.status,
      lastActivity: row.last_activity,
      createdAt: row.created_at,
      archivedAt: row.archived_at,
    }))

    return c.json(sessionDTOs)
  } catch (error) {
    console.error('Error listing sessions:', error)
    return c.json({ error: 'Failed to list sessions' }, 500)
  }
})

/**
 * POST /sessions
 * Create new session with automatic sandbox provisioning
 * Body: { userId, repoOwner, repoName }
 */
sessions.post('/', async (c) => {
  try {
    const input: CreateSessionInput = await c.req.json()

    // Validate required fields
    if (!input.userId || !input.repoOwner || !input.repoName) {
      return c.json({ error: 'userId, repoOwner, and repoName are required' }, 400)
    }

    // Generate session ID
    const sessionId = crypto.randomUUID()
    const now = Math.floor(Date.now() / 1000)

    // Create DO instance and initialize metadata
    const doId = c.env.SESSION_DO.idFromName(sessionId)
    const doStub = c.env.SESSION_DO.get(doId)

    // Initialize session metadata in DO
    await doStub.setSessionMeta('userId', input.userId)
    await doStub.setSessionMeta('repoOwner', input.repoOwner)
    await doStub.setSessionMeta('repoName', input.repoName)
    await doStub.setSessionMeta('createdAt', now.toString())

    // Store model override if provided
    if (input.model) {
      await doStub.setSessionMeta('model', input.model)
    }

    // Set initial sandbox status to provisioning
    await doStub.setSessionMeta('sandbox_status', 'provisioning')

    // Store session record in D1 FIRST (don't block on sandbox)
    await c.env.DB.prepare(
      `INSERT INTO chat_sessions (id, user_id, repo_owner, repo_name, status, last_activity, created_at)
       VALUES (?, ?, ?, ?, 'active', ?, ?)`
    )
      .bind(sessionId, input.userId, input.repoOwner, input.repoName, now, now)
      .run()

    // Start sandbox provisioning in background (don't block session creation)
    c.executionCtx.waitUntil(
      doStub.fetch(`http://do/sandbox/provision`, {
        method: 'POST',
      }).catch((err) => {
        console.error('Background sandbox provisioning failed:', err)
      })
    )

    // Return session object immediately with provisioning status
    const session: SessionDTO & { sandboxId?: string | null; sandboxStatus?: string } = {
      id: sessionId,
      userId: input.userId,
      repoOwner: input.repoOwner,
      repoName: input.repoName,
      status: 'active',
      lastActivity: now,
      createdAt: now,
      archivedAt: null,
      sandboxId: null,
      sandboxStatus: 'provisioning',
    }

    return c.json(session, 201)
  } catch (error) {
    console.error('Error creating session:', error)
    return c.json({ error: 'Failed to create session' }, 500)
  }
})

/**
 * GET /sessions/:id
 * Get single session by ID
 */
sessions.get('/:id', async (c) => {
  try {
    const id = c.req.param('id')

    const row = await c.env.DB.prepare(
      `SELECT id, user_id, repo_owner, repo_name, status, last_activity, created_at, archived_at
       FROM chat_sessions
       WHERE id = ?`
    )
      .bind(id)
      .first<SessionRow>()

    if (!row) {
      return c.json({ error: 'Session not found' }, 404)
    }

    // Get message count from DO
    const doId = c.env.SESSION_DO.idFromName(id)
    const doStub = c.env.SESSION_DO.get(doId)
    const messages = await doStub.getRecentMessages(1000)
    const messageCount = messages.length

    // Map to DTO with message count
    const session: SessionDTO & { messageCount: number } = {
      id: row.id,
      userId: row.user_id,
      repoOwner: row.repo_owner,
      repoName: row.repo_name,
      status: row.status,
      lastActivity: row.last_activity,
      createdAt: row.created_at,
      archivedAt: row.archived_at,
      messageCount,
    }

    return c.json(session)
  } catch (error) {
    console.error('Error fetching session:', error)
    return c.json({ error: 'Failed to fetch session' }, 500)
  }
})

/**
 * DELETE /sessions/:id
 * Delete session (soft delete in D1, cleanup DO)
 */
sessions.delete('/:id', async (c) => {
  try {
    const id = c.req.param('id')

    // Check session exists
    const existing = await c.env.DB.prepare(
      'SELECT id FROM chat_sessions WHERE id = ?'
    )
      .bind(id)
      .first<{ id: string }>()

    if (!existing) {
      return c.json({ error: 'Session not found' }, 404)
    }

    // Best-effort sandbox termination
    try {
      const doId = c.env.SESSION_DO.idFromName(id)
      const doStub = c.env.SESSION_DO.get(doId)
      await doStub.fetch('http://do/sandbox/terminate', { method: 'POST' })
    } catch (error) {
      console.warn('Failed to terminate sandbox for session:', id, error)
    }

    // Soft delete in D1 (mark as deleted)
    const now = Math.floor(Date.now() / 1000)
    await c.env.DB.prepare(
      `UPDATE chat_sessions SET status = 'deleted', archived_at = ? WHERE id = ?`
    )
      .bind(now, id)
      .run()

    // Note: DO will be cleaned up automatically by Cloudflare when not accessed
    // The DO's SQLite data persists until the DO is garbage collected

    return c.json({ success: true })
  } catch (error) {
    console.error('Error deleting session:', error)
    return c.json({ error: 'Failed to delete session' }, 500)
  }
})

/**
 * GET /sessions/:id/sandbox
 * Get sandbox info for a session
 */
sessions.get('/:id/sandbox', async (c) => {
  try {
    const sessionId = c.req.param('id')

    // Get DO stub
    const doId = c.env.SESSION_DO.idFromName(sessionId)
    const doStub = c.env.SESSION_DO.get(doId)

    // Get sandbox status via DO RPC
    const response = await doStub.fetch(`http://do/sandbox/status`, {
      method: 'GET',
    })

    if (!response.ok) {
      return c.json({ error: 'Failed to get sandbox status' }, 500)
    }

    const status = await response.json()
    return c.json(status)
  } catch (error) {
    console.error('Error fetching session sandbox:', error)
    return c.json({ error: 'Failed to fetch session sandbox' }, 500)
  }
})

/**
 * GET /sessions/:id/websocket
 * WebSocket upgrade endpoint - forwards to SessionDO
 */
sessions.get('/:id/websocket', async (c) => {
  const sessionId = c.req.param('id')

  // Get DO stub and forward the WebSocket upgrade request
  const id = c.env.SESSION_DO.idFromName(sessionId)
  const stub = c.env.SESSION_DO.get(id)

  // Forward the WebSocket upgrade request to DO
  return stub.fetch(c.req.raw)
})

/**
 * ALL /sessions/:id/do/*
 * Forward requests to DO for future RPC methods
 */
sessions.all('/:id/do/*', async (c) => {
  const sessionId = c.req.param('id')
  const id = c.env.SESSION_DO.idFromName(sessionId)
  const stub = c.env.SESSION_DO.get(id)
  return stub.fetch(c.req.raw)
})

export default sessions
