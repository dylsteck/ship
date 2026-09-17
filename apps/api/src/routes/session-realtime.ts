/** Canonical turn commands, transcript paging, tool output, and session selection. */

import { Hono } from 'hono'
import {
  CreateTurnRequestSchema,
  UpdateSessionSelectionRequestSchema,
  type TurnId,
} from '@ship/contracts'

import { listAgents, isKnownAcpModel } from '../lib/agent-registry'
import { parseJsonBody } from '../lib/api-schemas'
import { publishShellSession } from '../lib/shell-summary'
import { recordRecentModel } from '../lib/model-preferences'
import { requireSessionOwner, type AuthedEnv } from '../lib/session-authorization'

const sessionRealtime = new Hono<AuthedEnv>()

/** Accept a new turn idempotently and hand execution to a Workflow. */
sessionRealtime.post('/:id/turns', async (c) => {
  const sessionId = c.req.param('id')
  const owner = await requireSessionOwner(c, sessionId)
  if (!owner.ok) return owner.response
  const command = await parseJsonBody(c, CreateTurnRequestSchema)
  if (command instanceof Response) return command
  if (command.modelId && !(await isKnownAcpModel(command.modelId))) {
    return c.json({ error: 'Invalid model ID' }, 400)
  }
  const stub = c.env.SESSION_DO.getByName(sessionId)
  await stub.setSessionMeta('session_id', sessionId)
  await stub.setSessionMeta('userId', owner.userId)
  const result = await stub.beginAcceptedTurn(sessionId, command)
  if (!result.ok) return c.json({ error: 'session_busy', activeTurnId: result.activeTurnId }, 409)

  if (result.response.status === 'accepted') {
    try {
      await c.env.SHIP_CHAT_TURN_WORKFLOW.create({
        id: result.response.turnId,
        params: { sessionId, turnId: result.response.turnId, userId: owner.userId },
      })
    } catch (error) {
      const exists = await workflowExists(c.env, result.response.turnId)
      if (!exists) {
        await stub.finalizeAcceptedTurn(
          sessionId,
          result.response.turnId,
          'failed',
          'Ship could not start the accepted turn workflow.',
        )
        await publishShellSession(c.env, sessionId, {
          state: 'failed',
          latestTurnId: result.response.turnId as TurnId,
        })
        console.error(JSON.stringify({ event: 'turn_workflow_failed', sessionId, turnId: result.response.turnId }))
        return c.json({ error: error instanceof Error ? error.message : 'Workflow creation failed' }, 503)
      }
    }
  }
  await publishShellSession(c.env, sessionId, {
    state: 'starting',
    latestTurnId: result.response.turnId as TurnId,
  })
  return c.json(result.response, 202)
})

/** Request cooperative cancellation of the active turn. */
sessionRealtime.post('/:id/turns/:turnId/stop', async (c) => {
  const sessionId = c.req.param('id')
  const owner = await requireSessionOwner(c, sessionId)
  if (!owner.ok) return owner.response
  const turnId = c.req.param('turnId')
  const stub = c.env.SESSION_DO.getByName(sessionId)
  if (!(await stub.requestAcceptedTurnStop(turnId))) return c.json({ error: 'Turn is not running' }, 409)
  await publishShellSession(c.env, sessionId, { state: 'stopping', latestTurnId: turnId as TurnId })
  return c.json({ success: true, turnId })
})

/** Return a stable page of older user-anchored turns. */
sessionRealtime.get('/:id/transcript', async (c) => {
  const sessionId = c.req.param('id')
  const owner = await requireSessionOwner(c, sessionId)
  if (!owner.ok) return owner.response
  const rawLimit = Number(c.req.query('limit') || 20)
  if (!Number.isInteger(rawLimit) || rawLimit < 1 || rawLimit > 50) return c.json({ error: 'Invalid limit' }, 400)
  const stub = c.env.SESSION_DO.getByName(sessionId)
  return c.json(await stub.getTranscriptPage(sessionId, c.req.query('before'), rawLimit))
})

/** Load full command/tool output only after explicit disclosure. */
sessionRealtime.get('/:id/tool-calls/:toolCallId/output', async (c) => {
  const sessionId = c.req.param('id')
  const owner = await requireSessionOwner(c, sessionId)
  if (!owner.ok) return owner.response
  const toolCallId = c.req.param('toolCallId')
  const output = await c.env.SESSION_DO.getByName(sessionId).getToolOutput(toolCallId)
  if (output == null) return c.json({ error: 'Tool output not found' }, 404)
  return c.json({ toolCallId, output })
})

/** Switch the agent/model used by the next turn while a session is idle. */
sessionRealtime.patch('/:id/selection', async (c) => {
  const sessionId = c.req.param('id')
  const owner = await requireSessionOwner(c, sessionId)
  if (!owner.ok) return owner.response
  const selection = await parseJsonBody(c, UpdateSessionSelectionRequestSchema)
  if (selection instanceof Response) return selection
  const agents = await listAgents()
  const agent = agents.find((candidate) => candidate.id === selection.agentId)
  if (!agent || !agent.models.some((model) => model.id === selection.modelId)) {
    return c.json({ error: 'Model does not belong to the selected agent' }, 400)
  }
  const stub = c.env.SESSION_DO.getByName(sessionId)
  const activeTurnId = await stub.getActiveTurnId()
  if (activeTurnId) return c.json({ error: 'session_busy', activeTurnId }, 409)
  const meta = await stub.getSessionMeta()
  const changed = meta['model'] !== selection.modelId || meta['agent_type'] !== selection.agentId
  await stub.setSessionMeta('model', selection.modelId)
  await stub.setSessionMeta('agent_type', selection.agentId)
  await stub.setSessionMeta('acp_backend_kind', selection.agentId)
  if (changed) {
    await Promise.all([
      stub.setSessionMeta('acp_protocol_session_id', ''),
      stub.setSessionMeta('acp_protocol_session_backend', ''),
      stub.setSessionMeta('acp_protocol_session_cwd', ''),
    ])
  }
  await c.env.DB.prepare(
    `UPDATE chat_sessions SET model = ?, agent_type = ?, revision = revision + 1 WHERE id = ?`,
  )
    .bind(selection.modelId, selection.agentId, sessionId)
    .run()
  const summary = await publishShellSession(c.env, sessionId)
  if (summary) await stub.cacheShellSummary(JSON.stringify(summary))
  await recordRecentModel(c.env, owner.userId, selection.modelId)
  return c.json({ success: true, selection, revision: summary?.revision })
})

async function workflowExists(env: AuthedEnv['Bindings'], turnId: string): Promise<boolean> {
  try {
    const instance = await env.SHIP_CHAT_TURN_WORKFLOW.get(turnId)
    const status = await instance.status()
    return status.status !== 'unknown'
  } catch {
    return false
  }
}

export default sessionRealtime
