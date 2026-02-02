# Phase 2: Stateful Core - Research

**Researched:** 2026-02-01
**Domain:** Cloudflare Durable Objects, WebSocket real-time, OpenCode SDK
**Confidence:** HIGH

## Summary

This phase implements stateful sessions using Cloudflare Durable Objects with WebSocket hibernation for real-time updates and **OpenCode SDK for agent execution**. The architecture follows Cloudflare's recommended pattern of one Durable Object per session (not a global singleton), with SQLite storage for persistence and the WebSocket Hibernation API for cost-efficient real-time connections.

The standard stack combines Hono (already in use) for routing, Durable Objects for session state, and **OpenCode SDK (@opencode-ai/sdk)** for all agent functionality. OpenCode handles LLM calls, tool execution, and streaming via SSE - we don't make direct LLM calls. The Durable Object coordinates with OpenCode server and broadcasts updates to connected clients via WebSocket.

**Primary recommendation:** Use Durable Objects with SQLite storage for session metadata and message persistence; OpenCode SDK for agent execution with SSE event streaming; WebSocket Hibernation API for client real-time updates.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Cloudflare Durable Objects | SQLite backend | Per-session state and coordination | Official CF recommended for stateful apps |
| @opencode-ai/sdk | latest | Agent execution, LLM calls, tools | Full agent runtime with Build/Plan modes, tool streaming |
| hono | ^4.6.18 | Route WebSocket upgrades to DOs | Already in stack, excellent CF Workers integration |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| opencode (CLI) | latest | OpenCode server process | Required backend for SDK |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| OpenCode SDK | AI SDK + custom tools | OpenCode provides full agent runtime (Build/Plan modes, task inference); AI SDK requires building agent logic from scratch |
| OpenCode SDK | AI SDK + OpenCode provider | Provider doesn't support custom AI SDK tools; just a passthrough to OpenCode anyway |
| Durable Objects SQLite | D1 external | SQLite in DO provides zero-latency colocated storage; D1 adds network hop |
| WebSocket Hibernation | Standard WebSocket | Hibernation reduces GB-second costs 10-100x for idle connections |

**Why OpenCode SDK over AI SDK:**
1. OpenCode provides Build mode vs Plan mode out of the box
2. Full tool execution runtime (file ops, shell, code editing) - no custom tools needed
3. Task inference from natural language (like Claude Code)
4. SSE streaming with rich event types (tool calls, permission requests, etc.)
5. AI SDK's OpenCode provider explicitly states "Tool Usage and Tool Streaming show ❌"

**Installation:**
```bash
# In apps/api
pnpm add @opencode-ai/sdk

# OpenCode server required (runs separately or auto-started by SDK)
npm install -g opencode
```

## Architecture Patterns

### Recommended Project Structure
```
apps/api/src/
├── index.ts              # Hono router, WebSocket upgrade to DO
├── durable-objects/
│   └── session.ts        # SessionDO: state persistence, WebSocket, OpenCode coordination
├── routes/
│   ├── sessions.ts       # CRUD endpoints for sessions
│   └── repos.ts          # GitHub repos listing for session creation
├── lib/
│   └── opencode.ts       # OpenCode SDK client wrapper
└── env.d.ts              # Updated with DO bindings

apps/web/
├── app/(app)/session/[id]/
│   └── page.tsx          # Session page with chat UI
├── components/
│   ├── chat/
│   │   ├── chat-interface.tsx  # Chat with message rendering
│   │   ├── message-list.tsx    # Message rendering with tool parts
│   │   ├── tool-block.tsx      # Collapsible tool call display
│   │   └── chat-input.tsx      # Input with stop/queue controls
│   └── session/
│       ├── session-list.tsx    # Dashboard session list
│       └── session-panel.tsx   # Side panel (repo, branch, tasks)
└── lib/
    └── websocket.ts      # WebSocket client with reconnection
```

### Pattern 1: One Durable Object Per Session
**What:** Each session gets its own DO instance identified by session ID
**When to use:** Always for this app - provides isolation, avoids bottlenecks
**Example:**
```typescript
// Source: Cloudflare Durable Objects docs
// apps/api/src/routes/sessions.ts
app.get('/sessions/:id/connect', async (c) => {
  const sessionId = c.req.param('id');
  const id = c.env.SESSION_DO.idFromName(sessionId);
  const stub = c.env.SESSION_DO.get(id);
  return stub.fetch(c.req.raw);
});
```

### Pattern 2: WebSocket Hibernation with Attachment State
**What:** Use ctx.acceptWebSocket() for hibernatable connections, store per-connection state in attachments
**When to use:** For all WebSocket connections to minimize duration charges
**Example:**
```typescript
// Source: Cloudflare Durable Objects WebSocket Hibernation docs
export class SessionDO extends DurableObject {
  async fetch(request: Request) {
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    // Hibernatable WebSocket - DO can sleep while connection stays open
    this.ctx.acceptWebSocket(server);

    // Store per-connection state that survives hibernation
    server.serializeAttachment({
      joinedAt: Date.now(),
      lastSeen: Date.now()
    });

    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, message: string) {
    const attachment = ws.deserializeAttachment();
    // Handle message, broadcast to other connections
  }

  async webSocketClose(ws: WebSocket, code: number, reason: string) {
    ws.close(code, reason); // CRITICAL: Must reciprocate close
  }
}
```

### Pattern 3: OpenCode SDK Session Management
**What:** Use OpenCode SDK to manage agent sessions and subscribe to events
**When to use:** For all agent interactions
**Example:**
```typescript
// Source: OpenCode SDK docs (https://opencode.ai/docs/sdk/)
import { createOpencode } from '@opencode-ai/sdk';

// Initialize OpenCode client (auto-starts server if needed)
const opencode = await createOpencode({
  hostname: '127.0.0.1',
  port: 4096,
  config: {
    // Override opencode.json settings
    provider: 'anthropic',
    model: 'claude-sonnet-4-20250514',
  }
});

// Create a new OpenCode session
const session = await opencode.session.create({
  projectPath: '/path/to/cloned/repo'
});

// Send a prompt and receive streaming events
const events = opencode.event.subscribe();
await opencode.session.prompt(session.id, {
  content: 'Add authentication to the login page'
});

// Process events as they arrive
for await (const event of events) {
  if (event.type === 'part') {
    // Tool call, text chunk, etc.
    broadcastToWebSocket(event);
  }
  if (event.type === 'session.idle') {
    // Agent finished processing
    break;
  }
}
```

### Pattern 4: Durable Object as Coordinator
**What:** DO persists session metadata and coordinates between OpenCode and client WebSocket
**When to use:** Core architectural pattern for this phase
**Example:**
```typescript
// apps/api/src/durable-objects/session.ts
import { DurableObject } from 'cloudflare:workers';

export class SessionDO extends DurableObject {
  private sql: SqlStorage;
  private connections: Map<WebSocket, { userId: string }> = new Map();
  private opencodeSessionId: string | null = null;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;

    ctx.blockConcurrencyWhile(async () => {
      this.initSchema();
      this.ctx.getWebSockets().forEach((ws) => {
        const attachment = ws.deserializeAttachment();
        if (attachment) this.connections.set(ws, attachment);
      });
    });
  }

  private initSchema() {
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        parts TEXT, -- JSON for tool parts from OpenCode events
        created_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        created_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS session_meta (
        key TEXT PRIMARY KEY,
        value TEXT
      );
    `);
  }

  // When user sends a message, forward to OpenCode and stream events back
  async handleChatMessage(content: string) {
    // Persist user message
    this.persistMessage({ role: 'user', content });

    // Forward to OpenCode session
    // OpenCode SDK call happens in Worker (not DO) due to external I/O
    // DO receives events via internal RPC and broadcasts to WebSocket
    return { action: 'prompt', content };
  }

  private broadcast(message: object) {
    const json = JSON.stringify(message);
    this.connections.forEach((_, ws) => {
      try { ws.send(json); } catch {}
    });
  }
}
```

### Pattern 5: OpenCode Event Types for UI
**What:** Map OpenCode SSE events to UI components
**When to use:** Rendering chat with tool calls
**Example:**
```typescript
// OpenCode event types from SDK
interface OpenCodeEvent {
  type: 'part' | 'session.idle' | 'session.error' | 'permission.request';
  // For 'part' events:
  part?: {
    type: 'text' | 'tool-call' | 'tool-result';
    content?: string;
    toolName?: string;
    toolInput?: unknown;
    toolOutput?: unknown;
    state?: 'pending' | 'running' | 'complete' | 'error';
  };
}

// Map to UI rendering
function renderPart(part: OpenCodeEvent['part']) {
  switch (part.type) {
    case 'text':
      return <TextChunk content={part.content} />;
    case 'tool-call':
      return (
        <ToolBlock
          name={part.toolName}
          input={part.toolInput}
          state={part.state}
          collapsed={true} // Default collapsed per CONTEXT.md
        />
      );
    case 'tool-result':
      return <ToolResult output={part.toolOutput} />;
  }
}
```

### Anti-Patterns to Avoid
- **Global singleton DO:** Never route all sessions through one DO instance - creates bottleneck
- **In-memory only state:** Always persist to SQLite; in-memory lost on hibernation/eviction
- **server.accept() instead of ctx.acceptWebSocket():** Prevents hibernation, increases costs
- **Direct LLM calls from DO:** Use OpenCode SDK; it handles tool execution, streaming, and agent logic
- **External I/O in blockConcurrencyWhile:** Only use for init/migrations; limits throughput

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Agent runtime | Custom tool loop | OpenCode SDK | Build/Plan modes, task inference, tool execution all built-in |
| Token streaming | Custom SSE parsing | OpenCode event.subscribe() | Handles backpressure, rich event types |
| Tool execution | Custom tool definitions | OpenCode built-in tools | File ops, shell, code editing battle-tested |
| WebSocket reconnection | Simple retry loop | Exponential backoff with jitter | Prevents thundering herd, handles network edge cases |
| Chat message history | Array in memory | SQLite in Durable Object | Survives hibernation, supports pagination |
| Session coordination | Polling | WebSocket Hibernation API | Real-time with minimal cost during idle |

**Key insight:** OpenCode SDK provides the complete agent runtime. Our job is state persistence (DO + SQLite) and real-time client updates (WebSocket). Don't rebuild what OpenCode already provides.

## Common Pitfalls

### Pitfall 1: Forgetting to Reciprocate WebSocket Close
**What goes wrong:** Client receives 1006 errors instead of clean close
**Why it happens:** webSocketClose() receives close event but doesn't call ws.close()
**How to avoid:** Always call `ws.close(code, reason)` in webSocketClose handler
**Warning signs:** 1006 close codes in client logs

### Pitfall 2: In-Memory State Loss on Hibernation
**What goes wrong:** Session data disappears after period of inactivity
**Why it happens:** Hibernation evicts DO from memory; constructor runs fresh on wake
**How to avoid:** Persist all important state to SQLite; reload in constructor
**Warning signs:** State resets after ~10 seconds of inactivity

### Pitfall 3: Running OpenCode SDK in Durable Object
**What goes wrong:** External HTTP calls from DO have complex semantics
**Why it happens:** DO input gates reopen during await fetch(); requests interleave
**How to avoid:** Run OpenCode SDK calls in Worker, stream events to DO via RPC
**Warning signs:** Race conditions, inconsistent state

### Pitfall 4: Not Handling OpenCode Permission Requests
**What goes wrong:** Agent hangs waiting for permission approval
**Why it happens:** OpenCode emits 'permission.request' events that need response
**How to avoid:** Subscribe to permission events, forward to client WebSocket for approval
**Warning signs:** Agent stuck, no progress despite messages

### Pitfall 5: Message Queue During Streaming Not Working
**What goes wrong:** User's follow-up message lost while AI is responding
**Why it happens:** Sending new message while streaming without proper handling
**How to avoid:** Queue messages client-side; send after current stream completes or stops
**Warning signs:** Messages disappear, user has to re-type

### Pitfall 6: WebSocket Reconnect Thundering Herd
**What goes wrong:** All clients reconnect simultaneously after server restart
**Why it happens:** Using fixed retry intervals without jitter
**How to avoid:** Exponential backoff with random jitter (Math.random() * delay)
**Warning signs:** Server overwhelmed after restarts, cascading failures

### Pitfall 7: OpenCode Server Not Running
**What goes wrong:** SDK calls fail with connection errors
**Why it happens:** Forgot to start OpenCode server or auto-start disabled
**How to avoid:** Use `createOpencode()` which auto-starts server, or ensure `opencode serve` running
**Warning signs:** ECONNREFUSED errors

## Code Examples

Verified patterns from official sources:

### OpenCode SDK Client Initialization
```typescript
// Source: OpenCode SDK docs (https://opencode.ai/docs/sdk/)
// apps/api/src/lib/opencode.ts
import { createOpencode, createOpencodeClient } from '@opencode-ai/sdk';

// Option 1: Managed - auto-starts server
export async function getOpenCodeClient() {
  return createOpencode({
    hostname: '127.0.0.1',
    port: 4096,
    config: {
      provider: 'anthropic',
      model: 'claude-sonnet-4-20250514',
    }
  });
}

// Option 2: Client-only - connects to existing server
export async function connectToOpenCode() {
  return createOpencodeClient({
    hostname: '127.0.0.1',
    port: 4096,
  });
}
```

### Session Chat Flow with OpenCode
```typescript
// apps/api/src/routes/chat.ts
import { Hono } from 'hono';
import { getOpenCodeClient } from '../lib/opencode';

const app = new Hono<{ Bindings: Env }>();

app.post('/sessions/:id/chat', async (c) => {
  const sessionId = c.req.param('id');
  const { content } = await c.req.json();

  // Get DO stub to persist message and get OpenCode session ID
  const doId = c.env.SESSION_DO.idFromName(sessionId);
  const stub = c.env.SESSION_DO.get(doId);

  const sessionMeta = await stub.getSessionMeta();
  const opencodeSessionId = sessionMeta.opencodeSessionId;

  // Send to OpenCode
  const opencode = await getOpenCodeClient();

  // Create streaming response
  const stream = new ReadableStream({
    async start(controller) {
      // Subscribe to events
      const events = opencode.event.subscribe();

      // Send prompt
      await opencode.session.prompt(opencodeSessionId, { content });

      // Stream events to client
      for await (const event of events) {
        controller.enqueue(
          new TextEncoder().encode(`data: ${JSON.stringify(event)}\n\n`)
        );

        // Also send to DO for persistence and WebSocket broadcast
        await stub.handleOpenCodeEvent(event);

        if (event.type === 'session.idle') {
          break;
        }
      }

      controller.close();
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
    }
  });
});

export default app;
```

### Durable Object with SQLite and WebSocket
```typescript
// Source: Cloudflare Durable Objects docs
import { DurableObject } from 'cloudflare:workers';

interface Env {
  SESSION_DO: DurableObjectNamespace<SessionDO>;
}

export class SessionDO extends DurableObject {
  private sql: SqlStorage;
  private connections: Map<WebSocket, { userId: string }> = new Map();

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;

    ctx.blockConcurrencyWhile(async () => {
      this.initSchema();
      this.ctx.getWebSockets().forEach((ws) => {
        const attachment = ws.deserializeAttachment();
        if (attachment) this.connections.set(ws, attachment);
      });
    });
  }

  private initSchema() {
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
    `);
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname.endsWith('/websocket')) {
      return this.handleWebSocket(request);
    }

    return new Response('Not found', { status: 404 });
  }

  private handleWebSocket(request: Request): Response {
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ userId: 'user-id-from-auth', joinedAt: Date.now() });
    this.connections.set(server, { userId: 'user-id-from-auth' });

    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, message: string) {
    const data = JSON.parse(message);
    // Handle client messages (e.g., permission responses)
    if (data.type === 'permission.response') {
      // Forward to OpenCode via RPC to main worker
    }
  }

  async webSocketClose(ws: WebSocket, code: number, reason: string) {
    this.connections.delete(ws);
    ws.close(code, reason);
  }

  // Called by Worker when OpenCode emits events
  async handleOpenCodeEvent(event: unknown) {
    // Persist relevant parts
    if (event.type === 'part' && event.part?.type === 'text') {
      // Accumulate text parts into assistant message
    }

    // Broadcast to all connected clients
    this.broadcast(event);
  }

  private broadcast(message: object) {
    const json = JSON.stringify(message);
    this.connections.forEach((_, ws) => {
      try { ws.send(json); } catch {}
    });
  }

  async getSessionMeta() {
    const rows = this.sql.exec('SELECT key, value FROM session_meta').toArray();
    return Object.fromEntries(rows.map(r => [r.key, r.value]));
  }
}
```

### Client-Side Chat Interface
```typescript
// apps/web/components/chat/chat-interface.tsx
'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { MessageList } from './message-list';
import { ChatInput } from './chat-input';
import { createReconnectingWebSocket } from '@/lib/websocket';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  parts?: Part[];
}

interface Part {
  type: 'text' | 'tool-call' | 'tool-result';
  content?: string;
  toolName?: string;
  state?: 'pending' | 'running' | 'complete' | 'error';
}

export function ChatInterface({ sessionId }: { sessionId: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [messageQueue, setMessageQueue] = useState<string[]>([]);
  const wsRef = useRef<ReturnType<typeof createReconnectingWebSocket>>();

  // Connect WebSocket for real-time updates
  useEffect(() => {
    wsRef.current = createReconnectingWebSocket({
      url: `${process.env.NEXT_PUBLIC_API_URL}/sessions/${sessionId}/websocket`,
      onMessage: (data) => {
        // Handle OpenCode events broadcast from DO
        if (data.type === 'part') {
          updateStreamingMessage(data.part);
        }
        if (data.type === 'session.idle') {
          setIsStreaming(false);
          finalizeStreamingMessage();
        }
      },
      onStatusChange: (status) => {
        console.log('WebSocket status:', status);
      }
    });

    return () => wsRef.current?.disconnect();
  }, [sessionId]);

  // Process queued messages when streaming completes
  useEffect(() => {
    if (!isStreaming && messageQueue.length > 0) {
      const nextMessage = messageQueue[0];
      setMessageQueue((q) => q.slice(1));
      sendMessage(nextMessage);
    }
  }, [isStreaming, messageQueue]);

  const sendMessage = async (content: string) => {
    setIsStreaming(true);

    // Add user message optimistically
    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content,
    };
    setMessages((prev) => [...prev, userMessage]);

    // Start streaming assistant message
    const assistantMessage: Message = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: '',
      parts: [],
    };
    setMessages((prev) => [...prev, assistantMessage]);

    // Send to API (SSE response)
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/sessions/${sessionId}/chat`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      }
    );

    // Note: Real-time updates come via WebSocket, not this response
    // SSE here is for graceful degradation if WebSocket disconnects
  };

  const handleSend = useCallback((content: string) => {
    if (isStreaming) {
      setMessageQueue((q) => [...q, content]);
    } else {
      sendMessage(content);
    }
  }, [isStreaming]);

  const handleStop = useCallback(async () => {
    // Send stop command to API
    await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/sessions/${sessionId}/stop`,
      { method: 'POST' }
    );
    setIsStreaming(false);
  }, [sessionId]);

  return (
    <div className="flex flex-col h-full">
      <MessageList messages={messages} />
      <ChatInput
        onSend={handleSend}
        onStop={handleStop}
        isStreaming={isStreaming}
        queueCount={messageQueue.length}
      />
    </div>
  );
}
```

### WebSocket Client with Exponential Backoff
```typescript
// Source: WebSocket reconnection best practices
// apps/web/lib/websocket.ts
interface WebSocketOptions {
  url: string;
  onMessage: (data: unknown) => void;
  onStatusChange: (status: 'connecting' | 'connected' | 'disconnected') => void;
}

export function createReconnectingWebSocket(options: WebSocketOptions) {
  let ws: WebSocket | null = null;
  let reconnectAttempts = 0;
  const maxAttempts = 10;
  const baseDelay = 1000;
  const maxDelay = 30000;

  function connect() {
    options.onStatusChange('connecting');
    ws = new WebSocket(options.url);

    ws.onopen = () => {
      reconnectAttempts = 0;
      options.onStatusChange('connected');
    };

    ws.onmessage = (event) => {
      options.onMessage(JSON.parse(event.data));
    };

    ws.onclose = () => {
      options.onStatusChange('disconnected');
      scheduleReconnect();
    };

    ws.onerror = () => {
      ws?.close();
    };
  }

  function scheduleReconnect() {
    if (reconnectAttempts >= maxAttempts) return;

    // Exponential backoff with jitter
    const delay = Math.min(
      baseDelay * Math.pow(2, reconnectAttempts),
      maxDelay
    );
    const jitter = delay * 0.5 * Math.random();

    setTimeout(() => {
      reconnectAttempts++;
      connect();
    }, delay + jitter);
  }

  function disconnect() {
    reconnectAttempts = maxAttempts; // Prevent reconnection
    ws?.close();
  }

  connect();
  return { disconnect };
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Custom LLM integration | OpenCode SDK | 2025 | Full agent runtime with Build/Plan modes |
| AI SDK custom tools | OpenCode built-in tools | 2025 | File ops, shell, code editing battle-tested |
| KV storage in DOs | SQLite storage backend | 2024 GA | Relational queries, better performance, 30-day PITR |
| Standard WebSocket API | WebSocket Hibernation API | 2023 | 10-100x cost reduction for idle connections |
| D1 for session data | SQLite in Durable Objects | 2024 | Zero-latency colocated storage |

**Deprecated/outdated:**
- AI SDK for agent apps: OpenCode SDK provides complete runtime
- `ws.accept()` in DOs: Prevents hibernation, use `ctx.acceptWebSocket()` instead
- KV storage backend for new DOs: SQLite is now recommended for all new namespaces
- Direct Anthropic API calls: Use OpenCode for agent features (Build/Plan modes, tool execution)

## Open Questions

Things that couldn't be fully resolved:

1. **Exact message pagination threshold**
   - What we know: Context says ~20-30 messages shown by default
   - What's unclear: Performance impact of different thresholds with tool-heavy messages
   - Recommendation: Start with 25, measure performance, adjust based on average parts per message

2. **Auto-archive timing**
   - What we know: Should archive after inactivity, user can delete from archive
   - What's unclear: Optimal inactivity threshold (7 days? 30 days?)
   - Recommendation: Use DO alarm to check daily; archive after 14 days of no activity

3. **Session list live status feasibility**
   - What we know: Current session gets full real-time; list shows "live if feasible"
   - What's unclear: Cost/complexity of WebSocket per session in list view
   - Recommendation: Poll session list every 30s; no per-session WebSocket on list view

4. **Build vs Plan mode persistence**
   - What we know: User can switch modes at any time
   - What's unclear: Whether mode is per-session or per-message
   - Recommendation: Store mode in session metadata; persist across messages

5. **OpenCode server deployment**
   - What we know: SDK needs OpenCode server running
   - What's unclear: Best deployment pattern for production (sidecar? separate service?)
   - Recommendation: Start with auto-start in development; plan separate service for production

## Sources

### Primary (HIGH confidence)
- [OpenCode SDK Documentation](https://opencode.ai/docs/sdk/) - SDK API, session management, events
- [Cloudflare Durable Objects WebSocket Hibernation](https://developers.cloudflare.com/durable-objects/examples/websocket-hibernation-server/) - Full hibernation pattern
- [Cloudflare Durable Objects SQLite Storage API](https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/) - sql.exec, schema, transactions
- [Cloudflare Rules of Durable Objects](https://developers.cloudflare.com/durable-objects/best-practices/rules-of-durable-objects/) - Design patterns, anti-patterns
- [Hono Durable Objects Example](https://hono.dev/examples/cloudflare-durable-objects) - Integration pattern

### Secondary (MEDIUM confidence)
- [OpenCode SDK AI Provider](https://ai-sdk.dev/providers/community-providers/opencode-sdk) - Confirms tool limitations, validates direct SDK approach
- [opencode-vibe GitHub](https://github.com/joelhooks/opencode-vibe) - Next.js + OpenCode reference implementation
- [WebSocket Reconnection Strategies](https://dev.to/hexshift/robust-websocket-reconnection-strategies-in-javascript-with-exponential-backoff-40n1) - Backoff with jitter

### Tertiary (LOW confidence)
- Community patterns for message queuing during streaming (implemented based on observed patterns)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - OpenCode SDK official docs, Cloudflare official docs
- Architecture: HIGH - Cloudflare patterns, OpenCode patterns documented
- Pitfalls: HIGH - Documented in official best practices guides
- Message queuing: MEDIUM - Based on common patterns, no official guide

**Research date:** 2026-02-01
**Valid until:** 2026-03-01 (30 days - stable technologies)
