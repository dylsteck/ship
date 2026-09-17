/**
 * SessionDO - Durable Object for session state management
 *
 * Each session gets its own DO instance identified by session ID.
 * Persists messages, tasks, and session metadata in SQLite.
 */

import { DurableObject } from 'cloudflare:workers'
import type { Env } from '../env.d'
import type {
  CreateTurnRequest,
  SessionProducerAck,
  SessionProducerBatch,
  SessionSubscribeCommand,
  TranscriptPage,
  TurnAcceptedResponse,
} from '@ship/contracts'
import { SandboxManager, type SandboxInfo } from '../lib/e2b'
import type { AgentExecutor } from '../lib/agent-executor'
import type { ComputeCommandSandbox } from '../lib/sandbox-command'
import { handleSessionFetch } from './session-fetch-handlers'
import { firstSqlRow } from './sql-first'
import {
  initializeAgentExecutor as initializeAgentExecutorBinding,
} from './session-agent-bindings'
import {
  getBranchName as getBranchNameStore,
  getPullRequest as getPullRequestStore,
  getRepoUrl as getRepoUrlStore,
  markFirstCommit as markFirstCommitStore,
  markReadyForReview as markReadyForReviewStore,
  setBranchName as setBranchNameStore,
  setPullRequest as setPullRequestStore,
  setRepoUrl as setRepoUrlStore,
} from './session-git-meta-store'
import {
  getMessageCount as getMessageCountStore,
  getMessages as getMessagesStore,
  getRecentMessages as getRecentMessagesStore,
  persistMessage as persistMessageStore,
  updateMessageParts as updateMessagePartsStore,
} from './session-message-store'
import {
  getNextPendingTask as getNextPendingTaskStore,
  getTasks as getTasksStore,
  persistTask as persistTaskStore,
  updateTaskStatus as updateTaskStatusStore,
} from './session-task-store'
import {
  getSandboxId as getSandboxIdStore,
  getSandboxStatus as getSandboxStatusStore,
  pauseSandbox as pauseSandboxStore,
  provisionSandbox as provisionSandboxStore,
  resumeSandbox as resumeSandboxStore,
  terminateSandbox as terminateSandboxStore,
} from './session-sandbox-store'
import {
  broadcastToWebSockets,
  handleWebSocketClose,
  handleWebSocketError,
  handleWebSocketMessage,
  handleWebSocketUpgrade,
} from './session-websocket'
import {
  appendSessionEvent as appendSessionEventStore,
  completeTurn as completeTurnStore,
  createTurn as createTurnStore,
  getRecentEvents as getRecentEventsStore,
  getTurns as getTurnsStore,
  type SessionEventRow,
  type TurnRow,
} from './session-turn-store'
import {
  broadcastSessionSummary as broadcastSessionSummaryStore,
  buildSessionSummary,
  type BuildSessionSummaryOptions,
} from './session-summary'
import type { SessionSummary, TurnStatus } from '@ship/contracts'
import type { Message, SessionMetaRow, Task } from './session-types'
import { migrateSessionSchema } from './session-schema'
import {
  appendRealtimeEvent,
  broadcastSessionRecords,
  getSessionEventHead,
  getToolOutput as getToolOutputStore,
} from './session-event-store'
import { synchronizeSessionConsumer } from './session-subscription'
import { buildTranscriptPage } from './session-snapshot'
import {
  beginTurn as beginTurnCommand,
  claimTurn as claimTurnCommand,
  finalizeAcceptedTurn,
  getTurnExecutionData,
  heartbeatTurn,
  markPromptSent,
  requestTurnStop,
  staleRunningTurns,
  type BeginTurnResult,
  type TurnExecutionData,
} from './session-turn-command-store'

export type { Message, MessagePart, Task } from './session-types'
export type { TurnRow, SessionEventRow } from './session-turn-store'
export type { BuildSessionSummaryOptions } from './session-summary'


export class SessionDO extends DurableObject<Env> {
  readonly sql: SqlStorage
  private sandboxManager: SandboxManager | null = null
  private agentExecutor: AgentExecutor | null = null
  private sessionId: string | null = null

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env)
    this.sql = ctx.storage.sql

    ctx.blockConcurrencyWhile(async () => {
      migrateSessionSchema(this.sql)
    })
  }

  async getSessionIdForD1(): Promise<string | null> {
    if (this.sessionId) return this.sessionId
    const meta = await this.getSessionMeta()
    const id = meta['session_id'] || null
    if (id) this.sessionId = id
    return id
  }

  async getSessionMeta(): Promise<Record<string, string>> {
    const cursor = this.sql.exec<SessionMetaRow>('SELECT key, value FROM session_meta')
    const rows = cursor.toArray()
    return Object.fromEntries(rows.map((r) => [r.key, r.value]))
  }

  async setSessionMeta(key: string, value: string): Promise<void> {
    this.sql.exec(
      `INSERT INTO session_meta (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      key,
      value,
    )
  }

  getDoInstanceId(): string {
    return this.ctx.id.toString()
  }

  getEnv(): Env {
    return this.env
  }

  getE2bApiKey(): string | undefined {
    return this.env.E2B_API_KEY
  }

  getWebSockets(tag?: string): WebSocket[] {
    return this.ctx.getWebSockets(tag)
  }

  getWebSocketCount(): number {
    return this.ctx.getWebSockets().length
  }

  acceptWebSocket(ws: WebSocket, tags?: string[]): void {
    this.ctx.acceptWebSocket(ws, tags)
  }

  /** Secret used only to authenticate direct Workflow producer sockets. */
  getProducerSecret(): string {
    return this.env.API_SECRET
  }

  /** Current canonical event head for attachment initialization. */
  getSessionEventHead(): number {
    return getSessionEventHead(this)
  }

  /** Validate that a producer socket belongs to the active Workflow attempt. */
  isProducerAttempt(turnId: string, attemptId: string): boolean {
    const row = firstSqlRow(
      this.sql.exec<{ attempt_id: string | null; status: string }>(
        'SELECT attempt_id, status FROM turns WHERE id = ?',
        turnId,
      ),
    )
    return Boolean(row && row.status === 'running' && row.attempt_id === attemptId)
  }

  /** Apply snapshot/replay synchronization for one detail consumer. */
  synchronizeConsumer(ws: WebSocket, command: SessionSubscribeCommand): void {
    synchronizeSessionConsumer(this, ws, command)
  }

  /** Persist and acknowledge a deterministic producer batch. */
  ingestProducerBatch(batch: SessionProducerBatch): SessionProducerAck['records'] {
    const records = batch.records.map((record) => appendRealtimeEvent(this, record))
    broadcastSessionRecords(this, records)
    for (const turnId of new Set(batch.records.flatMap((record) => record.turnId ? [record.turnId] : []))) {
      this.sql.exec('UPDATE turns SET heartbeat_at = ? WHERE id = ?', Date.now(), turnId)
    }
    return records.map((record) => ({ eventId: record.eventId, sequence: record.sequence }))
  }

  /** Persist an accepted turn command atomically. */
  async beginAcceptedTurn(sessionId: string, command: CreateTurnRequest): Promise<BeginTurnResult> {
    return beginTurnCommand(this, sessionId, command)
  }

  /** Claim a turn for exactly one Workflow attempt. */
  claimAcceptedTurn(turnId: string, workflowInstanceId: string, attemptId: string) {
    return claimTurnCommand(this, turnId, workflowInstanceId, attemptId)
  }

  /** Read prompt and execution state for a Workflow. */
  getAcceptedTurn(turnId: string): TurnExecutionData | null {
    return getTurnExecutionData(this, turnId)
  }

  /** Establish the at-most-once prompt fence. */
  markAcceptedTurnPromptSent(turnId: string, attemptId: string): boolean {
    return markPromptSent(this, turnId, attemptId)
  }

  /** Refresh a running turn lease. */
  async heartbeatAcceptedTurn(turnId: string, attemptId: string): Promise<boolean> {
    return heartbeatTurn(this, turnId, attemptId)
  }

  /** Request cooperative cancellation of the active turn. */
  requestAcceptedTurnStop(turnId: string): boolean {
    return requestTurnStop(this, turnId)
  }

  /** Complete a canonical turn exactly once. */
  async finalizeAcceptedTurn(
    sessionId: string,
    turnId: string,
    status: 'completed' | 'failed' | 'interrupted',
    error?: string,
    diffSummary?: Array<{ filename: string; additions: number; deletions: number }>,
  ): Promise<boolean> {
    return finalizeAcceptedTurn(this, sessionId, turnId, status, error, diffSummary)
  }

  /** Fetch a stable older transcript page. */
  getTranscriptPage(sessionId: string, before?: string, limit?: number): TranscriptPage {
    return buildTranscriptPage(this, sessionId, before, limit)
  }

  /** Fetch full tool output omitted from snapshots. */
  getToolOutput(toolCallId: string): string | null {
    return getToolOutputStore(this, toolCallId)
  }

  /** Return the active turn id used to lock selection and submissions. */
  getActiveTurnId(): string | null {
    return firstSqlRow(this.sql.exec<{ id: string }>("SELECT id FROM turns WHERE status = 'running' LIMIT 1"))?.id ?? null
  }

  /** Cache the latest D1-backed shell summary for synchronous detail snapshots. */
  async cacheShellSummary(summaryJson: string): Promise<void> {
    await this.setSessionMeta('shell_summary', summaryJson)
  }

  /** Schedule the single execution-lease alarm for this session. */
  async scheduleTurnAlarm(timestamp: number): Promise<void> {
    await this.ctx.storage.setAlarm(timestamp)
  }

  async getRecentMessages(limit: number = 25) {
    return getRecentMessagesStore(this, limit)
  }

  async persistMessage(message: Omit<Message, 'id' | 'createdAt'>): Promise<Message> {
    return persistMessageStore(this, message)
  }

  async getMessages(options: { limit?: number; before?: string } = {}): Promise<Message[]> {
    return getMessagesStore(this, options)
  }

  async updateMessageParts(messageId: string, parts: string): Promise<void> {
    return updateMessagePartsStore(this, messageId, parts)
  }

  async getMessageCount(): Promise<number> {
    return getMessageCountStore(this)
  }

  async persistTask(task: Omit<Task, 'id' | 'createdAt' | 'status'>): Promise<Task> {
    return persistTaskStore(this, task)
  }

  async updateTaskStatus(taskId: string, status: Task['status'], completedAt?: number): Promise<void> {
    return updateTaskStatusStore(this, taskId, status, completedAt)
  }

  async getNextPendingTask(): Promise<Task | null> {
    return getNextPendingTaskStore(this)
  }

  async getTasks(options?: { status?: Task['status']; limit?: number }): Promise<Task[]> {
    return getTasksStore(this, options)
  }

  async createTurn(sessionId: string, turnId: string): Promise<TurnRow> {
    return createTurnStore(this, sessionId, turnId)
  }

  async completeTurn(turnId: string, status: TurnStatus, diffSummaryJson?: string): Promise<void> {
    completeTurnStore(this, turnId, status, diffSummaryJson)
  }

  async getTurns(sessionId: string, limit?: number) {
    return getTurnsStore(this, sessionId, limit)
  }

  async appendSessionEvent(type: string, payloadJson: string): Promise<SessionEventRow> {
    return appendSessionEventStore(this, type, payloadJson)
  }

  async getRecentSessionEvents(limit?: number): Promise<SessionEventRow[]> {
    return getRecentEventsStore(this, limit)
  }

  buildSessionSummary(meta: Record<string, string>, opts?: BuildSessionSummaryOptions): SessionSummary {
    return buildSessionSummary(meta, opts)
  }

  broadcastSessionSummary(summary: SessionSummary): void {
    broadcastSessionSummaryStore(this, summary)
  }

  getSandboxManager(): SandboxManager | null {
    return this.sandboxManager
  }

  setSandboxManager(manager: SandboxManager | null): void {
    this.sandboxManager = manager
  }

  async provisionSandbox(): Promise<SandboxInfo> {
    return provisionSandboxStore(this)
  }

  async getSandbox(): Promise<string | null> {
    return getSandboxIdStore(this)
  }

  async resumeSandbox(): Promise<SandboxInfo> {
    return resumeSandboxStore(this)
  }

  async pauseSandbox(): Promise<void> {
    return pauseSandboxStore(this)
  }

  async terminateSandbox(): Promise<void> {
    return terminateSandboxStore(this, this.sql)
  }

  async getSandboxStatus() {
    return getSandboxStatusStore(this)
  }

  async setBranchName(name: string): Promise<void> {
    return setBranchNameStore(this, name)
  }

  async getBranchName(): Promise<string | null> {
    return getBranchNameStore(this)
  }

  async markFirstCommit(): Promise<boolean> {
    return markFirstCommitStore(this)
  }

  async setPullRequest(number: number, url: string, draft: boolean): Promise<void> {
    return setPullRequestStore(this, number, url, draft)
  }

  async getPullRequest(): Promise<{ number: number; url: string; draft: boolean } | null> {
    return getPullRequestStore(this)
  }

  async markReadyForReview(): Promise<void> {
    return markReadyForReviewStore(this)
  }

  async setRepoUrl(url: string): Promise<void> {
    return setRepoUrlStore(this, url)
  }

  async getRepoUrl(): Promise<string | null> {
    return getRepoUrlStore(this)
  }

  async initializeAgentExecutor(
    sandbox: ComputeCommandSandbox,
    githubToken: string,
    gitUser: { name: string; email: string },
  ): Promise<AgentExecutor> {
    this.agentExecutor = await initializeAgentExecutorBinding(this, sandbox, githubToken, gitUser)
    return this.agentExecutor
  }

  async startTask(taskDescription: string): Promise<{ branchName: string; repoPath: string; sessionId: string }> {
    if (!this.agentExecutor) {
      throw new Error('Agent executor not initialized - call initializeAgentExecutor first')
    }
    return await this.agentExecutor.executeTask(taskDescription)
  }

  async handleAgentResponse(response: { summary: string; hasChanges: boolean }): Promise<void> {
    if (!this.agentExecutor) {
      throw new Error('Agent executor not initialized')
    }
    await this.agentExecutor.onAgentResponse(response)
  }

  getAgentExecutor(): AgentExecutor | null {
    return this.agentExecutor
  }

  async fetch(request: Request): Promise<Response> {
    return handleSessionFetch(this, request)
  }

  async handleWebSocketUpgrade(request: Request): Promise<Response> {
    return handleWebSocketUpgrade(this, request)
  }

  broadcast(message: object): void {
    broadcastToWebSockets(this, message)
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    return handleWebSocketMessage(this, ws, message)
  }

  async webSocketClose(ws: WebSocket, code: number, reason: string): Promise<void> {
    return handleWebSocketClose(ws, code, reason)
  }

  async webSocketError(ws: WebSocket, _error: unknown): Promise<void> {
    return handleWebSocketError(ws)
  }

  /** Recover abandoned turns without ever repeating a prompt that crossed the fence. */
  async alarm(): Promise<void> {
    const stale = staleRunningTurns(this, Date.now() - 90_000)
    const sessionId = await this.getSessionIdForD1()
    if (!sessionId) return
    for (const turn of stale) {
      if (turn.promptSent) {
        await finalizeAcceptedTurn(
          this,
          sessionId,
          turn.id,
          'interrupted',
          'Agent execution was interrupted after the prompt was sent. The prompt was not repeated.',
        )
        continue
      }
      try {
        const instance = await this.env.SHIP_CHAT_TURN_WORKFLOW.get(turn.id)
        await instance.restart()
        this.sql.exec('UPDATE turns SET heartbeat_at = ? WHERE id = ?', Date.now(), turn.id)
      } catch (error) {
        await finalizeAcceptedTurn(
          this,
          sessionId,
          turn.id,
          'failed',
          error instanceof Error ? error.message : 'Unable to recover the abandoned turn.',
        )
      }
    }
    const active = this.sql.exec<{ value: number }>("SELECT COUNT(*) AS value FROM turns WHERE status = 'running'").one().value
    if (active > 0) await this.scheduleTurnAlarm(Date.now() + 90_000)
  }
}
