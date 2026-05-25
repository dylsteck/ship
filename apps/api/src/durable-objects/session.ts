/**
 * SessionDO - Durable Object for session state management
 *
 * Each session gets its own DO instance identified by session ID.
 * Persists messages, tasks, and session metadata in SQLite.
 */

import { DurableObject } from 'cloudflare:workers'
import type { Env } from '../env.d'
import { SandboxManager, type SandboxInfo } from '../lib/e2b'
import type { AgentExecutor } from '../lib/agent-executor'
import type { ComputeCommandSandbox } from '../lib/sandbox-command'
import { handleSessionFetch } from './session-fetch-handlers'
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
      this.initSchema()
    })
  }

  async getSessionIdForD1(): Promise<string | null> {
    if (this.sessionId) return this.sessionId
    const meta = await this.getSessionMeta()
    const id = meta['session_id'] || null
    if (id) this.sessionId = id
    return id
  }

  private initSchema(): void {
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        parts TEXT,
        created_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        status TEXT DEFAULT 'pending',
        mode TEXT DEFAULT 'build',
        created_at INTEGER NOT NULL,
        completed_at INTEGER
      );

      CREATE TABLE IF NOT EXISTS session_meta (
        key TEXT PRIMARY KEY,
        value TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at);
      CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status, created_at);

      CREATE TABLE IF NOT EXISTS turns (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        started_at INTEGER NOT NULL,
        completed_at INTEGER,
        status TEXT NOT NULL,
        diff_summary TEXT
      );

      CREATE TABLE IF NOT EXISTS session_events (
        sequence INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL,
        payload TEXT NOT NULL,
        occurred_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_turns_session ON turns(session_id, started_at);
    `)
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

  getWebSockets(): WebSocket[] {
    return this.ctx.getWebSockets()
  }

  getWebSocketCount(): number {
    return this.ctx.getWebSockets().length
  }

  acceptWebSocket(ws: WebSocket): void {
    this.ctx.acceptWebSocket(ws)
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

  handleWebSocketUpgrade(request: Request): Response {
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

  async webSocketError(ws: WebSocket, error: unknown): Promise<void> {
    return handleWebSocketError(ws, error)
  }
}
