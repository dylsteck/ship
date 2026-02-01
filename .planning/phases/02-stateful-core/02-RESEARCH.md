# Phase 2: Stateful Core - Research

**Researched:** 2026-02-01
**Domain:** Cloudflare Durable Objects, WebSocket real-time, AI SDK streaming
**Confidence:** HIGH

## Summary

This phase implements stateful sessions using Cloudflare Durable Objects with WebSocket hibernation for real-time updates and AI SDK for token-by-token streaming chat. The architecture follows Cloudflare's recommended pattern of one Durable Object per session (not a global singleton), with SQLite storage for persistence and the WebSocket Hibernation API for cost-efficient real-time connections.

The standard stack combines Hono (already in use) for routing WebSocket upgrades to Durable Objects, AI SDK (@ai-sdk/anthropic) for streaming Claude responses with tool calls, and the useChat hook for client-side chat management. Key decisions from context (Build/Plan modes, collapsible tool blocks, message queuing) map directly to AI SDK's tool streaming and useChat's status-based rendering.

**Primary recommendation:** Use Durable Objects with SQLite storage and WebSocket Hibernation API for sessions; AI SDK useChat hook for streaming chat with tool calls displayed inline.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Cloudflare Durable Objects | SQLite backend | Per-session state and coordination | Official CF recommended for stateful apps |
| @ai-sdk/anthropic | ^3.0.13 | Claude provider for AI SDK | Official Vercel provider, tool streaming enabled by default |
| ai (AI SDK) | ^6.x | streamText, useChat hooks | 20M+ monthly downloads, unified API across providers |
| hono | ^4.6.18 | Route WebSocket upgrades to DOs | Already in stack, excellent CF Workers integration |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| zod | ^3.22+ | Tool input schema validation | Define tool parameters for AI SDK |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| AI SDK useChat | Custom WebSocket | useChat handles streaming, tool calls, status; custom requires significant hand-rolling |
| Durable Objects SQLite | D1 external | SQLite in DO provides zero-latency colocated storage; D1 adds network hop |
| WebSocket Hibernation | Standard WebSocket | Hibernation reduces GB-second costs 10-100x for idle connections |

**Installation:**
```bash
# In apps/api
pnpm add ai @ai-sdk/anthropic zod

# In apps/web
pnpm add ai @ai-sdk/anthropic
```

## Architecture Patterns

### Recommended Project Structure
```
apps/api/src/
├── index.ts              # Hono router, WebSocket upgrade to DO
├── durable-objects/
│   └── session.ts        # SessionDO class with SQLite + WebSocket
├── routes/
│   ├── sessions.ts       # CRUD endpoints for sessions
│   └── chat.ts           # Chat streaming endpoint (AI SDK streamText)
└── env.d.ts              # Updated with DO bindings

apps/web/
├── app/(app)/session/[id]/
│   └── page.tsx          # Session page with chat UI
├── components/
│   ├── chat/
│   │   ├── chat-interface.tsx  # useChat hook integration
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

### Pattern 3: AI SDK streamText with Tool Calls
**What:** Use streamText with tools for agent functionality, stream responses token-by-token
**When to use:** For all chat message processing
**Example:**
```typescript
// Source: AI SDK docs - streamText with tools
import { anthropic } from '@ai-sdk/anthropic';
import { streamText, tool } from 'ai';
import { z } from 'zod';

const result = streamText({
  model: anthropic('claude-sonnet-4-20250514'),
  messages: conversationHistory,
  abortSignal: req.signal, // Enable stop button
  tools: {
    createTask: tool({
      description: 'Create a new task for the agent to execute',
      inputSchema: z.object({
        title: z.string(),
        description: z.string(),
      }),
      execute: async ({ title, description }) => {
        // Persist task to DO storage
        return { taskId: crypto.randomUUID(), status: 'created' };
      },
    }),
  },
  maxSteps: 5, // Allow multi-step tool use
});

return result.toDataStreamResponse();
```

### Pattern 4: useChat with Tool Part Rendering
**What:** Use useChat hook with message.parts for inline tool display
**When to use:** Client-side chat interface
**Example:**
```typescript
// Source: AI SDK useChat docs
'use client';
import { useChat } from 'ai/react';

export function ChatInterface({ sessionId }: { sessionId: string }) {
  const { messages, sendMessage, stop, status } = useChat({
    api: `/api/sessions/${sessionId}/chat`,
  });

  return (
    <div>
      {messages.map((message) => (
        <div key={message.id}>
          {message.parts.map((part, i) => {
            if (part.type === 'text') {
              return <p key={i}>{part.text}</p>;
            }
            if (part.type === 'tool-invocation') {
              return (
                <ToolBlock
                  key={i}
                  tool={part.toolName}
                  input={part.args}
                  state={part.state}
                  result={part.result}
                />
              );
            }
          })}
        </div>
      ))}
      {status === 'streaming' && <button onClick={stop}>Stop</button>}
    </div>
  );
}
```

### Pattern 5: SQLite Schema for Session State
**What:** Define SQLite tables in DO for messages, tasks, and metadata
**When to use:** All session data persistence
**Example:**
```typescript
// Source: Cloudflare Durable Objects SQLite docs
export class SessionDO extends DurableObject {
  private sql: SqlStorage;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;

    ctx.blockConcurrencyWhile(async () => {
      this.sql.exec(`
        CREATE TABLE IF NOT EXISTS messages (
          id TEXT PRIMARY KEY,
          role TEXT NOT NULL,
          content TEXT NOT NULL,
          parts TEXT, -- JSON for tool parts
          created_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS tasks (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          description TEXT,
          status TEXT DEFAULT 'pending',
          created_at INTEGER NOT NULL,
          completed_at INTEGER
        );

        CREATE INDEX IF NOT EXISTS idx_messages_created
          ON messages(created_at);
        CREATE INDEX IF NOT EXISTS idx_tasks_status
          ON tasks(status, created_at);
      `);
    });
  }
}
```

### Anti-Patterns to Avoid
- **Global singleton DO:** Never route all sessions through one DO instance - creates bottleneck
- **In-memory only state:** Always persist to SQLite; in-memory lost on hibernation/eviction
- **server.accept() instead of ctx.acceptWebSocket():** Prevents hibernation, increases costs
- **Unawaited RPC calls:** Creates dangling promises, swallows errors
- **blockConcurrencyWhile for normal requests:** Reserve for init/migrations only; limits throughput

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Token streaming | Custom SSE parsing | AI SDK streamText + useChat | Handles backpressure, tool calls, parts rendering |
| WebSocket reconnection | Simple retry loop | Exponential backoff with jitter | Prevents thundering herd, handles network edge cases |
| Tool call UI state | Custom state machine | message.parts with part.state | AI SDK tracks input-streaming/available/output states |
| Chat message history | Array in memory | SQLite in Durable Object | Survives hibernation, supports pagination |
| Stream cancellation | Manual AbortController | useChat stop() + streamText abortSignal | Properly cleans up both client and server |
| Session coordination | Polling | WebSocket Hibernation API | Real-time with minimal cost during idle |

**Key insight:** AI SDK and Durable Objects provide battle-tested primitives for exactly this use case. Hand-rolling streaming, reconnection, or state management leads to subtle bugs around backpressure, race conditions, and edge cases.

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

### Pitfall 3: Input Gates Confusion with External I/O
**What goes wrong:** Race conditions when calling external services
**Why it happens:** Input gates reopen during await fetch(); requests interleave
**How to avoid:** Use optimistic locking for external operations
**Warning signs:** Inconsistent state after parallel requests

### Pitfall 4: Tool Streaming State Mismatch
**What goes wrong:** Tool UI shows wrong state (loading when complete)
**Why it happens:** Not checking part.state properly in render
**How to avoid:** Always render based on part.state: 'input-streaming' | 'input-available' | 'output-available' | 'output-error'
**Warning signs:** UI stuck in loading, tool results not appearing

### Pitfall 5: Message Queue During Streaming Not Working
**What goes wrong:** User's follow-up message lost while AI is responding
**Why it happens:** Sending new message while status === 'streaming' without proper handling
**How to avoid:** Queue messages client-side; send after current stream completes or stops
**Warning signs:** Messages disappear, user has to re-type

### Pitfall 6: WebSocket Reconnect Thundering Herd
**What goes wrong:** All clients reconnect simultaneously after server restart
**Why it happens:** Using fixed retry intervals without jitter
**How to avoid:** Exponential backoff with random jitter (Math.random() * delay)
**Warning signs:** Server overwhelmed after restarts, cascading failures

### Pitfall 7: AI SDK RSC Incompatibility
**What goes wrong:** Trying to use streamUI with stop() functionality
**Why it happens:** AI SDK RSC (React Server Components) doesn't support stopping streams
**How to avoid:** Use AI SDK UI (useChat) for this app, not RSC streaming
**Warning signs:** stop() has no effect, AbortError not propagating

## Code Examples

Verified patterns from official sources:

### Durable Object with SQLite and WebSocket Hibernation
```typescript
// Source: Cloudflare Durable Objects docs
import { DurableObject } from 'cloudflare:workers';

interface Env {
  SESSION_DO: DurableObjectNamespace<SessionDO>;
  ANTHROPIC_API_KEY: string;
}

export class SessionDO extends DurableObject {
  private sql: SqlStorage;
  private connections: Map<WebSocket, { userId: string }> = new Map();

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;

    // Initialize schema and restore connections on wake
    ctx.blockConcurrencyWhile(async () => {
      this.initSchema();
      // Restore connection state from hibernation
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
      CREATE TABLE IF NOT EXISTS session_meta (
        key TEXT PRIMARY KEY,
        value TEXT
      );
    `);
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname.endsWith('/websocket')) {
      return this.handleWebSocket(request);
    }

    // Handle other RPC-style calls
    return new Response('Not found', { status: 404 });
  }

  private handleWebSocket(request: Request): Response {
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ userId: 'user-id-from-auth' });
    this.connections.set(server, { userId: 'user-id-from-auth' });

    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, message: string) {
    const data = JSON.parse(message);
    // Handle incoming messages, broadcast updates
    this.broadcast({ type: 'update', data });
  }

  async webSocketClose(ws: WebSocket, code: number, reason: string) {
    this.connections.delete(ws);
    ws.close(code, reason); // CRITICAL
  }

  private broadcast(message: object) {
    const json = JSON.stringify(message);
    this.connections.forEach((_, ws) => {
      try { ws.send(json); } catch {}
    });
  }
}
```

### Chat API Route with AI SDK streamText
```typescript
// Source: AI SDK Anthropic provider docs
// apps/api/src/routes/chat.ts
import { Hono } from 'hono';
import { anthropic } from '@ai-sdk/anthropic';
import { streamText, tool } from 'ai';
import { z } from 'zod';

const app = new Hono<{ Bindings: Env }>();

app.post('/sessions/:id/chat', async (c) => {
  const sessionId = c.req.param('id');
  const { messages } = await c.req.json();

  const result = streamText({
    model: anthropic('claude-sonnet-4-20250514'),
    messages,
    abortSignal: c.req.raw.signal,
    tools: {
      createTask: tool({
        description: 'Create a task for the agent to execute later',
        inputSchema: z.object({
          title: z.string().describe('Task title'),
          description: z.string().describe('What needs to be done'),
          mode: z.enum(['build', 'plan']).describe('Execution mode'),
        }),
        execute: async ({ title, description, mode }) => {
          // Get DO stub and persist task
          const id = c.env.SESSION_DO.idFromName(sessionId);
          const stub = c.env.SESSION_DO.get(id);
          return await stub.createTask({ title, description, mode });
        },
      }),
    },
    maxSteps: 10,
    onFinish: async ({ text, finishReason, steps }) => {
      // Persist assistant message to DO
      const id = c.env.SESSION_DO.idFromName(sessionId);
      const stub = c.env.SESSION_DO.get(id);
      await stub.saveMessage({
        role: 'assistant',
        content: text,
        steps: JSON.stringify(steps),
      });
    },
  });

  return result.toDataStreamResponse();
});

export default app;
```

### Client-Side Chat with useChat
```typescript
// Source: AI SDK useChat docs
// apps/web/components/chat/chat-interface.tsx
'use client';

import { useChat } from 'ai/react';
import { useEffect, useRef, useState } from 'react';
import { MessageList } from './message-list';
import { ChatInput } from './chat-input';

interface ChatInterfaceProps {
  sessionId: string;
  initialMessages?: Message[];
}

export function ChatInterface({ sessionId, initialMessages }: ChatInterfaceProps) {
  const [messageQueue, setMessageQueue] = useState<string[]>([]);

  const {
    messages,
    sendMessage,
    stop,
    status,
    setMessages,
  } = useChat({
    api: `${process.env.NEXT_PUBLIC_API_URL}/sessions/${sessionId}/chat`,
    initialMessages,
  });

  // Process queued messages when streaming completes
  useEffect(() => {
    if (status === 'ready' && messageQueue.length > 0) {
      const nextMessage = messageQueue[0];
      setMessageQueue((q) => q.slice(1));
      sendMessage({ content: nextMessage });
    }
  }, [status, messageQueue, sendMessage]);

  const handleSend = (content: string) => {
    if (status === 'streaming') {
      // Queue message for later
      setMessageQueue((q) => [...q, content]);
    } else {
      sendMessage({ content });
    }
  };

  return (
    <div className="flex flex-col h-full">
      <MessageList messages={messages} />
      <ChatInput
        onSend={handleSend}
        onStop={stop}
        isStreaming={status === 'streaming'}
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
| AI SDK RSC streamUI | AI SDK UI useChat | AI SDK 5.0 (2025) | RSC streaming paused; useChat is recommended |
| KV storage in DOs | SQLite storage backend | 2024 GA | Relational queries, better performance, 30-day PITR |
| Standard WebSocket API | WebSocket Hibernation API | 2023 | 10-100x cost reduction for idle connections |
| AnthropicStream helper | @ai-sdk/anthropic provider | AI SDK 3.1 | Unified API, tool streaming, proper types |
| D1 for session data | SQLite in Durable Objects | 2024 | Zero-latency colocated storage |

**Deprecated/outdated:**
- AnthropicStream: Legacy helper, incompatible with AI SDK 3.1+ functions
- AI SDK RSC for interactive chat: Development paused, use AI SDK UI instead
- `ws.accept()` in DOs: Prevents hibernation, use `ctx.acceptWebSocket()` instead
- KV storage backend for new DOs: SQLite is now recommended for all new namespaces

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

## Sources

### Primary (HIGH confidence)
- [Cloudflare Durable Objects WebSocket Hibernation](https://developers.cloudflare.com/durable-objects/examples/websocket-hibernation-server/) - Full hibernation pattern
- [Cloudflare Durable Objects SQLite Storage API](https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/) - sql.exec, schema, transactions
- [Cloudflare Rules of Durable Objects](https://developers.cloudflare.com/durable-objects/best-practices/rules-of-durable-objects/) - Design patterns, anti-patterns
- [AI SDK useChat Reference](https://ai-sdk.dev/docs/reference/ai-sdk-ui/use-chat) - Hook API, tool handling
- [AI SDK Anthropic Provider](https://ai-sdk.dev/providers/ai-sdk-providers/anthropic) - @ai-sdk/anthropic setup
- [AI SDK Chatbot Tool Usage](https://ai-sdk.dev/docs/ai-sdk-ui/chatbot-tool-usage) - Tool call streaming, part states
- [AI SDK Stopping Streams](https://ai-sdk.dev/docs/advanced/stopping-streams) - abortSignal, stop() patterns
- [Hono Durable Objects Example](https://hono.dev/examples/cloudflare-durable-objects) - Integration pattern

### Secondary (MEDIUM confidence)
- [DZone: Build Real-Time Apps With Cloudflare, Hono, Durable Objects](https://dzone.com/articles/serverless-websocket-real-time-apps) - Architecture patterns
- [WebSocket Reconnection Strategies](https://dev.to/hexshift/robust-websocket-reconnection-strategies-in-javascript-with-exponential-backoff-40n1) - Backoff with jitter

### Tertiary (LOW confidence)
- Community patterns for message queuing during streaming (no authoritative source found; implemented based on useChat status API)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All recommendations from official docs
- Architecture: HIGH - Cloudflare and AI SDK official patterns
- Pitfalls: HIGH - Documented in official best practices guides
- Message queuing: MEDIUM - Based on useChat API but no official guide

**Research date:** 2026-02-01
**Valid until:** 2026-03-01 (30 days - stable technologies)
