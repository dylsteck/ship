import type { Message, Task } from './session-types'
import type { SessionFetchHost } from './session-fetch-host'
import type { BuildSessionSummaryOptions } from './session-summary'
import type { SessionSummary, TurnStatus } from '@ship/contracts'

function jsonError(error: unknown, fallback: string, status = 500): Response {
  return Response.json({ error: error instanceof Error ? error.message : fallback }, { status })
}

async function handleEventsPost(host: SessionFetchHost, request: Request): Promise<Response> {
  const body = (await request.json()) as {
    events: Array<{ id: string; type: string; timestamp: number; payload: unknown }>
  }
  const existing = await host.getSessionMeta()
  const current = (existing['session_events'] ? JSON.parse(existing['session_events']) : []) as typeof body.events
  const updated = [...current, ...(body.events ?? [])].slice(-500)
  await host.setSessionMeta('session_events', JSON.stringify(updated))
  return Response.json({ success: true })
}

/** Messages, tasks, meta, events, and broadcast RPC routes. */
export async function handleSessionDataRoutes(
  host: SessionFetchHost,
  url: URL,
  request: Request,
): Promise<Response | null> {
  if (url.pathname.endsWith('/messages') && request.method === 'GET') {
    const limit = url.searchParams.get('limit')
    const before = url.searchParams.get('before')
    const messages = await host.getMessages({
      limit: limit ? parseInt(limit) : undefined,
      before: before || undefined,
    })
    return Response.json(messages)
  }

  if (url.pathname.endsWith('/messages') && request.method === 'POST') {
    const body = (await request.json()) as Omit<Message, 'id' | 'createdAt'>
    const message = await host.persistMessage(body)
    return Response.json(message)
  }

  if (url.pathname.endsWith('/tasks') && request.method === 'GET') {
    const status = url.searchParams.get('status') as Task['status'] | null
    const tasks = await host.getTasks({ status: status || undefined })
    return Response.json(tasks)
  }

  if (url.pathname.endsWith('/tasks') && request.method === 'POST') {
    const body = (await request.json()) as Omit<Task, 'id' | 'createdAt' | 'status'>
    const task = await host.persistTask(body)
    return Response.json(task)
  }

  if (url.pathname.endsWith('/meta') && request.method === 'GET') {
    return Response.json(await host.getSessionMeta())
  }

  if (url.pathname.endsWith('/meta') && request.method === 'POST') {
    const body = (await request.json()) as Record<string, string>
    for (const [key, value] of Object.entries(body)) {
      await host.setSessionMeta(key, value)
    }
    return Response.json({ success: true })
  }

  if (url.pathname.endsWith('/broadcast') && request.method === 'POST') {
    host.broadcast((await request.json()) as object)
    return Response.json({ success: true })
  }

  if (url.pathname.endsWith('/events') && request.method === 'POST') {
    return handleEventsPost(host, request)
  }

  if (url.pathname.endsWith('/events') && request.method === 'GET') {
    const meta = await host.getSessionMeta()
    const events = meta['session_events'] ? JSON.parse(meta['session_events']) : []
    return Response.json(events)
  }

  if (url.pathname.endsWith('/session-events') && request.method === 'POST') {
    const body = (await request.json()) as { type: string; payload?: unknown }
    const event = await host.appendSessionEvent(body.type, JSON.stringify(body.payload ?? {}))
    return Response.json(event)
  }

  if (url.pathname.endsWith('/session-events') && request.method === 'GET') {
    const limit = url.searchParams.get('limit')
    const events = await host.getRecentSessionEvents(limit ? parseInt(limit) : undefined)
    return Response.json(events)
  }

  if (url.pathname.endsWith('/turns') && request.method === 'GET') {
    const meta = await host.getSessionMeta()
    const sessionId = meta['session_id'] || meta['sessionId'] || ''
    const limit = url.searchParams.get('limit')
    const turns = await host.getTurns(sessionId, limit ? parseInt(limit) : undefined)
    return Response.json(turns)
  }

  if (url.pathname.endsWith('/turns') && request.method === 'POST') {
    const body = (await request.json()) as { turnId: string; sessionId?: string }
    const meta = await host.getSessionMeta()
    const sessionId = body.sessionId || meta['session_id'] || meta['sessionId'] || ''
    const turn = await host.createTurn(sessionId, body.turnId)
    return Response.json(turn)
  }

  const turnCompleteMatch = url.pathname.match(/\/turns\/([^/]+)\/complete$/)
  if (turnCompleteMatch && request.method === 'POST') {
    const body = (await request.json()) as { status: TurnStatus; diffSummary?: unknown }
    const diffSummaryJson = body.diffSummary !== undefined ? JSON.stringify(body.diffSummary) : undefined
    await host.completeTurn(turnCompleteMatch[1], body.status, diffSummaryJson)
    return Response.json({ success: true })
  }

  if (url.pathname.endsWith('/summary/broadcast') && request.method === 'POST') {
    const body = (await request.json()) as BuildSessionSummaryOptions & { summary?: SessionSummary }
    const meta = await host.getSessionMeta()
    const summary = body.summary ?? host.buildSessionSummary(meta, body)
    host.broadcastSessionSummary(summary)
    return Response.json({ success: true, summary })
  }

  return null
}

/** Sandbox lifecycle RPC routes. */
export async function handleSessionSandboxRoutes(
  host: SessionFetchHost,
  url: URL,
  request: Request,
): Promise<Response | null> {
  if (url.pathname.endsWith('/sandbox/provision') && request.method === 'POST') {
    try {
      return Response.json(await host.provisionSandbox())
    } catch (error) {
      return jsonError(error, 'Failed to provision sandbox')
    }
  }

  if (url.pathname.endsWith('/sandbox/status') && request.method === 'GET') {
    return Response.json(await host.getSandboxStatus())
  }

  if (url.pathname.endsWith('/sandbox/pause') && request.method === 'POST') {
    try {
      await host.pauseSandbox()
      return Response.json({ success: true })
    } catch (error) {
      return jsonError(error, 'Failed to pause sandbox')
    }
  }

  if (url.pathname.endsWith('/sandbox/resume') && request.method === 'POST') {
    try {
      return Response.json(await host.resumeSandbox())
    } catch (error) {
      return jsonError(error, 'Failed to resume sandbox')
    }
  }

  if (url.pathname.endsWith('/sandbox/terminate') && request.method === 'POST') {
    try {
      await host.terminateSandbox()
      return Response.json({ success: true })
    } catch (error) {
      return jsonError(error, 'Failed to terminate sandbox')
    }
  }

  return null
}

/** Git and agent RPC routes. */
export async function handleSessionAgentRoutes(
  host: SessionFetchHost,
  url: URL,
  request: Request,
): Promise<Response | null> {
  if (url.pathname.endsWith('/git/state') && request.method === 'GET') {
    return Response.json({
      branchName: await host.getBranchName(),
      pr: await host.getPullRequest(),
      repoUrl: await host.getRepoUrl(),
    })
  }

  if (url.pathname.endsWith('/git/pr/ready') && request.method === 'POST') {
    try {
      await host.markReadyForReview()
      return Response.json({ success: true })
    } catch (error) {
      return jsonError(error, 'Failed to mark PR ready')
    }
  }

  if (url.pathname.endsWith('/task/start') && request.method === 'POST') {
    try {
      const body = (await request.json()) as { taskDescription: string }
      return Response.json(await host.startTask(body.taskDescription))
    } catch (error) {
      return jsonError(error, 'Failed to start task')
    }
  }

  if (url.pathname.endsWith('/agent/response') && request.method === 'POST') {
    try {
      const body = (await request.json()) as { summary: string; hasChanges: boolean }
      await host.handleAgentResponse(body)
      return Response.json({ success: true })
    } catch (error) {
      return jsonError(error, 'Failed to handle agent response')
    }
  }

  if (url.pathname.endsWith('/agent/init') && request.method === 'POST') {
    try {
      const body = (await request.json()) as { githubToken: string; gitUser: { name: string; email: string } }
      const sandboxInfo = (await host.getSandboxStatus()) as { sandboxId?: string | null }
      if (!sandboxInfo.sandboxId) {
        return Response.json({ error: 'Sandbox not provisioned' }, { status: 400 })
      }
      if (!(await host.getRepoUrl())) {
        return Response.json({ error: 'Repository URL not set' }, { status: 400 })
      }
      const { requireComputeSandbox } = await import('../lib/compute-provider')
      const apiKey = host.getE2bApiKey()
      if (!apiKey) {
        return Response.json({ error: 'E2B_API_KEY not configured' }, { status: 500 })
      }
      const sandbox = await requireComputeSandbox(apiKey, sandboxInfo.sandboxId)
      await host.initializeAgentExecutor(sandbox, body.githubToken, body.gitUser)
      return Response.json({ success: true })
    } catch (error) {
      return jsonError(error, 'Failed to initialize agent executor')
    }
  }

  return null
}
