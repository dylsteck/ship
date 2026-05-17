# Architecture

This document explains the Ship architecture at a high level.

If `README.md` answers "what is this product and how do I use it?", this file answers "what are the major moving parts and how do they fit together?"

## One-line view

Ship is a cloud-hosted chat platform. The agent harness runs **outside** the
sandbox VM — inside the Cloudflare Worker — and uses the sandbox as a tool
(`read`, `write`, `edit`, `bash`, `grep`, `glob`, `todo_write`,
`ask_user_question`). E2B provides the sandbox; AI SDK + Anthropic/OpenAI
drive the model loop; Streamdown renders the streaming markdown.

## System shape

```text
+------------------+     SSE / HTTP      +---------------------------+
|  Next.js Web     |<------------------>|  Cloudflare Worker (API)  |
|  apps/web        |                    |  apps/api                 |
+------------------+                    +-----------+---------------+
        |                                           |
        | WebSocket (live sync)                     | runs the agent loop
        |                                           v
        |                                +----------------------+
        |                                | @ship/agent          |
        |                                | streamText + tools   |
        |                                +----------+-----------+
        |                                           | tool calls
        |                                           v
        |                                +----------------------+
        |                                | @ship/sandbox        |
        |                                | (E2B SDK adapter)    |
        |                                +----------+-----------+
        |                                           |
        |                                           v
        |                                +----------------------+
        +------------------------------->| E2B Sandbox VM       |
                                         | (workspace + tools)  |
                                         +----------------------+
```

## Design goals reflected in the code

- **agent harness lives outside the VM** — the Worker drives the AI SDK loop;
  the VM is just an execution surface (no in-VM HTTP server, no
  sandbox-agent dependency).
- **sandbox is a tool, not a control plane** — the `Sandbox` interface in
  `@ship/sandbox` is small and stable. Backends are swappable (E2B today;
  Vercel Sandbox or others later) without touching the agent.
- **cloud-first deployment** — Web app on Vercel/Coolify, API on Cloudflare
  Workers; no local daemon required.
- **per-session isolation** — Each chat session gets its own E2B sandbox.
- **durable session state** — Durable Objects store messages, tasks, sandbox
  metadata, and git state across Worker invocations.
- **frontend stays compatible** — AI SDK `UIMessageChunk`s are translated to
  Ship's existing SSE shape so the UI didn't have to be rewritten alongside
  the backend.

## Major components

### `apps/web` — Next.js frontend

The user entrypoint:

- dashboard with chat UI, session list, composer, and right sidebar
- streams from the API via SSE; uses Streamdown for the assistant markdown
  with `mode="streaming"` + per-token fade-in animation
- Durable Object websocket for cross-tab live updates
- AI elements (messages, tools, reasoning) come from `@ship/ui`

### `apps/api` — Cloudflare Worker

The orchestration layer:

- mounts Hono routes: `/health`, `/users`, `/sessions`, `/chat`, `/sandbox`,
  `/git`, `/models`, `/accounts`, `/connectors`, `/terminal`
- creates and manages Session Durable Objects (one per chat session)
- provisions E2B sandboxes per session
- runs the agent loop (`@ship/agent`) inside the Worker request handler
- translates AI SDK chunks → Ship SSE events
- persists messages and metadata to Durable Object storage; user/auth/chat
  records to D1

### `packages/agent` — Out-of-VM agent harness

- `runAgentStep` — wraps AI SDK `streamText` with a stable system prompt,
  the tool kit, prompt-cache markers, and the sandbox `experimental_context`
- `tools/{read,write,edit,bash,grep,glob,todo,ask-user-question}.ts` — small,
  composable tools that all call into the `Sandbox` interface
- `models.ts` — resolves `<provider>/<model>` ids to AI SDK language models
  (Anthropic + OpenAI direct over `fetch`)
- `system-prompt.ts` — cacheable system prompt (workspace + branch +
  environment details + custom instructions)

### `packages/sandbox` — Sandbox interface + E2B impl

- `interface.ts` — the small, stable contract: `readFile`, `writeFile`,
  `mkdir`, `readdir`, `stat`, `exec`, `domain(port)`, `extendTimeout`,
  `pause`, `getState`
- `e2b.ts` — `E2BSandboxAdapter` wrapping `@e2b/code-interpreter`
- `factory.ts` — `connectSandbox(state, options)` re-attaches by id

### `packages/ui` — Shared UI

AI elements + shadcn primitives consumed by the dashboard.

## Runtime model

### Session lifecycle

1. **Create session** — `POST /sessions` inserts into D1 and kicks off the
   sandbox provisioner.
2. **Sandbox provisioning** — `Sandbox.betaCreate()` (using the custom
   template when configured); `sandbox_id` lands on the SessionDO meta.
3. **First chat** — `prepareWorkspace` waits for the sandbox, clones the
   GitHub repo (auth via the user's OAuth token), and creates a feature
   branch. The Worker connects to the sandbox via `connectSandbox`.
4. **Follow-up chats** — Same sandbox + working directory. The Worker
   refreshes the auto-pause timeout on each turn.
5. **Unhealthy sandbox** — `Sandbox.connect` auto-resumes paused sandboxes.
6. **Delete session** — Hard delete from D1; DO terminates the sandbox.

### One chat turn

`POST /chat/:sessionId` executes the following inside `streamSSE`:

1. **Auth + persist user message** — `requireSessionOwner` + DO message
   write.
2. **`prepareWorkspace`** — wait for sandbox, clone repo if needed, return a
   live `Sandbox` handle plus `SandboxState`.
3. **Build conversation** — load DO history and convert to AI SDK
   `ModelMessage`s with `chat-history.toModelMessages` + `appendUserMessage`.
4. **`runAgentStep`** — `streamText` with the tool kit; `experimental_context`
   carries the sandbox.
5. **Translate chunks** — `agent-chunks.createAgentChunkTranslator(sessionId)`
   maps each `UIMessageChunk` to one or more Ship SSE events; each event is
   written to the SSE response and broadcast to DO websocket subscribers.
6. **Step finish** — once `result.totalUsage` resolves, emit a Ship
   `step-finish` part with token totals.
7. **Persist assistant message** — write to DO + D1 write-through.
8. **Wrap up** — `session.idle` + `done` events; optionally generate a
   session title from the first turn.

### AI SDK chunk → Ship SSE mapping

| AI SDK chunk | Ship SSE |
|--------------|----------|
| `text-delta` | `message.part.updated` (text + delta) |
| `reasoning-delta` | `message.part.updated` (reasoning + delta) |
| `tool-input-start` / `tool-input-delta` / `tool-input-available` | `message.part.updated` (tool, status pending → running) |
| `tool-output-available` | `message.part.updated` (tool, status completed) |
| `tool-output-error` | `message.part.updated` (tool, status error) |
| `error` | `session.error` |
| (after stream) `result.totalUsage` | `message.part.updated` (step-finish) |
| (after stream) | `session.idle` + `done` |

## Persistence model

### D1 (Cloudflare)

| Table | Purpose |
|-------|---------|
| `users` | Auth users (GitHub OAuth) |
| `accounts` | OAuth tokens |
| `chat_sessions` | Chat session records |
| `chat_messages` | Messages (write-through cache from DO) |
| `user_preferences` | User settings (default agent, model) |

### Session Durable Object (SQLite)

| Table | Purpose |
|-------|---------|
| `messages` | Authoritative chat history |
| `tasks` | Todo items |
| `session_meta` | sandbox_id, repo_url, current_branch, pr_number, etc. |

The DO also exposes HTTP RPC for messages, tasks, meta, sandbox lifecycle,
git state, and websocket broadcast. Legacy `sandbox_agent_url` /
`agent_session_id` keys are no longer written; getters return `null` for
backwards compatibility with older frontend builds.

## Models

`agent-registry.ts` lists UI personas. The default persona `ship` exposes:

- `anthropic/claude-3-7-sonnet-20250219` (default)
- `anthropic/claude-3-5-sonnet-20241022`
- `anthropic/claude-3-5-haiku-20241022`
- `openai/gpt-4o`, `openai/gpt-4o-mini`

`@ship/agent`'s `resolveModel` knows how to build a language model from a
`<provider>/<model>` id. Anthropic models also receive prompt-cache markers
on the system + last assistant message via `withAnthropicCacheControl`.

## Deployment

- **Web**: Docker (Coolify) or Vercel — Next.js app, `apps/web` root.
- **API**: Cloudflare Workers — `apps/api`, Hono + Durable Objects + D1.

Secrets: `ANTHROPIC_API_KEY` (default), `OPENAI_API_KEY` (optional),
`API_SECRET`, `E2B_API_KEY`, GitHub OAuth credentials.

## Why this shape

The system is trying to solve a specific product problem:

- give users a chat interface to a coding agent that ships real changes;
- keep auth, sessions, and sandbox state durable across requests;
- make the agent's behavior easy to evolve — tools, models, prompt cache,
  observability — without touching the VM image;
- stream structured events (text, reasoning, tools) in real time without
  the choppy multi-hop pipeline an in-VM HTTP server forces on us.

That is why the architecture converges on the same idea: **the Worker
orchestrates the agent**; **the sandbox is a tool the agent calls**; **the
frontend renders an AI SDK chunk stream wearing Ship's existing SSE shape**.

## Read next

- `README.md` — product view + setup
- `AGENTS.md` — agent-specific guide (tools, file layout, conventions)
- `apps/api/src/routes/chat-message-stream.ts` — request → turn entrypoint
- `apps/api/src/lib/chat-runner.ts` — drives `streamText` + chunk translation
- `apps/api/src/lib/agent-chunks/` — UIMessageChunk → Ship SSE translator
- `packages/agent/src/agent.ts` + `packages/agent/src/tools/` — the harness itself
- `packages/sandbox/src/interface.ts` — the sandbox contract
- `apps/web/components/chat/markdown.tsx` — Streamdown wrapper
