# Architecture Research

**Domain:** Background Agent Platform
**Researched:** 2026-02-01
**Confidence:** HIGH

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Frontend Layer (Next.js)                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐               │
│  │ Task Creator │  │ Session View │  │ File Browser │               │
│  │   & Config   │  │  & Messages  │  │  & Terminal  │               │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘               │
│         │                  │                  │                       │
│         └──────────────────┼──────────────────┘                       │
│                           │                                          │
├───────────────────────────┼──────────────────────────────────────────┤
│                    API Layer (CF Workers)                            │
│                           │                                          │
│  ┌────────────────────────┴────────────────────────┐                 │
│  │         Worker Router & Request Handler         │                 │
│  └───┬─────────────────────────────────────────┬───┘                 │
│      │                                         │                     │
│  ┌───▼─────────────────┐      ┌────────────────▼─────┐               │
│  │  SessionAgent DO    │◄────►│    EventBus DO       │               │
│  │  (per-session state)│      │  (real-time events)  │               │
│  └───┬─────────────────┘      └──────────────────────┘               │
│      │                                                                │
├──────┼────────────────────────────────────────────────────────────────┤
│      │               Storage Layer (CF Platform)                      │
│  ┌───▼─────────┐  ┌──────────┐  ┌──────────┐                         │
│  │   D1 SQL    │  │  R2 Blob │  │ DO SQLite│                         │
│  │ (metadata)  │  │  (files) │  │ (session)│                         │
│  └─────────────┘  └──────────┘  └──────────┘                         │
├─────────────────────────────────────────────────────────────────────┤
│                    Execution Layer (E2B)                             │
│  ┌──────────────────────────────────────────────────────────┐        │
│  │              E2B Sandbox (per-session microVM)            │        │
│  │  ┌────────────┐  ┌──────────────┐  ┌─────────────┐       │        │
│  │  │  OpenCode  │  │ code-server  │  │   Browser   │       │        │
│  │  │   Agent    │  │   (WebIDE)   │  │  (headless) │       │        │
│  │  └─────┬──────┘  └──────┬───────┘  └──────┬──────┘       │        │
│  │        │                │                  │              │        │
│  │  ┌─────▼────────────────▼──────────────────▼─────┐        │        │
│  │  │            Sandbox Filesystem                 │        │        │
│  │  │  (repo clone, generated files, outputs)       │        │        │
│  │  └───────────────────────────────────────────────┘        │        │
│  └──────────────────────────────────────────────────────────┘        │
├─────────────────────────────────────────────────────────────────────┤
│                Integration Layer (External Services)                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐             │
│  │  GitHub  │  │  Linear   │  │  Vercel  │  │ AI APIs  │             │
│  │  (OAuth) │  │  (Tasks)  │  │  (Deploy)│  │ (Models) │             │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘             │
└─────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| **Next.js Frontend** | User interface, authentication, real-time updates via WebSocket | App Router + React Server Components + shadcn/ui |
| **Worker Router** | Request routing, authentication validation, DO stub creation | Cloudflare Worker with typed RPC |
| **SessionAgent DO** | Per-session state management, message history, task orchestration | Durable Object with SQLite storage + RPC methods |
| **EventBus DO** | Real-time broadcasting of events to connected clients | Durable Object with Hibernatable WebSockets |
| **D1 Database** | User profiles, repository metadata, task configurations | SQLite-based serverless SQL database |
| **R2 Storage** | Large files (screenshots, artifacts, repo archives) | S3-compatible object storage |
| **E2B Sandbox** | Isolated code execution environment per session | Firecracker microVM with ~150ms cold start |
| **OpenCode Agent** | AI-powered coding assistant with tool access | OpenCode SDK running inside sandbox |

## Recommended Project Structure

```
ship/
├── apps/
│   ├── web/                      # Next.js frontend
│   │   ├── app/
│   │   │   ├── api/              # Next.js API routes (auth, proxies)
│   │   │   ├── tasks/            # Task management UI
│   │   │   └── sessions/         # Session viewer UI
│   │   ├── components/           # React components
│   │   └── lib/                  # Client utilities
│   │
│   └── worker/                   # Cloudflare Worker
│       ├── src/
│       │   ├── index.ts          # Worker entry point
│       │   ├── durable-objects/
│       │   │   ├── SessionAgent.ts    # Per-session DO
│       │   │   └── EventBus.ts        # Real-time event DO
│       │   ├── handlers/
│       │   │   ├── session.ts         # Session management
│       │   │   ├── events.ts          # Event streaming
│       │   │   └── sandbox.ts         # Sandbox lifecycle
│       │   ├── storage/
│       │   │   ├── d1.ts              # D1 queries
│       │   │   └── r2.ts              # R2 operations
│       │   └── integrations/
│       │       ├── github.ts          # GitHub API
│       │       ├── e2b.ts             # E2B sandbox control
│       │       └── linear.ts          # Linear API
│       └── wrangler.toml         # CF Worker config
│
├── packages/
│   ├── database/                 # Shared DB schema
│   │   ├── schema.ts             # D1 schema definitions
│   │   └── migrations/           # SQL migrations
│   │
│   ├── sandbox-runtime/          # E2B sandbox code
│   │   ├── agent/
│   │   │   ├── opencode-config.json   # OpenCode configuration
│   │   │   └── tools/                 # Custom tools for agent
│   │   ├── setup.sh              # Sandbox initialization script
│   │   └── monitor.ts            # Progress/event reporter
│   │
│   └── shared/                   # Shared types & utils
│       ├── types/                # TypeScript types
│       └── utils/                # Shared utilities
│
└── infrastructure/
    ├── d1/                       # D1 database setup
    └── r2/                       # R2 bucket config
```

### Structure Rationale

- **Monorepo with Turborepo**: Separate concerns (web, worker, sandbox) while sharing types and utilities
- **Worker as API**: All stateful operations go through Workers → DOs, frontend is purely presentational
- **DO per logical unit**: SessionAgent DO per active session (not per user or global), EventBus DO per session for real-time
- **Sandbox runtime package**: Deployed to E2B as custom template, ensures consistent environment
- **Shared packages**: Database schema, types, and utilities shared across web and worker prevent drift

## Architectural Patterns

### Pattern 1: Control & Data Plane Separation (Durable Objects)

**What:** Separate administrative operations (control plane) from high-throughput operations (data plane) using multiple Durable Object types.

**When to use:** When building multi-tenant systems where session lifecycle management is separate from real-time message flow.

**Trade-offs:**
- **Pro**: Eliminates bottlenecks by distributing load across thousands of DO instances
- **Pro**: Enables geographic optimization (place data plane near users)
- **Con**: Adds complexity in coordination between planes
- **Con**: Requires careful ID management (deterministic routing)

**Example:**
```typescript
// Control plane: SessionManager DO (one per user or tenant)
export class SessionManager {
  async createSession(userId: string, repoId: string) {
    // Generate session ID and initialize metadata
    const sessionId = nanoid()

    // Create data plane DO for this session
    const sessionStub = env.SESSION_AGENT.get(
      env.SESSION_AGENT.idFromName(sessionId)
    )

    // Initialize with metadata
    await sessionStub.initialize({ userId, repoId, createdAt: Date.now() })

    // Store reference in D1
    await env.DB.prepare(
      'INSERT INTO sessions (id, user_id, repo_id) VALUES (?, ?, ?)'
    ).bind(sessionId, userId, repoId).run()

    return { sessionId }
  }
}

// Data plane: SessionAgent DO (one per active session)
export class SessionAgent {
  private state: DurableObjectState
  private env: Env
  private messages: Message[] = []

  async initialize(metadata: SessionMetadata) {
    await this.state.storage.put('metadata', metadata)

    // Spin up E2B sandbox
    const sandbox = await this.env.E2B.create({
      template: 'opencode-agent',
      timeoutMs: 3600000 // 1 hour
    })

    await this.state.storage.put('sandboxId', sandbox.id)
  }

  async handleMessage(message: Message) {
    // Process message, update state, forward to sandbox
    this.messages.push(message)
    await this.state.storage.put('messages', this.messages)

    // Broadcast to EventBus for real-time updates
    const eventBusStub = this.env.EVENT_BUS.get(
      this.env.EVENT_BUS.idFromName(this.sessionId)
    )
    await eventBusStub.broadcast({ type: 'message', data: message })

    return { success: true }
  }
}
```

### Pattern 2: Hibernatable WebSockets for Real-Time

**What:** Use EventBus Durable Objects with Hibernatable WebSocket API for cost-effective real-time communication.

**When to use:** Broadcasting updates to connected clients (session progress, agent messages, terminal output).

**Trade-offs:**
- **Pro**: Massive cost savings (no billing during idle periods)
- **Pro**: Maintains connections during hibernation
- **Pro**: Scales to thousands of concurrent connections per DO
- **Con**: Cold start on wake (~10ms) may add slight latency
- **Con**: 2KB limit on connection attachments

**Example:**
```typescript
export class EventBus {
  private state: DurableObjectState

  async fetch(request: Request) {
    // WebSocket upgrade
    if (request.headers.get('Upgrade') === 'websocket') {
      const pair = new WebSocketPair()
      const [client, server] = Object.values(pair)

      // IMPORTANT: Use state.acceptWebSocket for hibernation
      this.state.acceptWebSocket(server, ['events'])

      return new Response(null, { status: 101, webSocket: client })
    }
  }

  // Hibernation event handlers
  async webSocketMessage(ws: WebSocket, message: string) {
    // Handle incoming messages (ping, subscribe, etc)
    const data = JSON.parse(message)

    if (data.type === 'subscribe') {
      // Store subscription in attachment (under 2KB)
      ws.serializeAttachment({ ...ws.deserializeAttachment(), filters: data.filters })
    }
  }

  async webSocketClose(ws: WebSocket, code: number, reason: string) {
    // Cleanup on disconnect
    ws.close(code, reason)
  }

  // RPC method called by SessionAgent DO
  async broadcast(event: Event) {
    const sockets = this.state.getWebSockets('events')

    for (const socket of sockets) {
      const attachment = socket.deserializeAttachment()

      // Filter based on subscription
      if (this.shouldSend(event, attachment.filters)) {
        socket.send(JSON.stringify(event))
      }
    }
  }
}
```

### Pattern 3: Per-Session E2B Sandbox Lifecycle

**What:** Create one E2B sandbox per SessionAgent DO, managed through the DO lifecycle.

**When to use:** Isolating execution environments per user session, ensuring security and preventing cross-contamination.

**Trade-offs:**
- **Pro**: Perfect security isolation (one sandbox = one session)
- **Pro**: Clean state (no leftover files from previous sessions)
- **Pro**: Fast startup (~150ms) enables on-demand creation
- **Con**: Monthly recreation required (E2B 30-day limit)
- **Con**: Sandbox costs scale with concurrent sessions

**Example:**
```typescript
export class SessionAgent {
  private sandboxId: string | null = null
  private sandboxReady: boolean = false

  async initialize() {
    // Create E2B sandbox with custom template
    const sandbox = await fetch('https://api.e2b.dev/sandboxes', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.env.E2B_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        template: 'opencode-ship-agent', // Custom template with OpenCode
        timeoutMs: 3600000 // 1 hour max
      })
    }).then(r => r.json())

    this.sandboxId = sandbox.sandboxId
    await this.state.storage.put('sandboxId', this.sandboxId)

    // Clone repository into sandbox
    await this.execInSandbox(`
      git clone ${this.metadata.repoUrl} /workspace/repo
      cd /workspace/repo
    `)

    // Initialize OpenCode agent
    await this.execInSandbox(`
      cd /workspace/repo
      opencode init --provider anthropic --model claude-opus-4.5
    `)

    this.sandboxReady = true
    await this.broadcastEvent({ type: 'sandbox:ready' })
  }

  async handleTask(task: Task) {
    if (!this.sandboxReady) {
      throw new Error('Sandbox not initialized')
    }

    // Send task to OpenCode agent in sandbox
    const result = await this.execInSandbox(`
      cd /workspace/repo
      echo "${task.prompt}" | opencode chat
    `)

    // Stream output to EventBus
    await this.broadcastEvent({
      type: 'task:output',
      data: { taskId: task.id, output: result }
    })

    return { success: true }
  }

  async destroy() {
    // Cleanup sandbox on session end
    if (this.sandboxId) {
      await fetch(`https://api.e2b.dev/sandboxes/${this.sandboxId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${this.env.E2B_API_KEY}` }
      })
    }
  }
}
```

### Pattern 4: RPC-First Communication

**What:** Use Durable Objects' typed RPC methods instead of HTTP handlers for inter-component communication.

**When to use:** Always (available with compatibility date `2024-04-03` or later). RPC provides type safety and better DX.

**Trade-offs:**
- **Pro**: Full TypeScript type inference
- **Pro**: Simpler code (no manual request/response handling)
- **Pro**: Better error handling
- **Con**: Requires newer compatibility date
- **Con**: Slightly less flexible than raw HTTP

**Example:**
```typescript
// Define RPC methods on Durable Object
export class SessionAgent {
  // Public RPC methods (type-safe, called directly from stubs)
  async createMessage(content: string, role: 'user' | 'assistant') {
    const message: Message = {
      id: nanoid(),
      content,
      role,
      timestamp: Date.now()
    }

    await this.state.storage.put(`message:${message.id}`, message)
    await this.broadcastEvent({ type: 'message:new', data: message })

    return message
  }

  async getMessages(limit: number = 50) {
    const messages = await this.state.storage.list<Message>({
      prefix: 'message:',
      limit
    })

    return Array.from(messages.values())
  }
}

// Call RPC methods from Worker
export default {
  async fetch(request: Request, env: Env) {
    const url = new URL(request.url)
    const sessionId = url.pathname.split('/')[2]

    // Get DO stub
    const stub = env.SESSION_AGENT.get(
      env.SESSION_AGENT.idFromName(sessionId)
    )

    // Call RPC method directly (type-safe!)
    const message = await stub.createMessage(
      'Hello from worker',
      'user'
    )

    return Response.json({ message })
  }
}
```

### Pattern 5: Storage Layering

**What:** Use appropriate storage based on data characteristics: DO SQLite for session state, D1 for global metadata, R2 for large files.

**When to use:** Always. Proper storage selection prevents bottlenecks and reduces costs.

**Trade-offs:**
- **Pro**: Optimal performance and cost for each data type
- **Pro**: DO SQLite = single-session, strong consistency
- **Pro**: D1 = global queries, read replication
- **Pro**: R2 = no egress fees, unlimited size
- **Con**: Complexity in determining storage layer
- **Con**: Data synchronization across layers

**Example:**
```typescript
export class SessionAgent {
  // Use DO SQLite for hot session data
  async storeMessage(message: Message) {
    // Fast writes, automatic transactions, strong consistency
    await this.state.storage.sql.exec(`
      INSERT INTO messages (id, content, role, timestamp)
      VALUES (?, ?, ?, ?)
    `, message.id, message.content, message.role, message.timestamp)
  }

  // Archive to D1 when session ends
  async archiveSession() {
    const messages = await this.getMessages()

    // Move to D1 for long-term storage and querying across sessions
    await this.env.DB.batch(
      messages.map(m =>
        this.env.DB.prepare(`
          INSERT INTO archived_messages (session_id, content, role, timestamp)
          VALUES (?, ?, ?, ?)
        `).bind(this.sessionId, m.content, m.role, m.timestamp)
      )
    )
  }

  // Upload large artifacts to R2
  async saveScreenshot(data: ArrayBuffer, filename: string) {
    // R2 for large files (no egress fees)
    await this.env.R2_BUCKET.put(
      `sessions/${this.sessionId}/screenshots/${filename}`,
      data,
      {
        httpMetadata: { contentType: 'image/png' }
      }
    )

    // Store reference in DO SQLite
    await this.state.storage.sql.exec(`
      INSERT INTO artifacts (filename, type, r2_key)
      VALUES (?, 'screenshot', ?)
    `, filename, `sessions/${this.sessionId}/screenshots/${filename}`)
  }
}
```

## Data Flow

### Request Flow: Create New Task

```
[User creates task in Next.js UI]
    ↓
[POST /api/tasks → Next.js API Route]
    ↓ (validate session JWT)
[POST worker.dev/sessions/{id}/tasks → CF Worker]
    ↓ (authenticate, get DO stub)
[Worker → SessionAgent.createTask() via RPC]
    ↓
[SessionAgent DO]
  ├─ Store task in SQLite storage
  ├─ Send to E2B sandbox (OpenCode agent)
  └─ Broadcast to EventBus DO
          ↓
[EventBus DO → WebSocket broadcast]
    ↓
[Next.js UI receives real-time update]
```

### State Management Flow: Agent Execution

```
[OpenCode Agent in E2B Sandbox]
  ├─ Executes task (reads repo, makes changes)
  ├─ Generates files/screenshots
  └─ Reports progress via webhook to Worker
          ↓
[CF Worker receives webhook]
    ↓
[Worker → SessionAgent.updateProgress() via RPC]
    ↓
[SessionAgent DO]
  ├─ Update session state in SQLite
  ├─ Upload artifacts to R2 (if large)
  ├─ Store artifact references in SQLite
  └─ Broadcast progress to EventBus
          ↓
[EventBus DO → WebSocket broadcast]
    ↓
[Next.js UI updates in real-time]
    ↓
[User sees progress, terminal output, file diffs]
```

### Data Persistence Flow

```
[Session Active]
  SessionAgent DO (hot storage)
    ├─ Messages: DO SQLite (transactional)
    ├─ State: DO in-memory + SQLite backup
    └─ Artifacts: R2 (large files)
          ↓
[Session Ends]
  SessionAgent.destroy()
    ├─ Archive messages to D1 (long-term queryable)
    ├─ Keep R2 artifacts (cheap storage)
    └─ DO hibernates or evicts (state persisted in SQLite)
          ↓
[Historical Query]
  D1 for session history across users
  R2 for artifact retrieval
```

### Key Data Flows

1. **User → Agent**: Next.js → Worker → SessionAgent DO → E2B Sandbox → OpenCode Agent
2. **Agent → User**: OpenCode Agent → E2B webhook → Worker → SessionAgent DO → EventBus DO → WebSocket → Next.js
3. **Persistence**: SessionAgent DO SQLite (hot) → D1 (cold) → R2 (artifacts)

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| **0-100 users** | Single Worker region, minimal DO instances, simple D1 schema. Monolithic frontend + worker deployment. No special optimizations needed. |
| **100-1K users** | Enable D1 read replication for global query performance. Use Location Hints for SessionAgent DOs (place near user). Implement DO hibernation for idle sessions. Add R2 CDN caching for artifacts. |
| **1K-10K users** | Introduce session pooling (reuse E2B sandboxes when possible). Implement EventBus DO sharding (one per region or tenant). Add D1 read replicas in multiple regions. Use Workers Analytics for monitoring bottlenecks. |
| **10K+ users** | Consider E2B alternatives for cost optimization. Implement DO "warm pool" pattern (pre-initialized sandboxes). Add queue-based task processing (CF Queues) for non-real-time tasks. Evaluate custom domain for worker (lower latency). Use Vectorize for semantic search across sessions. |

### Scaling Priorities

1. **First bottleneck: E2B concurrent sandbox limit**
   - **Symptoms**: Sandbox creation failures, long wait times
   - **Fix**: Implement sandbox pooling (reuse stopped sandboxes), add queue for pending sessions
   - **Cost**: Increases E2B spend but unblocks growth

2. **Second bottleneck: DO SQLite storage (10GB limit per DO)**
   - **Symptoms**: Storage errors in long-running sessions
   - **Fix**: Implement aggressive archival to D1 (archive messages every 1000 messages), use R2 for all file outputs
   - **Cost**: More D1 writes but prevents DO storage exhaustion

3. **Third bottleneck: Real-time WebSocket connections (too many per EventBus DO)**
   - **Symptoms**: Slow broadcasts, connection limits hit
   - **Fix**: Shard EventBus DOs by session or region, implement pub/sub pattern with multiple EventBus instances
   - **Cost**: More DO instances but maintains real-time performance

## Anti-Patterns

### Anti-Pattern 1: Global Singleton Durable Object

**What people do:** Create a single "SessionManager" DO that handles all sessions for all users.

**Why it's wrong:**
- Creates a massive bottleneck (all requests funnel through one DO)
- Defeats Durable Objects' horizontal scaling capability
- Limits throughput to ~200 req/sec (if using `blockConcurrencyWhile`)
- Single point of failure

**Do this instead:**
- Use **control & data plane pattern**: lightweight control plane DO per user/tenant for metadata, data plane DO per session for operations
- Route directly to data plane DO when possible (bypass control plane for reads/writes)

**Example:**
```typescript
// ❌ WRONG: Global singleton
const globalManager = env.SESSION_MANAGER.get(
  env.SESSION_MANAGER.idFromName('global') // Everyone hits same DO!
)

// ✅ RIGHT: Per-user control, per-session data
const userControl = env.USER_CONTROL.get(
  env.USER_CONTROL.idFromName(userId) // One DO per user
)

const sessionData = env.SESSION_AGENT.get(
  env.SESSION_AGENT.idFromName(sessionId) // One DO per session
)
```

### Anti-Pattern 2: Using `blockConcurrencyWhile` for Every Request

**What people do:** Wrap every RPC method in `blockConcurrencyWhile` to "ensure consistency."

**Why it's wrong:**
- Serializes ALL requests to that DO (kills concurrency)
- Limits throughput to ~200 req/sec
- Storage operations already have automatic atomicity via "write coalescing"
- Only needed for initialization/migrations

**Do this instead:**
- Reserve `blockConcurrencyWhile` for constructor initialization only
- Trust DO's built-in concurrency guarantees (input/output gates)
- Use explicit locking (semaphore pattern) only for critical sections

**Example:**
```typescript
// ❌ WRONG: Blocks all requests
async getMessage(id: string) {
  return await this.state.blockConcurrencyWhile(async () => {
    return await this.state.storage.get(`message:${id}`)
  })
}

// ✅ RIGHT: Let DO handle concurrency
async getMessage(id: string) {
  return await this.state.storage.get(`message:${id}`)
}

// ✅ GOOD: Only for initialization
constructor(state: DurableObjectState, env: Env) {
  this.state = state
  this.env = env

  // Block concurrent requests during migration
  state.blockConcurrencyWhile(async () => {
    const version = await state.storage.get('schemaVersion')
    if (!version) {
      await this.runMigrations()
    }
  })
}
```

### Anti-Pattern 3: Storing Large Files in DO or D1

**What people do:** Store screenshots, repo archives, or generated code directly in Durable Object storage or D1.

**Why it's wrong:**
- DO storage has 10GB limit per instance (fills up fast)
- D1 has 10GB database limit (shared across all data)
- Expensive storage costs vs R2
- Slow reads/writes for large blobs

**Do this instead:**
- Use R2 for any file >100KB (screenshots, artifacts, repos)
- Store only file metadata/references in DO/D1
- R2 has no egress fees and unlimited storage

**Example:**
```typescript
// ❌ WRONG: Storing file in DO
async saveScreenshot(data: ArrayBuffer) {
  await this.state.storage.put('screenshot', data) // DO storage fills up!
}

// ✅ RIGHT: Store in R2, reference in DO
async saveScreenshot(data: ArrayBuffer, filename: string) {
  const key = `sessions/${this.sessionId}/${filename}`

  // Upload to R2
  await this.env.R2_BUCKET.put(key, data)

  // Store reference in DO
  await this.state.storage.put(`artifact:${filename}`, {
    r2Key: key,
    size: data.byteLength,
    uploadedAt: Date.now()
  })
}
```

### Anti-Pattern 4: Long-Running Operations Without Alarms

**What people do:** Start long-running tasks (sandbox execution, repo cloning) and hope they complete before DO eviction.

**Why it's wrong:**
- DO can be evicted during idle periods (even with open operations)
- No guaranteed execution time (Workers have 30s CPU limit, but DOs can run longer with I/O)
- Lost state if DO evicted mid-task

**Do this instead:**
- Use Durable Objects Alarms API for guaranteed execution
- Break long tasks into checkpointed steps
- Store progress in DO storage, resume on wake

**Example:**
```typescript
// ❌ WRONG: Assumes DO stays alive
async runLongTask() {
  for (let i = 0; i < 1000; i++) {
    await this.processStep(i) // DO might get evicted!
  }
}

// ✅ RIGHT: Use Alarms for guaranteed execution
async runLongTask() {
  await this.state.storage.put('taskProgress', { step: 0, total: 1000 })

  // Schedule next step via Alarm (guaranteed execution)
  const nextRun = Date.now() + 1000 // 1 second
  await this.state.storage.setAlarm(nextRun)
}

async alarm() {
  const progress = await this.state.storage.get('taskProgress')

  if (progress.step < progress.total) {
    await this.processStep(progress.step)

    // Update progress
    await this.state.storage.put('taskProgress', {
      step: progress.step + 1,
      total: progress.total
    })

    // Schedule next step
    await this.state.storage.setAlarm(Date.now() + 1000)
  }
}
```

### Anti-Pattern 5: No Hibernation for WebSocket DOs

**What people do:** Use standard `ws.accept()` instead of `state.acceptWebSocket()` for WebSocket connections.

**Why it's wrong:**
- DO stays active and bills for entire connection duration (even when idle)
- Cannot hibernate = massive costs for long-lived connections
- Misses 90%+ cost savings from hibernation

**Do this instead:**
- ALWAYS use `state.acceptWebSocket()` for WebSocket connections
- Implement hibernation event handlers
- Store connection state in attachments (under 2KB)

**Example:**
```typescript
// ❌ WRONG: No hibernation
async fetch(request: Request) {
  const pair = new WebSocketPair()
  const [client, server] = Object.values(pair)

  server.accept() // ❌ Prevents hibernation!

  return new Response(null, { status: 101, webSocket: client })
}

// ✅ RIGHT: Hibernatable
async fetch(request: Request) {
  const pair = new WebSocketPair()
  const [client, server] = Object.values(pair)

  this.state.acceptWebSocket(server) // ✅ Enables hibernation!

  return new Response(null, { status: 101, webSocket: client })
}
```

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| **GitHub OAuth** | Arctic (OAuth library) in Next.js API routes | Exchange code for token, store in JWE session cookie. Refresh token if expired. |
| **GitHub API** | Octokit REST client in Worker | Fetch repos, create PRs, post comments. Rate limit: 5000 req/hr authenticated. |
| **E2B Sandbox** | REST API from SessionAgent DO | Create sandbox per session, poll for status, webhook for events. ~150ms cold start. |
| **OpenCode Agent** | SDK installed in E2B template | Pre-configured in custom sandbox template. Invoke via terminal commands or WebSocket. |
| **Linear API** | GraphQL client in Worker | Create issues from tasks, sync status. OAuth for user authentication. |
| **Vercel API** | REST client in Worker | Deploy preview branches, trigger builds. Use OIDC token for auth. |
| **AI Model APIs** | Direct HTTP from E2B sandbox | OpenCode handles provider abstraction. Worker can also call for metadata operations. |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| **Next.js ↔ Worker** | HTTP/Fetch over public internet | Next.js makes fetch requests to Worker domain. Auth via JWE token in cookie. |
| **Worker ↔ SessionAgent DO** | RPC methods (typed) | Worker gets DO stub via `env.SESSION_AGENT.get()`, calls RPC methods directly. Type-safe. |
| **SessionAgent DO ↔ EventBus DO** | RPC methods (typed) | SessionAgent broadcasts events to EventBus via `eventBus.broadcast()`. One-way communication. |
| **Next.js ↔ EventBus DO** | WebSocket (Hibernatable) | Direct WebSocket connection for real-time updates. Next.js opens WS to Worker, upgraded to EventBus DO. |
| **Worker ↔ E2B Sandbox** | REST API + Webhooks | Worker creates/destroys sandboxes via E2B API. Sandbox sends progress via webhook to Worker. |
| **SessionAgent DO ↔ D1** | SQL queries via binding | DO can query D1 for archived data or write to D1 for archival. Binding in wrangler.toml. |
| **SessionAgent DO ↔ R2** | S3-compatible API via binding | DO uploads files to R2, retrieves via signed URLs. Binding in wrangler.toml. |

## Build Order & Dependencies

Recommended implementation sequence to minimize blocked work:

### Phase 1: Foundation (Week 1-2)
1. **Set up Turborepo structure** - Apps (web, worker) + packages (database, shared)
2. **Configure Cloudflare Worker** - Basic wrangler.toml, deploy hello-world
3. **Create D1 database** - Schema for users, sessions, tasks. Run migrations
4. **Implement Next.js auth** - GitHub OAuth flow, JWE sessions
5. **Deploy simple UI** - Login page, session list

**Why first:** Everything depends on auth and database. Get foundations right before adding complexity.

### Phase 2: Stateful Core (Week 3-4)
6. **Build SessionAgent DO** - Basic DO with SQLite storage, RPC methods for CRUD
7. **Build EventBus DO** - WebSocket handling with hibernation, broadcast method
8. **Connect Worker to DOs** - Routing logic, stub creation, RPC calls
9. **Add R2 integration** - File upload/download handlers in SessionAgent

**Why second:** DOs are the heart of the system. Build and test them in isolation before connecting external services.

### Phase 3: Execution Layer (Week 5-6)
10. **Create E2B custom template** - Install OpenCode, configure tools, setup script
11. **Build sandbox lifecycle in SessionAgent** - Create, initialize, destroy E2B sandboxes
12. **Implement task execution flow** - Send prompts to OpenCode, capture output
13. **Add webhook handler** - Receive progress updates from sandbox

**Why third:** Sandbox integration requires working SessionAgent DO. Test with mock responses before connecting real E2B.

### Phase 4: Real-Time UI (Week 7-8)
14. **Build WebSocket client in Next.js** - Connect to EventBus, handle reconnection
15. **Create session viewer** - Display messages, terminal output, file browser
16. **Add real-time updates** - React to events from EventBus, update UI
17. **Implement file operations** - Upload to sandbox, download artifacts from R2

**Why fourth:** UI depends on working DOs and E2B. Build frontend once backend is stable.

### Phase 5: External Integrations (Week 9-10)
18. **Add GitHub integration** - List repos, create branches, open PRs
19. **Add Linear integration** - Create issues, sync task status
20. **Add Vercel integration** - Deploy previews, trigger builds
21. **Polish auth flow** - Refresh tokens, multiple OAuth providers

**Why last:** Integrations are independent features. Can be added incrementally without blocking core functionality.

### Dependency Notes

- **Hard dependencies**: Phase 2 requires Phase 1, Phase 3 requires Phase 2
- **Soft dependencies**: Phase 4 can start before Phase 3 completes (use mock data)
- **Parallel work**: Phase 5 integrations can be built in parallel
- **Testing strategy**: Test each phase independently before moving to next

## Sources

- [Cloudflare Durable Objects: Control and Data Plane Pattern](https://developers.cloudflare.com/reference-architecture/diagrams/storage/durable-object-control-data-plane-pattern/)
- [Cloudflare Durable Objects: Rules and Best Practices](https://developers.cloudflare.com/durable-objects/best-practices/rules-of-durable-objects/)
- [Cloudflare Durable Objects: WebSocket Best Practices](https://developers.cloudflare.com/durable-objects/best-practices/websockets/)
- [Cloudflare Workers Storage Options](https://developers.cloudflare.com/workers/platform/storage-options/)
- [E2B Documentation](https://e2b.dev/docs)
- [OpenCode Agent System](https://opencode.ai/docs/agents/)
- [Next.js Cloudflare Deployment Guide](https://opennext.js.org/cloudflare)
- [Ramp Inspect Architecture (InfoQ)](https://www.infoq.com/news/2026/01/ramp-coding-agent-platform/)
- [AI Agent Architecture Guide 2026 (Lindy)](https://www.lindy.ai/blog/ai-agent-architecture)
- [Building Real-Time Apps with Durable Objects (DZone)](https://dzone.com/articles/serverless-websocket-real-time-apps)

---
*Architecture research for: Background Agent Platform*
*Researched: 2026-02-01*
