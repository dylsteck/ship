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

import { DurableObject } from 'cloudflare:workers';
import type { Env } from '../env.d';

/**
 * Connection state attached to each WebSocket
 * Survives DO hibernation via serializeAttachment/deserializeAttachment
 */
interface ConnectionState {
  connectedAt: number;
  lastSeen: number;
  userId?: string;
}

// Message row type matching SQLite return values
interface MessageRow extends Record<string, SqlStorageValue> {
  id: string;
  role: string;
  content: string;
  parts: string | null;
  created_at: number;
}

// Task row type matching SQLite return values
interface TaskRow extends Record<string, SqlStorageValue> {
  id: string;
  title: string;
  description: string | null;
  status: string;
  mode: string;
  created_at: number;
  completed_at: number | null;
}

// Session meta key-value pair matching SQLite return values
interface SessionMetaRow extends Record<string, SqlStorageValue> {
  key: string;
  value: string;
}

export class SessionDO extends DurableObject<Env> {
  private sql: SqlStorage;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;

    // Initialize schema in blockConcurrencyWhile to ensure
    // schema is ready before any requests are processed
    ctx.blockConcurrencyWhile(async () => {
      this.initSchema();
    });
  }

  /**
   * Initialize SQLite schema for session data
   *
   * Tables:
   * - messages: Chat history with optional tool parts
   * - tasks: Tasks inferred from chat
   * - session_meta: Key-value metadata storage
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
      CREATE TABLE IF NOT EXISTS session_meta (
        key TEXT PRIMARY KEY,
        value TEXT
      );

      -- Index for efficient message ordering
      CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at);

      -- Index for task status queries
      CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status, created_at);
    `);
  }

  /**
   * Get all session metadata as key-value object
   */
  async getSessionMeta(): Promise<Record<string, string>> {
    const cursor = this.sql.exec<SessionMetaRow>(
      'SELECT key, value FROM session_meta'
    );
    const rows = cursor.toArray();
    return Object.fromEntries(rows.map((r) => [r.key, r.value]));
  }

  /**
   * Set a metadata value
   */
  async setSessionMeta(key: string, value: string): Promise<void> {
    this.sql.exec(
      `INSERT INTO session_meta (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      key,
      value
    );
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
      limit
    );
    // Return in chronological order for display
    return cursor.toArray().reverse();
  }

  /**
   * Handle HTTP fetch requests to this Durable Object
   * Supports WebSocket upgrades and basic HTTP endpoints
   */
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // WebSocket upgrade endpoint
    if (url.pathname.endsWith('/websocket')) {
      const upgradeHeader = request.headers.get('Upgrade');
      if (upgradeHeader !== 'websocket') {
        return new Response('Expected WebSocket', { status: 426 });
      }
      return this.handleWebSocketUpgrade(request);
    }

    // Basic health check endpoint
    if (url.pathname.endsWith('/health')) {
      return Response.json({
        status: 'ok',
        tables: ['messages', 'tasks', 'session_meta'],
        connections: this.ctx.getWebSockets().length,
      });
    }

    return new Response('Not found', { status: 404 });
  }

  /**
   * Handle WebSocket upgrade request
   * Uses Hibernation API to allow DO to sleep while connections stay open
   */
  private handleWebSocketUpgrade(_request: Request): Response {
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    // Use Hibernation API - DO can sleep while connection stays open
    this.ctx.acceptWebSocket(server);

    // Store connection state that survives hibernation
    const state: ConnectionState = {
      connectedAt: Date.now(),
      lastSeen: Date.now(),
    };
    server.serializeAttachment(state);

    return new Response(null, { status: 101, webSocket: client });
  }

  /**
   * Get all connected WebSockets with their state
   * Used internally - connections are retrieved fresh on each wake
   */
  private getConnections(): Map<WebSocket, ConnectionState> {
    const connections = new Map<WebSocket, ConnectionState>();
    for (const ws of this.ctx.getWebSockets()) {
      const state = ws.deserializeAttachment() as ConnectionState;
      if (state) connections.set(ws, state);
    }
    return connections;
  }

  /**
   * Broadcast a message to all connected WebSocket clients
   */
  private broadcast(message: object): void {
    const json = JSON.stringify(message);
    for (const ws of this.ctx.getWebSockets()) {
      try {
        ws.send(json);
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
    const state = ws.deserializeAttachment() as ConnectionState;
    state.lastSeen = Date.now();
    ws.serializeAttachment(state);

    // Parse and handle message
    try {
      const data = JSON.parse(message as string);
      // Echo for now - real handling in later plans
      this.broadcast({ type: 'echo', data });
    } catch {
      ws.send(JSON.stringify({ type: 'error', message: 'Invalid JSON' }));
    }
  }

  /**
   * WebSocket close handler (required for Hibernation API)
   * CRITICAL: Must reciprocate close to avoid 1006 errors
   */
  async webSocketClose(ws: WebSocket, code: number, reason: string): Promise<void> {
    // Reciprocate the close
    ws.close(code, reason);
  }

  /**
   * WebSocket error handler (required for Hibernation API)
   */
  async webSocketError(ws: WebSocket, error: unknown): Promise<void> {
    console.error('WebSocket error:', error);
    ws.close(1011, 'Internal error');
  }
}
