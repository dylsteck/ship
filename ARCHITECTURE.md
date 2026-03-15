# Architecture

This document explains the Ship architecture at a high level.

If `README.md` answers "what is this product and how do I use it?", this file answers "what are the major moving parts and how do they fit together?"

## One-line view

Ship is a cloud-hosted chat platform that provisions E2B sandboxes per session, runs multiple AI coding agents (Claude, OpenCode, Codex) via the Agent Client Protocol inside those sandboxes, and streams structured events to a Next.js frontend — with human-in-the-loop for permissions and questions.

## System shape

```text
+------------------+     SSE / HTTP      +---------------------------+
|  Next.js Web     |<------------------>|  Cloudflare Worker (API)  |
|  apps/web        |                    |  apps/api                 |
+------------------+                    +-----------+---------------+
        |                                               |
        | WebSocket (live sync)                          | HTTP
        |                                               v
        |                                    +----------------------+
        |                                    |  Session Durable     |
        |                                    |  Object (per session)|
        |                                    +----------+-----------+
        |                                               |
        |                                               | provisions sandbox
        |                                               v
        |                                    +----------------------+
        +----------------------------------->|  E2B Sandbox         |
                                             |  sandbox-agent server |
                                             |  ACP agent (stdio)    |
                                             +----------------------+
```

## Design goals reflected in the code

The current architecture optimizes for a few specific ideas:

- **cloud-first deployment** — Web app on Vercel, API on Cloudflare Workers; no local daemon required
- **per-session isolation** — Each chat session gets its own E2B sandbox and sandbox-agent instance
- **multi-agent support** — One runtime (sandbox-agent) hosts multiple ACP agents; users switch agents without changing infrastructure
- **schema-rich tool usage** — Agents use sandbox-agent's tool catalog; MCP servers (Grep, DeepWiki, Exa) are registered per session
- **human-in-the-loop** — Permission and question flows pause execution, await user response, then resume via API
- **durable session state** — Durable Objects store messages, tasks, sandbox metadata, and git state across Worker invocations

## Major components

### `apps/web`: Next.js frontend

This is the main user entrypoint.

Responsibilities:

- exposes the dashboard with chat UI, session list, composer, and right sidebar
- connects to the API via SSE for streaming and HTTP for CRUD
- maintains WebSocket connection to Session Durable Object for live updates (messages, agent-url, sandbox-status)
- renders AI elements (messages, tools, reasoning, subagent views) from `@ship/ui`
- handles permission and question prompts inline with the conversation
- syncs session URL, model, repo, and branch with the URL and composer state

The frontend is intentionally thin. It is mostly a presentation layer over the control-plane API.

### `apps/api`: Cloudflare Worker

This package hosts the API and session orchestration.

Responsibilities:

- mounts Hono routes: `/health`, `/users`, `/sessions`, `/chat`, `/sandbox`, `/git`, `/models`, `/accounts`, `/connectors`, `/terminal`, `/desktop`
- creates and manages Session Durable Objects (one per chat session)
- provisions E2B sandboxes per session and starts sandbox-agent inside them
- connects to sandbox-agent, creates or resumes agent sessions, and streams events
- translates sandbox-agent events (ACP + UniversalEvent) to Ship SSE format
- persists messages and metadata to Durable Object storage
- persists user, auth, and chat session records to D1

This is the center of the system. All agent execution flows through the Worker.

### `packages/ui`: Shared UI components

This package provides the building blocks for the chat interface.

Responsibilities:

- **AI elements** — Message, Conversation, Response, Reasoning, Tool, SubagentTool, TodoProgress, Loader, SessionSetup, ThinkingBlock
- **Base components** — shadcn/ui primitives (Button, Card, Tabs, DropdownMenu, etc.)
- **Composition** — `useConversation`, `cn` utility, `useIsMobile`

The UI is designed to be reusable across the dashboard and any future surfaces.

### `packages/ui` (ai-elements)

AI-specific rendering components:

| Component | Purpose |
|-----------|---------|
| `Message` | Container for a single message, role-driven layout |
| `Conversation` | Scrollable message list with auto-scroll |
| `ThinkingBlock` | Collapsible reasoning + tools; "Thought for X seconds" when done |
| `Tool` | Tool call card with icon, status, input/output, duration |
| `SubagentTool` | Sub-agent card with "View →" and optional child tools |
| `TodoProgress` | Todo list display |
| `Response` | Wrapper for assistant text |
| `Loader` | Shimmer + message |
| `SessionSetup` | Collapsible startup steps (e.g. "Provisioning sandbox...") |

## Runtime model

### Session lifecycle

1. **Create session** — `POST /sessions` inserts into D1, starts background DO init + `POST https://do/sandbox/provision`.
2. **Sandbox provisioning** — SessionDO calls `SandboxManager.provision()` → `Sandbox.betaCreate()` (with custom template if configured), stores `sandbox_id` in `session_meta`.
3. **First chat** — Chat route waits for sandbox, starts sandbox-agent (skips install if pre-baked in template), clones repo, creates agent session.
4. **Follow-up chats** — Reuse sandbox and agent session; refresh timeout on each message.
5. **Unhealthy sandbox** — Try resume; if needed, re-provision and re-clone.
6. **Delete session** — Soft delete in D1, `POST https://do/sandbox/terminate` for cleanup.

### Desktop streaming

Users can open an interactive Linux desktop for any active sandbox:

1. **Start stream** — `POST /desktop/:sessionId/start` → connects via `@e2b/desktop` SDK, starts noVNC stream with auth.
2. **View desktop** — Stream URL is loaded in an iframe (noVNC web client, fully interactive with mouse + keyboard).
3. **State persistence** — Stream URL and auth key are stored in Session DO meta (`desktop_stream_url`, `desktop_stream_auth_key`), so the stream survives page refreshes.
4. **Stop stream** — `POST /desktop/:sessionId/stop` → stops stream, clears DO meta.

### Agent lifecycle

1. **Sandbox ready** — `sandbox-agent` binary is pre-installed in the custom E2B template (or installed at runtime as fallback).
2. **Agent install** — Pre-installed in template, or `sandbox-agent install-agent <name>` (claude, opencode, codex) as fallback.
3. **Server start** — `sandbox-agent server` runs on port 3000 inside the sandbox.
4. **Worker connects** — `connectToSandboxAgent(url)` (cached per sandbox URL).
5. **Session create/resume** — `createAgentSession()` or `resumeAgentSession()`.
6. **MCP sync** — Shared MCP configs (Grep, DeepWiki, Exa) registered before session creation.
7. **Prompt** — `promptAgent(session, content)`; events stream in via `subscribeToSessionEvents()`.
8. **Event translation** — `EventTranslatorState.translateEvent(event)` maps to Ship SSE.
9. **Dispose** — `disposeSandboxAgent(url)` when done.

## Persistence model

The persistence layer is split across two stores.

### D1 (Cloudflare)

SQLite-backed, for application and auth data:

| Table | Purpose |
|------|---------|
| `users` | Auth.js users (GitHub OAuth) |
| `accounts` | OAuth tokens (GitHub access_token, refresh_token) |
| `sessions` | Auth.js session records |
| `chat_sessions` | Chat session records: id, user_id, repo_owner, repo_name, status, last_activity, title |
| `user_preferences` | User settings (default agent, model) |

### Session Durable Object (SQLite)

Per-session storage inside the Durable Object:

| Table | Purpose |
|------|---------|
| `messages` | Message history (id, role, content, parts, created_at) |
| `tasks` | Todo items (id, title, description, status, mode) |
| `session_meta` | Key-value: sandbox_id, sandbox_agent_url, agent_session_id, agent_type, repo_url, current_branch, pr_number, etc. |

The DO also exposes HTTP RPC endpoints for messages, tasks, meta, sandbox lifecycle, git state, and WebSocket broadcast.

## Source and agent model

### Supported agents

| Agent | sandbox-agent name | Required Env Var | Modes |
|-------|--------------------|------------------|-------|
| Claude Code | `claude` | `ANTHROPIC_API_KEY` | default, plan, acceptEdits |
| OpenCode | `opencode` | — | build, plan |
| Codex | `codex` | `OPENAI_API_KEY` | read-only, auto, full-access |

Agent configs are defined in `apps/api/src/lib/agent-registry.ts`. Default agent is `opencode`.

### MCP servers

Shared MCP servers are registered per session before agent session creation:

| MCP | URL |
|-----|-----|
| Grep | `https://mcp.grep.app` |
| DeepWiki | `https://mcp.deepwiki.com/mcp` |
| Exa | `https://mcp.exa.ai/mcp` |

Defined in `apps/api/src/lib/sandbox-agent.ts` as `SHARED_MCP_CONFIGS`.

## Chat flow

### 1. POST /chat/:sessionId

1. Parse body — `content`, `mode` (default `agent`).
2. Get SessionDO — `c.env.SESSION_DO.idFromName(sessionId)` → stub.
3. Persist user message — `POST https://do/messages` to DO.
4. Read metadata — `GET https://do/meta` → `agent_session_id`, `sandbox_id`, `sandbox_agent_url`, `agent_type`, etc.
5. Wait for sandbox — If `!sandboxId && sandboxStatus !== 'error'`, poll DO meta until sandbox ready or timeout (30s).
6. Start sandbox-agent — If no `sandbox_agent_url`:
   - Build env vars (ANTHROPIC, OPENAI, CURSOR).
   - `Sandbox.connect(sandboxId)` → `startSandboxAgentServer(sandbox, sandboxId, agentType, envVars)`.
   - Store URL in DO meta, send `agent-url` SSE.
7. Clone repo — If `repoOwner`/`repoName` but no `repo_url`, clone via GitHub token, create branch.
8. Health check — `checkSandboxAgentHealth(url)`. If unhealthy: try resume; if still unhealthy, re-provision and re-clone.
9. Refresh sandbox timeout — `refreshSandboxTimeout()` on each message.
10. Connect to sandbox-agent — `connectToSandboxAgent(url)` (cached).
11. Validate agent — `validateAgentRuntime(client, agentType)`.
12. Create or resume agent session — `createAgentSession()` or `resumeAgentSession()`.
13. Configure session — `configureAgentSession(session, { mode })`.
14. Event loop — `subscribeToSessionEvents(session, callback)`:
    - `translator.translateEvent(event)` → Ship SSE events.
    - Write SSE to stream.
    - Persist title to D1 when `session.updated`.
    - Broadcast to WebSocket clients.
15. Send prompt — `promptAgent(session, content)` (with retry).
16. Post-turn — If `translator.hasFileChanges`, call `POST https://do/agent/response` for git commit/PR.
17. Persist assistant message — `POST https://do/messages` with `content` and `parts`.
18. Generate title — If no AI title, call `generateSessionTitle()`.
19. Send `done` — Final SSE event.
20. Dispose — `disposeSandboxAgent(url)`.

### 2. Event translation

`EventTranslatorState` maps sandbox-agent events to Ship SSE:

| ACP / UniversalEvent | Ship SSE |
|---------------------|----------|
| `session.started` | `status` (agent-active) |
| `session.ended` (normal) | `session.idle`, `done` |
| `session.ended` (error) | `session.error` |
| `turn.started` | Reset accumulators, `status` (sending-prompt) |
| `turn.ended` | `session.idle` |
| `agent_message_chunk` | `message.part.updated` (text) |
| `agent_thought_chunk` | `message.part.updated` (reasoning) |
| `tool_call` / `tool_call_update` | `message.part.updated` (tool, pending/running/completed/error) |
| `item.started` (tool_call) | `message.part.updated` (tool, pending) |
| `item.delta` (text) | `message.part.updated` (text) |
| `item.delta` (tool) | `message.part.updated` (tool, running) |
| `item.completed` (tool_call/tool_result) | `message.part.updated` (tool completed) |
| `permission.requested` | `permission.asked` |
| `permission.resolved` | `permission.granted` or `permission.denied` |
| `question.requested` | `question.asked` |
| `question.resolved` | `question.replied` or `question.rejected` |
| `error` | `session.error` |

The translator tracks: `textAccumulator`, `reasoningAccumulator`, `toolCallMap`, `partCounter`, `hasChanges`.

## Human interaction model

A major architectural feature is that interactions are first-class runtime state.

### Permission prompts

1. Agent requests permission — `permission.requested` → `permission.asked` SSE.
2. Frontend renders inline `PermissionPrompt` (Approve/Deny).
3. User clicks — `replyPermission(sessionId, permissionId, 'once' | 'reject')` → `POST /chat/:sessionId/permission/:permissionId`.
4. Agent receives `permission.reply` — `permission.granted` or `permission.denied` SSE.
5. Execution resumes.

### Question prompts

1. Agent asks question — `question.requested` → `question.asked` SSE.
2. Frontend renders inline `QuestionPrompt` (text input, Reply/Skip).
3. User replies — `POST /chat/:sessionId/question/:questionId` with reply.
4. Agent receives `question.reply` — `question.replied` or `question.rejected` SSE.
5. Execution resumes.

## Frontend architecture

### Component tree

```
DashboardClient (orchestrator — state, routing, session lifecycle)
├── AppSidebar (left — session list, search, new chat)
├── DashboardHeader (top bar — title, connection status, sidebar toggle)
├── DashboardMessages (message rendering — maps UIMessage[] to components)
│   ├── Message + Loader (empty streaming state)
│   ├── PermissionPrompt / QuestionPrompt (inline prompts)
│   ├── ErrorMessage (classified errors)
│   ├── Tool / SubagentTool / TodoProgress (tool invocations)
│   ├── ReasoningCollapsible (thinking blocks)
│   ├── Response + Markdown (assistant text)
│   └── SubagentView (replaces message list when navigating into sub-agent)
├── DashboardComposer (input area)
│   ├── ComposerTextarea
│   ├── RepoSelector
│   ├── ModelSelector
│   ├── ModeToggle (build/plan)
│   ├── SubmitButton
│   └── ComposerFooter
└── RightSidebar (session stats, todos, file diffs, VCS link)
    ├── Git tab (diff, review, commits)
    ├── Desktop tab (interactive noVNC desktop stream via @e2b/desktop)
    ├── Terminal tab (xterm.js)
    └── Overview tab (SessionPanel)
```

### Data flow: SSE → UIMessage → Render

1. **SSE types** (`apps/web/lib/sse-types.ts`) — Defines all event types: `message.part.updated`, `session.*`, `permission.*`, `question.*`, `agent-url`, `done`, etc.
2. **Adapter layer** (`apps/web/lib/ai-elements-adapter.ts`) — Transforms SSE data into `UIMessage` (id, role, content, toolInvocations, reasoning, type, promptData, elapsed).
3. **Event handlers** (`sse-event-handlers.ts`) — Pure functions that dispatch SSE events to React state. Text/reasoning use refs + batched updates; tools update immediately.

### Streaming optimization

- Text and reasoning accumulate in `assistantTextRef` and `reasoningRef`; `scheduleFlush()` batches `setMessages` to limit re-renders.
- Tool updates bypass the batch and trigger immediate `setMessages`.

### Sub-agent navigation

- `subagentStack` in `DashboardMessages` holds `SubagentViewState[]`.
- `SubagentTool` has "View →" that pushes onto the stack.
- When stack is non-empty, `SubagentView` replaces the message list.
- `useSubagentStream` fetches `/chat/:parentId/subagent/:subId/stream` for live subagent events.
- Detection via `isSubagentToolInvocation()` in `lib/subagent/utils.ts`.

## API and deployment

### HTTP API

| Route group | Purpose |
|-------------|---------|
| `/health` | Health check |
| `/users` | User CRUD (Auth.js) |
| `/sessions` | Session CRUD, sandbox provisioning |
| `/chat` | SSE streaming, messages, permission/question replies |
| `/sandbox` | Sandbox lifecycle |
| `/desktop` | Desktop stream start/stop/status |

### Deployment

- **Web**: Vercel — Next.js app, `apps/web` root.
- **API**: Cloudflare Workers — `apps/api`, Hono + Durable Objects + D1.

Secrets: `ANTHROPIC_API_KEY`, `API_SECRET`, `E2B_API_KEY`, `OPENAI_API_KEY` (optional), `CURSOR_API_KEY` (optional).

## Why the architecture is shaped this way

The system is trying to solve a specific product problem:

- give users a chat interface to AI coding agents that work on real code in sandboxes
- keep auth, sessions, and sandbox state durable across requests
- support multiple agents (Claude, OpenCode, Codex) via one runtime (sandbox-agent)
- make permission and question flows pause and resume cleanly
- stream structured events (text, reasoning, tools) in real time

That is why the architecture keeps converging on the same central idea:

Ship is not just a chat UI. It is a cloud-hosted platform that owns session state, sandbox provisioning, agent execution, and event translation — with the frontend as a thin client over that runtime.

## Current boundaries

A few practical boundaries are worth calling out:

- the active implementation is cloud-first (Vercel + Cloudflare Workers)
- sandbox-agent is the single agent runtime; OpenCode SDK was removed in favor of ACP
- the Session Durable Object owns per-session state; D1 owns auth and chat session records
- the frontend is React/Next.js with Tailwind and shadcn/ui
- MCP servers are shared and configurable per session; no per-agent MCP config yet

## Read next

- `README.md` for the product view and usage guidance
- `AGENTS.md` for agent-specific context, file layout, and conventions
- `apps/api/src/routes/chat.ts` for the chat flow
- `apps/api/src/lib/event-translator.ts` for event translation
- `apps/web/app/(app)/dashboard/dashboard-client.tsx` for the frontend orchestrator
