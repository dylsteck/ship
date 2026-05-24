/**
 * `POST /chat/:sessionId` — drive one chat turn end-to-end.
 *
 * The handler stays small by delegating each concern to a focused module:
 *   - {@link prepareWorkspace} ensures a sandbox + cloned repo
 *   - {@link toChatTurnMessages} loads conversation history from the DO
 *   - {@link runChatTurn} streams ACP sandbox agent output as Ship SSE events
 *
 * Agent runs inside the E2B VM (ACP). The Worker drives JSON-RPC over a WebSocket bridge.
 *
 * @packageDocumentation
 */

import type { Context } from 'hono'
import type { TurnDiffSummary } from '@ship/contracts'
import { streamSSE } from 'hono/streaming'
import { chatPostBodySchema, parseJsonBody } from '../lib/api-schemas'
import { acpBackendFromModelId } from '../lib/acp-types'
import { isKnownAcpModel } from '../lib/agent-registry'
import { appendUserMessage, toChatTurnMessages, type PersistedMessage } from '../lib/chat-history'
import { runChatTurn } from '../lib/chat-runner'
import { writeError, writeStatus } from '../lib/chat-stream-helpers'
import { prepareWorkspace } from '../lib/chat-workspace'
import { generateSessionTitle } from '../lib/generate-session-title'
import { getGitHubAccessTokenForUser } from '../lib/github-token'
import type { AuthedEnv } from '../lib/session-authorization'
import { requireSessionOwner } from '../lib/session-authorization'
import { captureTurnGitBaseline, computeTurnDiffSummary, type GitNumstatMap } from '../lib/turn-git-diff'
import type { Sandbox } from '@ship/sandbox'

const MAX_PROMPT_LENGTH = 100_000
const DO_URL = 'https://do'

/** Hono handler for `POST /chat/:sessionId` — see file-level TSDoc. */
export async function handleChatMessageStream(c: Context<AuthedEnv>) {
  const sessionId = c.req.param('sessionId')
  if (!sessionId) return c.json({ error: 'Missing session id' }, 400)

  const gate = await requireSessionOwner(c, sessionId)
  if (!gate.ok) return gate.response

  const body = await parseJsonBody(c, chatPostBodySchema)
  if (body instanceof Response) return body
  const content = body.content.trim()
  const mode = body.mode || 'agent'
  const requestedModel = body.model?.trim()

  if (!content) return c.json({ error: 'Message content required' }, 400)
  if (requestedModel && !(await isKnownAcpModel(requestedModel))) {
    return c.json({ error: 'Invalid model ID' }, 400)
  }
  if (content.length > MAX_PROMPT_LENGTH) {
    return c.json({ error: `Prompt too long (${content.length} chars). Maximum is ${MAX_PROMPT_LENGTH}.` }, 413)
  }

  const stub = sessionDOStub(c, sessionId)
  await persistUserMessage(stub, content)

  let initialMeta = await fetchMeta(stub)
  if (requestedModel && initialMeta['model'] !== requestedModel) {
    await patchMeta(stub, {
      model: requestedModel,
      acp_backend_kind: acpBackendFromModelId(requestedModel),
      acp_protocol_session_id: '',
    })
    initialMeta = { ...initialMeta, model: requestedModel, acp_backend_kind: acpBackendFromModelId(requestedModel) }
  }
  const userId = initialMeta['userId'] || initialMeta['user_id']
  const turnId = crypto.randomUUID()

  return streamSSE(c, async (stream) => {
    let gitBaseline: GitNumstatMap | null = null
    let turnSandbox: Sandbox | null = null
    let turnWorkingDirectory: string | null = null

    try {
      await startTurn(stub, sessionId, turnId)
      await writeStatus(stream, 'initializing', 'Preparing agent...')

      const githubToken = userId ? await resolveGitHubToken(c, userId) : null
      const gitUser = await loadGitUser(c, userId)

      const workspace = await prepareWorkspace({
        env: c.env,
        sessionId,
        meta: initialMeta,
        stub,
        ...(githubToken ? { githubToken } : {}),
        gitUser,
        userPrompt: content,
        stream,
      })
      if (!workspace.ok) {
        await finishTurn(stub, turnId, 'failed')
        await broadcastSessionSummary(stub, { latestTurnId: turnId, isStreaming: false })
        await writeError(stream, {
          error: workspace.error.message,
          category: workspace.error.code === 'github_not_connected' ? 'user-action' : 'persistent',
          retryable: workspace.error.retryable ?? false,
        })
        return
      }

      turnSandbox = workspace.workspace.sandbox
      turnWorkingDirectory = workspace.workspace.workingDirectory
      gitBaseline = await captureTurnGitBaseline(turnSandbox, turnWorkingDirectory)

      const history = await loadHistory(stub)
      const messages = appendUserMessage(toChatTurnMessages(history.slice(0, -1)), content)

      const modelId = initialMeta['model'] || undefined

      const turn = await runChatTurn({
        sessionId,
        sandbox: turnSandbox,
        messages,
        ...(modelId ? { modelId } : {}),
        ...(mode === 'plan' ? { planMode: true } : {}),
        env: c.env,
        stream,
        stub,
      })

      const turnStatus = turn.outcome === 'interrupted' ? 'interrupted' : turn.outcome
      const diffSummary = await resolveTurnDiffSummary(gitBaseline, turnSandbox, turnWorkingDirectory)
      await emitSessionDiff(stream, diffSummary)
      await finishTurn(stub, turnId, turnStatus, diffSummary)
      await broadcastSessionSummary(stub, { latestTurnId: turnId, isStreaming: false })

      if (turn.outcome === 'completed') {
        await maybeGenerateTitle(c, sessionId, content, turn.assistantText)
      }
    } catch (error) {
      console.error(`[chat:${sessionId}] Stream handler failed:`, error)
      const diffSummary = await resolveTurnDiffSummary(gitBaseline, turnSandbox, turnWorkingDirectory)
      await emitSessionDiff(stream, diffSummary).catch((diffError) => {
        console.warn(`[chat:${sessionId}] Failed to emit session diff:`, diffError)
      })
      await finishTurn(stub, turnId, 'failed', diffSummary).catch((finishError) => {
        console.warn(`[chat:${sessionId}] Failed to complete turn record:`, finishError)
      })
      await broadcastSessionSummary(stub, { latestTurnId: turnId, isStreaming: false }).catch((summaryError) => {
        console.warn(`[chat:${sessionId}] Failed to broadcast session summary:`, summaryError)
      })
      await writeError(stream, {
        error: error instanceof Error ? error.message : 'Unknown agent error',
        details: error instanceof Error ? error.message : String(error),
      })
    }
  })
}

/** Get the SessionDO stub for this session id. */
function sessionDOStub(c: Context<AuthedEnv>, sessionId: string): { fetch: typeof fetch } {
  const id = c.env.SESSION_DO.idFromName(sessionId)
  return c.env.SESSION_DO.get(id) as unknown as { fetch: typeof fetch }
}

async function fetchMeta(stub: { fetch: typeof fetch }): Promise<Record<string, string>> {
  const res = await stub.fetch(new Request(`${DO_URL}/meta`))
  return (await res.json()) as Record<string, string>
}

async function patchMeta(stub: { fetch: typeof fetch }, patch: Record<string, string>): Promise<void> {
  await stub.fetch(
    new Request(`${DO_URL}/meta`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    }),
  )
}

async function persistUserMessage(stub: { fetch: typeof fetch }, content: string): Promise<void> {
  await stub.fetch(
    new Request(`${DO_URL}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'user', content }),
    }),
  )
}

async function startTurn(stub: { fetch: typeof fetch }, sessionId: string, turnId: string): Promise<void> {
  await stub.fetch(
    new Request(`${DO_URL}/turns`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ turnId, sessionId }),
    }),
  )
  await stub.fetch(
    new Request(`${DO_URL}/session-events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'turn.started', payload: { turnId, sessionId } }),
    }),
  )
  await broadcastSessionSummary(stub, { latestTurnId: turnId, isStreaming: true })
}

async function finishTurn(
  stub: { fetch: typeof fetch },
  turnId: string,
  status: 'completed' | 'failed' | 'interrupted',
  diffSummary?: TurnDiffSummary[],
): Promise<void> {
  await stub.fetch(
    new Request(`${DO_URL}/turns/${turnId}/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status,
        ...(diffSummary && diffSummary.length > 0 ? { diffSummary } : {}),
      }),
    }),
  )
  await stub.fetch(
    new Request(`${DO_URL}/session-events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: `turn.${status}`, payload: { turnId } }),
    }),
  )
}

async function resolveTurnDiffSummary(
  gitBaseline: GitNumstatMap | null,
  sandbox: Sandbox | null,
  workingDirectory: string | null,
): Promise<TurnDiffSummary[] | undefined> {
  if (!gitBaseline || !sandbox || !workingDirectory) return undefined
  try {
    const diffSummary = await computeTurnDiffSummary(gitBaseline, sandbox, workingDirectory)
    return diffSummary.length > 0 ? diffSummary : undefined
  } catch (error) {
    console.warn('[chat] Failed to compute turn git diff:', error)
    return undefined
  }
}

async function emitSessionDiff(
  stream: { writeSSE: (payload: { event: string; data: string }) => Promise<void> },
  diffSummary?: TurnDiffSummary[],
): Promise<void> {
  if (!diffSummary || diffSummary.length === 0) return
  await stream.writeSSE({
    event: 'session.diff',
    data: JSON.stringify({ type: 'session.diff', properties: { diff: diffSummary } }),
  })
}

async function broadcastSessionSummary(
  stub: { fetch: typeof fetch },
  opts: { isStreaming?: boolean; activeTool?: string; latestTurnId?: string; title?: string },
): Promise<void> {
  await stub.fetch(
    new Request(`${DO_URL}/summary/broadcast`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(opts),
    }),
  )
}

async function loadHistory(stub: { fetch: typeof fetch }): Promise<PersistedMessage[]> {
  const res = await stub.fetch(new Request(`${DO_URL}/messages?limit=40`))
  const json = (await res.json()) as { messages?: PersistedMessage[] } | PersistedMessage[]
  if (Array.isArray(json)) return json
  return json.messages ?? []
}

async function resolveGitHubToken(c: Context<AuthedEnv>, userId: string): Promise<string | null> {
  const result = await getGitHubAccessTokenForUser(c.env.DB, c.env, userId)
  return result.token ?? null
}

async function loadGitUser(
  c: Context<AuthedEnv>,
  userId: string | undefined,
): Promise<{ name: string; email: string }> {
  const fallback = { name: 'Ship Agent', email: 'shipagent@dylansteck.com' }
  if (!userId) return fallback
  try {
    const row = await c.env.DB.prepare('SELECT name, email, username FROM users WHERE id = ? LIMIT 1')
      .bind(userId)
      .first<{ name: string | null; email: string | null; username: string | null }>()
    if (!row) return fallback
    return {
      name: row.name || row.username || fallback.name,
      email: row.email || fallback.email,
    }
  } catch {
    return fallback
  }
}

async function maybeGenerateTitle(
  c: Context<AuthedEnv>,
  sessionId: string,
  userPrompt: string,
  assistantPreview: string,
): Promise<void> {
  if (!userPrompt.trim()) return
  if (!c.env.ANTHROPIC_API_KEY && !c.env.OPENAI_API_KEY) return
  try {
    const title = await generateSessionTitle({
      userPrompt,
      assistantPreview: assistantPreview?.slice(0, 300),
      ...(c.env.ANTHROPIC_API_KEY ? { anthropicApiKey: c.env.ANTHROPIC_API_KEY } : {}),
      ...(c.env.OPENAI_API_KEY ? { openaiApiKey: c.env.OPENAI_API_KEY } : {}),
    })
    if (!title) return
    await c.env.DB.prepare('UPDATE chat_sessions SET title = ?, last_activity = ? WHERE id = ?')
      .bind(title, Math.floor(Date.now() / 1000), sessionId)
      .run()
  } catch (error) {
    console.warn(`[chat:${sessionId}] Failed to generate session title:`, error)
  }
}
