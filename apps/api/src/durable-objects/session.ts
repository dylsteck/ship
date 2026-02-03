/**
 * SessionDO - Durable Object for session state management
 *
 * This class manages per-session state using SQLite storage.
 * Each session gets its own DO instance identified by session ID.
 *
 * Responsibilities:
 * - Persist messages, tasks, and session metadata
 * - Initialize SQLite schema on construction
 * - Provide RPC methods for state access
 * - Handle WebSocket connections with Hibernation API
 *
 * Note: Message persistence added in Plan 02-04
 */

import { DurableObject } from 'cloudflare:workers'
import type { Env } from '../env.d'
import { SandboxManager, type SandboxInfo } from '../lib/e2b'
import { createAgentExecutor, type AgentExecutor, type ErrorEvent } from '../lib/agent-executor'
import type { Sandbox } from '@e2b/code-interpreter'

/**
 * Connection state attached to each WebSocket
 * Survives DO hibernation via serializeAttachment/deserializeAttachment
 */
interface ConnectionState {
  connectedAt: number
  lastSeen: number
  userId?: string
}

// Message row type matching SQLite return values
interface MessageRow extends Record<string, SqlStorageValue> {
  id: string
  role: string
  content: string
  parts: string | null
  created_at: number
}

// Message types for chat
export interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  parts?: string // JSON array of tool parts
  createdAt: number
}

export interface MessagePart {
  type: 'text' | 'tool-call' | 'tool-result'
  content?: string
  toolName?: string
  toolInput?: unknown
  toolOutput?: unknown
  state?: 'pending' | 'running' | 'complete' | 'error'
}

// Task types for agent work items
export interface Task {
  id: string
  title: string
  description?: string
  status: 'pending' | 'running' | 'complete' | 'error'
  mode: 'build' | 'plan'
  createdAt: number
  completedAt?: number
}

// Task row type matching SQLite return values
interface TaskRow extends Record<string, SqlStorageValue> {
  id: string
  title: string
  description: string | null
  status: string
  mode: string
  created_at: number
  completed_at: number | null
}

// Session meta key-value pair matching SQLite return values
interface SessionMetaRow extends Record<string, SqlStorageValue> {
  key: string
  value: string
}

export class SessionDO extends DurableObject<Env> {
  private sql: SqlStorage
  private sandboxManager: SandboxManager | null = null
  private agentExecutor: AgentExecutor | null = null

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env)
    this.sql = ctx.storage.sql

    // Initialize schema in blockConcurrencyWhile to ensure
    // schema is ready before any requests are processed
    ctx.blockConcurrencyWhile(async () => {
      this.initSchema()
    })
  }

  /**
   * Initialize SQLite schema for session data
   *
   * Tables:
   * - messages: Chat history with optional tool parts
   * - tasks: Tasks inferred from chat
   * - session_meta: Key-value metadata storage (includes sandbox_id, sandbox_status, git/PR state)
   */
  private initSchema(): void {
    this.sql.exec(`
      -- Messages table for chat history
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        parts TEXT,
        created_at INTEGER NOT NULL
      );

      -- Tasks table for inferred work items
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        status TEXT DEFAULT 'pending',
        mode TEXT DEFAULT 'build',
        created_at INTEGER NOT NULL,
        completed_at INTEGER
      );

      -- Session metadata key-value store
      -- Used for sandbox_id, sandbox_status, git/PR state, and other metadata
      -- Git/PR fields: pr_number, pr_url, pr_draft, branch_name, first_commit_done, repo_url
      CREATE TABLE IF NOT EXISTS session_meta (
        key TEXT PRIMARY KEY,
        value TEXT
      );

      -- Index for efficient message ordering
      CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at);

      -- Index for task status queries
      CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status, created_at);
    `)
  }

  /**
   * Get all session metadata as key-value object
   */
  async getSessionMeta(): Promise<Record<string, string>> {
    const cursor = this.sql.exec<SessionMetaRow>('SELECT key, value FROM session_meta')
    const rows = cursor.toArray()
    return Object.fromEntries(rows.map((r) => [r.key, r.value]))
  }

  /**
   * Set a metadata value
   */
  async setSessionMeta(key: string, value: string): Promise<void> {
    this.sql.exec(
      `INSERT INTO session_meta (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      key,
      value,
    )
  }

  /**
   * Get recent messages with optional limit
   * Returns messages ordered by created_at descending (most recent first)
   */
  async getRecentMessages(limit: number = 25): Promise<MessageRow[]> {
    const cursor = this.sql.exec<MessageRow>(
      `SELECT id, role, content, parts, created_at
       FROM messages
       ORDER BY created_at DESC
       LIMIT ?`,
      limit,
    )
    // Return in chronological order for display
    return cursor.toArray().reverse()
  }

  /**
   * Persist a message to SQLite storage
   * Broadcasts to WebSocket clients after saving
   */
  async persistMessage(message: Omit<Message, 'id' | 'createdAt'>): Promise<Message> {
    const id = crypto.randomUUID()
    const createdAt = Math.floor(Date.now() / 1000)

    this.sql.exec(
      `INSERT INTO messages (id, role, content, parts, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      id,
      message.role,
      message.content,
      message.parts || null,
      createdAt,
    )

    const saved: Message = {
      id,
      role: message.role,
      content: message.content,
      parts: message.parts,
      createdAt,
    }

    // Broadcast to WebSocket clients
    this.broadcast({ type: 'message', message: saved })

    return saved
  }

  /**
   * Get messages with pagination support
   * Returns messages in chronological order (oldest first)
   */
  async getMessages(options: { limit?: number; before?: string } = {}): Promise<Message[]> {
    const limit = options.limit || 25 // Default ~25 per CONTEXT.md

    let query = `SELECT id, role, content, parts, created_at as createdAt
                 FROM messages`
    const params: unknown[] = []

    if (options.before) {
      // Get cursor message's created_at
      const cursor = this.sql.exec(`SELECT created_at FROM messages WHERE id = ?`, options.before).one()

      if (cursor) {
        query += ` WHERE created_at < ?`
        params.push(cursor.created_at)
      }
    }

    query += ` ORDER BY created_at DESC LIMIT ?`
    params.push(limit)

    const rows = this.sql.exec(query, ...params).toArray()

    // Return in chronological order (oldest first)
    return rows.reverse().map((row) => ({
      id: row.id as string,
      role: row.role as Message['role'],
      content: row.content as string,
      parts: row.parts as string | undefined,
      createdAt: row.createdAt as number,
    }))
  }

  /**
   * Update message parts (for streaming updates)
   */
  async updateMessageParts(messageId: string, parts: string): Promise<void> {
    this.sql.exec(`UPDATE messages SET parts = ? WHERE id = ?`, parts, messageId)

    // Broadcast part update
    this.broadcast({ type: 'message-parts', messageId, parts })
  }

  /**
   * Get total message count for session list display
   */
  async getMessageCount(): Promise<number> {
    const result = this.sql.exec(`SELECT COUNT(*) as count FROM messages`).one()
    return (result?.count as number) || 0
  }

  /**
   * Persist a task to SQLite storage
   * Broadcasts to WebSocket clients after saving
   */
  async persistTask(task: Omit<Task, 'id' | 'createdAt' | 'status'>): Promise<Task> {
    const id = crypto.randomUUID()
    const createdAt = Math.floor(Date.now() / 1000)

    this.sql.exec(
      `INSERT INTO tasks (id, title, description, status, mode, created_at)
       VALUES (?, ?, ?, 'pending', ?, ?)`,
      id,
      task.title,
      task.description || null,
      task.mode,
      createdAt,
    )

    const saved: Task = {
      id,
      title: task.title,
      description: task.description,
      status: 'pending',
      mode: task.mode,
      createdAt,
    }

    // Broadcast to WebSocket clients
    this.broadcast({ type: 'task-created', task: saved })

    return saved
  }

  /**
   * Update task status (for FIFO processing)
   */
  async updateTaskStatus(taskId: string, status: Task['status'], completedAt?: number): Promise<void> {
    this.sql.exec(`UPDATE tasks SET status = ?, completed_at = ? WHERE id = ?`, status, completedAt || null, taskId)

    this.broadcast({ type: 'task-updated', taskId, status, completedAt })
  }

  /**
   * Get next pending task in FIFO order
   */
  async getNextPendingTask(): Promise<Task | null> {
    const row = this.sql
      .exec<TaskRow>(
        `SELECT id, title, description, status, mode, created_at, completed_at
       FROM tasks
       WHERE status = 'pending'
       ORDER BY created_at ASC
       LIMIT 1`,
      )
      .one()

    if (!row) return null

    return {
      id: row.id,
      title: row.title,
      description: row.description || undefined,
      status: row.status as Task['status'],
      mode: row.mode as Task['mode'],
      createdAt: row.created_at,
      completedAt: row.completed_at || undefined,
    }
  }

  /**
   * Get all tasks with optional status filter
   */
  async getTasks(options?: { status?: Task['status']; limit?: number }): Promise<Task[]> {
    let query = `SELECT id, title, description, status, mode, created_at, completed_at
                 FROM tasks`
    const params: unknown[] = []

    if (options?.status) {
      query += ` WHERE status = ?`
      params.push(options.status)
    }

    query += ` ORDER BY created_at ASC`

    if (options?.limit) {
      query += ` LIMIT ?`
      params.push(options.limit)
    }

    const rows = this.sql.exec<TaskRow>(query, ...params).toArray()

    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      description: row.description || undefined,
      status: row.status as Task['status'],
      mode: row.mode as Task['mode'],
      createdAt: row.created_at,
      completedAt: row.completed_at || undefined,
    }))
  }

  /**
   * Provision a new E2B sandbox for this session
   * Stores sandboxId in session_meta for persistence across hibernation
   *
   * @returns SandboxInfo with sandbox ID and status
   */
  async provisionSandbox(): Promise<SandboxInfo> {
    // Get E2B API key from environment
    const apiKey = this.env.E2B_API_KEY
    if (!apiKey) {
      throw new Error('E2B_API_KEY not configured')
    }

    // Get session ID from context
    const sessionId = this.ctx.id.toString()

    // Create sandbox manager if not exists
    if (!this.sandboxManager) {
      this.sandboxManager = new SandboxManager(apiKey, sessionId)
    }

    // Provision new sandbox
    const info = await this.sandboxManager.provision()

    // Store sandbox ID and status in session_meta
    await this.setSessionMeta('sandbox_id', info.id)
    await this.setSessionMeta('sandbox_status', info.status)

    return info
  }

  /**
   * Get current sandbox ID (if provisioned)
   * Returns null if no sandbox has been provisioned
   */
  async getSandbox(): Promise<string | null> {
    const meta = await this.getSessionMeta()
    return meta['sandbox_id'] || null
  }

  /**
   * Resume existing sandbox after hibernation
   * Reconnects to the stored sandbox ID
   *
   * @returns SandboxInfo with current status
   */
  async resumeSandbox(): Promise<SandboxInfo> {
    const sandboxId = await this.getSandbox()
    if (!sandboxId) {
      throw new Error('No sandbox to resume')
    }

    // Get E2B API key from environment
    const apiKey = this.env.E2B_API_KEY
    if (!apiKey) {
      throw new Error('E2B_API_KEY not configured')
    }

    // Get session ID from context
    const sessionId = this.ctx.id.toString()

    // Create sandbox manager if not exists
    if (!this.sandboxManager) {
      this.sandboxManager = new SandboxManager(apiKey, sessionId)
    }

    // Resume the sandbox
    const info = await this.sandboxManager.resume(sandboxId)

    // Update status in session_meta
    await this.setSessionMeta('sandbox_status', info.status)

    return info
  }

  /**
   * Pause the sandbox to control costs
   * Uses E2B betaPause() for explicit idle handling
   */
  async pauseSandbox(): Promise<void> {
    if (!this.sandboxManager) {
      throw new Error('No sandbox manager initialized')
    }

    await this.sandboxManager.pause()

    // Update status in session_meta
    await this.setSessionMeta('sandbox_status', 'paused')
  }

  /**
   * Terminate the sandbox and clear metadata
   */
  async terminateSandbox(): Promise<void> {
    const sandboxId = await this.getSandbox()
    if (!sandboxId) {
      return
    }

    const apiKey = this.env.E2B_API_KEY
    if (!apiKey) {
      throw new Error('E2B_API_KEY not configured')
    }

    const sessionId = this.ctx.id.toString()

    if (!this.sandboxManager) {
      this.sandboxManager = new SandboxManager(apiKey, sessionId)
    }

    this.sandboxManager.setSandboxId(sandboxId)
    await this.sandboxManager.terminate()

    await this.setSessionMeta('sandbox_status', 'terminated')
    await this.setSessionMeta('sandbox_id', '')
  }

  /**
   * Get sandbox status
   * Returns current status from session_meta
   */
  async getSandboxStatus(): Promise<{ sandboxId: string | null; status: string | null }> {
    const meta = await this.getSessionMeta()
    return {
      sandboxId: meta['sandbox_id'] || null,
      status: meta['sandbox_status'] || null,
    }
  }

  /**
   * Set branch name for this session
   * @param name - Git branch name
   */
  async setBranchName(name: string): Promise<void> {
    await this.setSessionMeta('branch_name', name)
  }

  /**
   * Get current branch name
   * @returns Branch name or null if not set
   */
  async getBranchName(): Promise<string | null> {
    const meta = await this.getSessionMeta()
    return meta['branch_name'] || null
  }

  /**
   * Link Linear issue to this session
   * @param linearIssueId - Linear issue ID
   */
  async linkLinearIssue(linearIssueId: string): Promise<void> {
    await this.setSessionMeta('linearIssueId', linearIssueId)
  }

  /**
   * Get linked Linear issue ID for this session
   * @returns Linear issue ID or null if not linked
   */
  async getLinearIssueId(): Promise<string | null> {
    const meta = await this.getSessionMeta()
    return meta['linearIssueId'] || null
  }

  /**
   * Clear Linear issue link from this session
   */
  async clearLinearIssue(): Promise<void> {
    this.sql.exec(`DELETE FROM session_meta WHERE key = ?`, 'linearIssueId')
  }

  /**
   * Check if session has linked Linear issue
   * @returns true if Linear issue is linked, false otherwise
   */
  async hasLinkedLinearIssue(): Promise<boolean> {
    const linearIssueId = await this.getLinearIssueId()
    return linearIssueId !== null
  }

  /**
   * Mark first commit as done
   * Returns true if this was the first commit (transitions from false to true)
   * Returns false if first commit was already marked
   *
   * This is used to trigger auto-PR creation on the first commit only
   */
  async markFirstCommit(): Promise<boolean> {
    const meta = await this.getSessionMeta()
    const wasFirstCommit = !meta['first_commit_done']

    if (wasFirstCommit) {
      await this.setSessionMeta('first_commit_done', 'true')
    }

    return wasFirstCommit
  }

  /**
   * Set pull request information
   * @param number - GitHub PR number
   * @param url - GitHub PR URL
   * @param draft - Whether PR is draft
   */
  async setPullRequest(number: number, url: string, draft: boolean): Promise<void> {
    await this.setSessionMeta('pr_number', number.toString())
    await this.setSessionMeta('pr_url', url)
    await this.setSessionMeta('pr_draft', draft.toString())
  }

  /**
   * Get pull request information
   * @returns PR details or null if no PR exists
   */
  async getPullRequest(): Promise<{ number: number; url: string; draft: boolean } | null> {
    const meta = await this.getSessionMeta()

    if (!meta['pr_number']) {
      return null
    }

    return {
      number: parseInt(meta['pr_number']),
      url: meta['pr_url'],
      draft: meta['pr_draft'] === 'true',
    }
  }

  /**
   * Mark PR as ready for review (convert from draft to ready)
   */
  async markReadyForReview(): Promise<void> {
    await this.setSessionMeta('pr_draft', 'false')
  }

  /**
   * Set repository URL for this session
   * @param url - Repository URL
   */
  async setRepoUrl(url: string): Promise<void> {
    await this.setSessionMeta('repo_url', url)
  }

  /**
   * Get repository URL
   * @returns Repo URL or null if not set
   */
  async getRepoUrl(): Promise<string | null> {
    const meta = await this.getSessionMeta()
    return meta['repo_url'] || null
  }

  /**
   * Initialize agent executor with all dependencies
   * Creates AgentExecutor with sandbox, GitHub token, and git user info
   *
   * @param sandbox - E2B sandbox instance
   * @param githubToken - GitHub personal access token
   * @param gitUser - Git user info for commit attribution
   * @returns AgentExecutor instance
   */
  async initializeAgentExecutor(
    sandbox: Sandbox,
    githubToken: string,
    gitUser: { name: string; email: string },
  ): Promise<AgentExecutor> {
    const repoUrl = await this.getRepoUrl()
    if (!repoUrl) {
      throw new Error('Repository URL not set')
    }

    const sessionId = this.ctx.id.toString()

    this.agentExecutor = createAgentExecutor({
      sessionDO: this,
      sandbox,
      githubToken,
      repoUrl,
      gitUser,
      sessionId,
      env: this.env, // Pass DB access for Linear integration
      onError: (event: ErrorEvent) => {
        // Emit error to WebSocket clients
        this.broadcast({
          type: 'error',
          message: event.error.message,
          category: event.category,
          context: event.context,
          retryable: event.retryable,
          attempt: event.attempt,
        })
      },
      onStatus: (status: string, details?: string) => {
        // Emit status updates to WebSocket clients
        this.broadcast({
          type: 'agent-status',
          status,
          details,
        })
      },
    })

    return this.agentExecutor
  }

  /**
   * Start a task with agent execution and Git workflow
   * Generates branch name, creates branch in sandbox, starts agent
   *
   * @param taskDescription - Task description from user
   * @returns Execution context with branch info
   */
  async startTask(taskDescription: string): Promise<{ branchName: string; repoPath: string; sessionId: string }> {
    if (!this.agentExecutor) {
      throw new Error('Agent executor not initialized - call initializeAgentExecutor first')
    }

    return await this.agentExecutor.executeTask(taskDescription)
  }

  /**
   * Handle agent response - triggers git commit and push
   * Called after each agent response completes
   *
   * @param response - Agent response with summary
   */
  async handleAgentResponse(response: { summary: string; hasChanges: boolean }): Promise<void> {
    if (!this.agentExecutor) {
      throw new Error('Agent executor not initialized')
    }

    await this.agentExecutor.onAgentResponse(response)
  }

  /**
   * Get agent executor instance
   * @returns AgentExecutor or null if not initialized
   */
  getAgentExecutor(): AgentExecutor | null {
    return this.agentExecutor
  }

  /**
   * Handle HTTP fetch requests to this Durable Object
   * Supports WebSocket upgrades and basic HTTP endpoints
   */
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)

    // WebSocket upgrade endpoint
    if (url.pathname.endsWith('/websocket')) {
      const upgradeHeader = request.headers.get('Upgrade')
      if (upgradeHeader !== 'websocket') {
        return new Response('Expected WebSocket', { status: 426 })
      }
      return this.handleWebSocketUpgrade(request)
    }

    // Basic health check endpoint
    if (url.pathname.endsWith('/health')) {
      return Response.json({
        status: 'ok',
        tables: ['messages', 'tasks', 'session_meta'],
        connections: this.ctx.getWebSockets().length,
      })
    }

    // RPC: Get messages with pagination
    if (url.pathname.endsWith('/messages') && request.method === 'GET') {
      const limit = url.searchParams.get('limit')
      const before = url.searchParams.get('before')
      const messages = await this.getMessages({
        limit: limit ? parseInt(limit) : undefined,
        before: before || undefined,
      })
      return Response.json(messages)
    }

    // RPC: Persist message
    if (url.pathname.endsWith('/messages') && request.method === 'POST') {
      const body = (await request.json()) as Omit<Message, 'id' | 'createdAt'>
      const message = await this.persistMessage(body)
      return Response.json(message)
    }

    // RPC: Get tasks
    if (url.pathname.endsWith('/tasks') && request.method === 'GET') {
      const status = url.searchParams.get('status') as Task['status'] | null
      const tasks = await this.getTasks({ status: status || undefined })
      return Response.json(tasks)
    }

    // RPC: Create task
    if (url.pathname.endsWith('/tasks') && request.method === 'POST') {
      const body = (await request.json()) as Omit<Task, 'id' | 'createdAt' | 'status'>
      const task = await this.persistTask(body)
      return Response.json(task)
    }

    // RPC: Get session metadata
    if (url.pathname.endsWith('/meta') && request.method === 'GET') {
      const meta = await this.getSessionMeta()
      return Response.json(meta)
    }

    // RPC: Update session metadata
    if (url.pathname.endsWith('/meta') && request.method === 'POST') {
      const body = (await request.json()) as Record<string, string>
      for (const [key, value] of Object.entries(body)) {
        await this.setSessionMeta(key, value)
      }
      return Response.json({ success: true })
    }

    // RPC: Broadcast to WebSocket clients
    if (url.pathname.endsWith('/broadcast') && request.method === 'POST') {
      const body = (await request.json()) as object
      this.broadcast(body)
      return Response.json({ success: true })
    }

    // RPC: Provision sandbox
    if (url.pathname.endsWith('/sandbox/provision') && request.method === 'POST') {
      try {
        const info = await this.provisionSandbox()
        return Response.json(info)
      } catch (error) {
        return Response.json(
          { error: error instanceof Error ? error.message : 'Failed to provision sandbox' },
          { status: 500 },
        )
      }
    }

    // RPC: Get sandbox status
    if (url.pathname.endsWith('/sandbox/status') && request.method === 'GET') {
      const status = await this.getSandboxStatus()
      return Response.json(status)
    }

    // RPC: Pause sandbox
    if (url.pathname.endsWith('/sandbox/pause') && request.method === 'POST') {
      try {
        await this.pauseSandbox()
        return Response.json({ success: true })
      } catch (error) {
        return Response.json(
          { error: error instanceof Error ? error.message : 'Failed to pause sandbox' },
          { status: 500 },
        )
      }
    }

    // RPC: Resume sandbox
    if (url.pathname.endsWith('/sandbox/resume') && request.method === 'POST') {
      try {
        const info = await this.resumeSandbox()
        return Response.json(info)
      } catch (error) {
        return Response.json(
          { error: error instanceof Error ? error.message : 'Failed to resume sandbox' },
          { status: 500 },
        )
      }
    }

    // RPC: Terminate sandbox
    if (url.pathname.endsWith('/sandbox/terminate') && request.method === 'POST') {
      try {
        await this.terminateSandbox()
        return Response.json({ success: true })
      } catch (error) {
        return Response.json(
          { error: error instanceof Error ? error.message : 'Failed to terminate sandbox' },
          { status: 500 },
        )
      }
    }

    // RPC: Get git state (branch, PR info)
    if (url.pathname.endsWith('/git/state') && request.method === 'GET') {
      const branchName = await this.getBranchName()
      const pr = await this.getPullRequest()
      const repoUrl = await this.getRepoUrl()

      return Response.json({
        branchName,
        pr,
        repoUrl,
      })
    }

    // RPC: Mark PR as ready for review
    if (url.pathname.endsWith('/git/pr/ready') && request.method === 'POST') {
      try {
        await this.markReadyForReview()
        return Response.json({ success: true })
      } catch (error) {
        return Response.json(
          { error: error instanceof Error ? error.message : 'Failed to mark PR ready' },
          { status: 500 },
        )
      }
    }

    // RPC: Start task with agent execution
    if (url.pathname.endsWith('/task/start') && request.method === 'POST') {
      try {
        const body = (await request.json()) as { taskDescription: string }
        const context = await this.startTask(body.taskDescription)
        return Response.json(context)
      } catch (error) {
        return Response.json(
          { error: error instanceof Error ? error.message : 'Failed to start task' },
          { status: 500 },
        )
      }
    }

    // RPC: Handle agent response (commit + push)
    if (url.pathname.endsWith('/agent/response') && request.method === 'POST') {
      try {
        const body = (await request.json()) as { summary: string; hasChanges: boolean }
        await this.handleAgentResponse(body)
        return Response.json({ success: true })
      } catch (error) {
        return Response.json(
          { error: error instanceof Error ? error.message : 'Failed to handle agent response' },
          { status: 500 },
        )
      }
    }

    // RPC: Initialize agent executor
    if (url.pathname.endsWith('/agent/init') && request.method === 'POST') {
      try {
        const body = (await request.json()) as { githubToken: string; gitUser: { name: string; email: string } }

        // Get sandbox info
        const sandboxInfo = await this.getSandboxStatus()
        if (!sandboxInfo.sandboxId) {
          return Response.json({ error: 'Sandbox not provisioned' }, { status: 400 })
        }

        // Get repo URL
        const repoUrl = await this.getRepoUrl()
        if (!repoUrl) {
          return Response.json({ error: 'Repository URL not set' }, { status: 400 })
        }

        // Connect to sandbox and initialize agent executor
        const { Sandbox } = await import('../lib/e2b')
        const sandbox = await Sandbox.connect(sandboxInfo.sandboxId, { apiKey: this.env.E2B_API_KEY })

        await this.initializeAgentExecutor(sandbox, body.githubToken, body.gitUser)
        return Response.json({ success: true })
      } catch (error) {
        return Response.json(
          { error: error instanceof Error ? error.message : 'Failed to initialize agent executor' },
          { status: 500 },
        )
      }
    }

    return new Response('Not found', { status: 404 })
  }

  /**
   * Handle WebSocket upgrade request
   * Uses Hibernation API to allow DO to sleep while connections stay open
   */
  private handleWebSocketUpgrade(_request: Request): Response {
    const pair = new WebSocketPair()
    const [client, server] = Object.values(pair)

    // Use Hibernation API - DO can sleep while connection stays open
    this.ctx.acceptWebSocket(server)

    // Store connection state that survives hibernation
    const state: ConnectionState = {
      connectedAt: Date.now(),
      lastSeen: Date.now(),
    }
    server.serializeAttachment(state)

    return new Response(null, { status: 101, webSocket: client })
  }

  /**
   * Get all connected WebSockets with their state
   * Used internally - connections are retrieved fresh on each wake
   */
  private getConnections(): Map<WebSocket, ConnectionState> {
    const connections = new Map<WebSocket, ConnectionState>()
    for (const ws of this.ctx.getWebSockets()) {
      const state = ws.deserializeAttachment() as ConnectionState
      if (state) connections.set(ws, state)
    }
    return connections
  }

  /**
   * Broadcast a message to all connected WebSocket clients
   */
  private broadcast(message: object): void {
    const json = JSON.stringify(message)
    for (const ws of this.ctx.getWebSockets()) {
      try {
        ws.send(json)
      } catch {
        // Connection may be closing, ignore
      }
    }
  }

  /**
   * WebSocket message handler (required for Hibernation API)
   * Called when a client sends a message
   */
  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    // Update last seen timestamp
    const state = ws.deserializeAttachment() as ConnectionState
    state.lastSeen = Date.now()
    ws.serializeAttachment(state)

    // Parse and handle message
    try {
      const data = JSON.parse(message as string)
      // Echo for now - real handling in later plans
      this.broadcast({ type: 'echo', data })
    } catch {
      ws.send(JSON.stringify({ type: 'error', message: 'Invalid JSON' }))
    }
  }

  /**
   * WebSocket close handler (required for Hibernation API)
   * CRITICAL: Must reciprocate close to avoid 1006 errors
   */
  async webSocketClose(ws: WebSocket, code: number, reason: string): Promise<void> {
    // Reciprocate the close
    ws.close(code, reason)
  }

  /**
   * WebSocket error handler (required for Hibernation API)
   */
  async webSocketError(ws: WebSocket, error: unknown): Promise<void> {
    console.error('WebSocket error:', error)
    ws.close(1011, 'Internal error')
  }
}
