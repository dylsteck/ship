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
import { streamSSE } from 'hono/streaming'
import { chatPostBodySchema, parseJsonBody } from '../lib/api-schemas'
import { appendUserMessage, toChatTurnMessages, type PersistedMessage } from '../lib/chat-history'
import { runChatTurn } from '../lib/chat-runner'
import { writeError, writeStatus } from '../lib/chat-stream-helpers'
import { prepareWorkspace } from '../lib/chat-workspace'
import { generateSessionTitle } from '../lib/generate-session-title'
import { getGitHubAccessTokenForUser } from '../lib/github-token'
import type { AuthedEnv } from '../lib/session-authorization'
import { requireSessionOwner } from '../lib/session-authorization'

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

  if (!content) return c.json({ error: 'Message content required' }, 400)
  if (content.length > MAX_PROMPT_LENGTH) {
    return c.json({ error: `Prompt too long (${content.length} chars). Maximum is ${MAX_PROMPT_LENGTH}.` }, 413)
  }

  const stub = sessionDOStub(c, sessionId)
  await persistUserMessage(stub, content)

  const initialMeta = await fetchMeta(stub)
  const userId = initialMeta['userId'] || initialMeta['user_id']

  return streamSSE(c, async (stream) => {
    try {
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
        await writeError(stream, {
          error: workspace.error.message,
          category: workspace.error.code === 'github_not_connected' ? 'user-action' : 'persistent',
          retryable: workspace.error.retryable ?? false,
        })
        return
      }

      const history = await loadHistory(stub)
      const messages = appendUserMessage(toChatTurnMessages(history.slice(0, -1)), content)

      const modelId = initialMeta['model'] || undefined

      const turn = await runChatTurn({
        sessionId,
        sandbox: workspace.workspace.sandbox,
        messages,
        ...(modelId ? { modelId } : {}),
        ...(mode === 'plan' ? { planMode: true } : {}),
        env: c.env,
        stream,
        stub,
      })

      await maybeGenerateTitle(c, sessionId, content, turn.assistantText)
    } catch (error) {
      console.error(`[chat:${sessionId}] Stream handler failed:`, error)
      await writeError(stream, {
        error: error instanceof Error ? error.message : 'Unknown agent error',
        details: error instanceof Error ? error.message : String(error),
        category: 'persistent',
        retryable: true,
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

async function persistUserMessage(stub: { fetch: typeof fetch }, content: string): Promise<void> {
  await stub.fetch(
    new Request(`${DO_URL}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'user', content }),
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
