/**
 * Serializable preparation, side-effecting execution, and title phases for chat-turn Workflows.
 *
 * @packageDocumentation
 */

import { connectSandbox } from '@ship/sandbox'
import type { TurnId } from '@ship/contracts'
import type { WorkflowStep } from 'cloudflare:workers'

import type { Env } from '../env.d'
import { runChatTurn } from '../lib/chat-runner'
import { toChatTurnMessages } from '../lib/chat-history'
import { prepareWorkspace } from '../lib/chat-workspace'
import { generateSessionTitle } from '../lib/generate-session-title'
import { getGitHubAccessTokenForUser } from '../lib/github-token'
import { SessionEventProducer } from '../lib/session-event-producer'
import { captureTurnGitBaseline, computeTurnDiffSummary } from '../lib/turn-git-diff'
import type { SessionDO } from '../durable-objects/session'

/** Serializable workspace state checkpointed between Workflow steps. */
export interface PreparedTurnWorkspace {
  sandboxId: string
  workingDirectory: string
}

/** Serializable execution outcome used by the idempotent finalization step. */
export interface ExecutedTurn {
  outcome: 'completed' | 'failed' | 'interrupted'
  error?: string
  diffSummary?: Array<{ filename: string; additions: number; deletions: number }>
}

/** Prepare or resume the sandbox with bounded retries before the prompt fence. */
export async function prepareTurnWorkspace(
  env: Env,
  step: WorkflowStep,
  stub: DurableObjectStub<SessionDO>,
  sessionId: string,
  turnId: string,
  userId: string,
  attemptId: string,
): Promise<PreparedTurnWorkspace> {
  return step.do<PreparedTurnWorkspace>(
    'prepare-workspace',
    { retries: { limit: 2, delay: '1 second', backoff: 'exponential' }, timeout: '4 minutes' },
    async () => {
      const turn = await stub.getAcceptedTurn(turnId)
      if (!turn) throw new Error('Accepted turn not found')
      const producer = new SessionEventProducer(stub, env.API_SECRET, turnId, attemptId)
      await producer.connect()
      try {
        const meta = await stub.getSessionMeta()
        const github = await getGitHubAccessTokenForUser(env.DB, env, userId)
        const workspace = await prepareWorkspace({
          env,
          sessionId,
          meta,
          stub,
          ...(github.token ? { githubToken: github.token } : {}),
          gitUser: await loadGitUser(env, userId),
          userPrompt: turn.content,
          stream: producer.writer(sessionId),
        })
        if (!workspace.ok) throw new Error(workspace.error.message)
        return {
          sandboxId: workspace.workspace.sandboxState.sandboxId,
          workingDirectory: workspace.workspace.workingDirectory,
        }
      } finally {
        await producer.close()
      }
    },
  )
}

/** Execute the side-effecting prompt with Workflow retries disabled. */
export async function executeTurnAgent(
  env: Env,
  step: WorkflowStep,
  stub: DurableObjectStub<SessionDO>,
  sessionId: string,
  turnId: string,
  attemptId: string,
  workspace: PreparedTurnWorkspace,
): Promise<ExecutedTurn> {
  return step.do<ExecutedTurn>(
    'execute-agent',
    { retries: { limit: 0, delay: '1 second' }, timeout: '12 minutes' },
    async () => {
      const producer = new SessionEventProducer(stub, env.API_SECRET, turnId, attemptId)
      await producer.connect()
      const heartbeat = setInterval(() => void stub.heartbeatAcceptedTurn(turnId, attemptId), 15_000)
      try {
        const turn = await stub.getAcceptedTurn(turnId)
        if (!turn) return { outcome: 'failed' as const, error: 'Accepted turn not found' }
        const sandbox = await connectSandbox(
          { type: 'e2b', sandboxId: workspace.sandboxId },
          { apiKey: env.E2B_API_KEY, workingDirectory: workspace.workingDirectory },
        )
        const baseline = await captureTurnGitBaseline(sandbox, workspace.workingDirectory)
        const history = await stub.getMessages({ limit: 40 })
        const result = await runChatTurn({
          sessionId,
          turnId,
          sandbox,
          messages: toChatTurnMessages(history),
          ...(turn.modelId ? { modelId: turn.modelId } : {}),
          ...(turn.mode === 'plan' ? { planMode: true } : {}),
          env,
          stream: producer.writer(sessionId),
          stub,
          delivery: 'producer',
          beforePrompt: async () => {
            if (!(await stub.markAcceptedTurnPromptSent(turnId, attemptId))) {
              throw new Error('Prompt execution fence was already crossed')
            }
          },
        })
        const diffSummary = await computeTurnDiffSummary(baseline, sandbox, workspace.workingDirectory).catch(() => [])
        if (diffSummary.length > 0) {
          await producer.emit({
            type: 'session.diff',
            properties: { turnId: turnId as TurnId, diff: diffSummary },
          })
        }
        return {
          outcome: result.outcome,
          ...(diffSummary.length > 0 ? { diffSummary } : {}),
        }
      } catch (error) {
        return { outcome: 'failed' as const, error: error instanceof Error ? error.message : 'Agent execution failed' }
      } finally {
        clearInterval(heartbeat)
        await producer.close()
      }
    },
  )
}

/** Generate a first-turn title idempotently from already persisted messages. */
export async function generateTurnTitle(
  env: Env,
  step: WorkflowStep,
  stub: DurableObjectStub<SessionDO>,
  sessionId: string,
): Promise<void> {
  await step.do('generate-title', { retries: { limit: 1, delay: '2 seconds' } }, async () => {
    const row = await env.DB.prepare('SELECT title FROM chat_sessions WHERE id = ?').bind(sessionId).first<{ title: string | null }>()
    if (row?.title) return { updated: false }
    if (!env.ANTHROPIC_API_KEY && !env.OPENAI_API_KEY) return { updated: false }
    const messages = await stub.getMessages({ limit: 20 })
    const userPrompt = messages.find((message) => message.role === 'user')?.content
    const assistantPreview = [...messages].reverse().find((message) => message.role === 'assistant')?.content
    if (!userPrompt || !assistantPreview) return { updated: false }
    const title = await generateSessionTitle({
      userPrompt,
      assistantPreview: assistantPreview.slice(0, 300),
      ...(env.ANTHROPIC_API_KEY ? { anthropicApiKey: env.ANTHROPIC_API_KEY } : {}),
      ...(env.OPENAI_API_KEY ? { openaiApiKey: env.OPENAI_API_KEY } : {}),
    })
    if (!title) return { updated: false }
    await env.DB.prepare('UPDATE chat_sessions SET title = ?, revision = revision + 1 WHERE id = ?')
      .bind(title, sessionId)
      .run()
    await stub.setSessionMeta('title', title)
    return { updated: true }
  })
}

async function loadGitUser(env: Env, userId: string): Promise<{ name: string; email: string }> {
  const fallback = { name: 'Ship Agent', email: 'shipagent@dylansteck.com' }
  const row = await env.DB.prepare('SELECT name, email, username FROM users WHERE id = ? LIMIT 1')
    .bind(userId)
    .first<{ name: string | null; email: string | null; username: string | null }>()
  if (!row) return fallback
  return {
    name: row.name || row.username || fallback.name,
    email: row.email || fallback.email,
  }
}
