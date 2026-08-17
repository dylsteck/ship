# AGENTS.md

This document provides context for AI agents working on the Ship codebase.

## Agent Skills

Project-specific skills live in `.agents/skills/`. **Reference and use these skills when they apply** — read the skill's `SKILL.md` file when a task matches its triggers.

| Skill | Purpose |
|-------|---------|
| **agent-browser** | Browser automation — navigate, fill forms, click, screenshot, scrape, test web apps |
| **ai-elements** | Create AI chat components in `packages/ui` following ai-elements patterns and shadcn/ui |
| **dogfood** | Systematic QA — explore apps, find bugs/UX issues, produce reports with repro evidence |
| **shadcn** | shadcn/ui components — add, search, fix, style, compose; use with `components.json` projects |

## Quick Start

```bash
pnpm install
pnpm dev
```

### Build

```bash
pnpm build        # Build all apps
pnpm typecheck   # Type check only
pnpm lint         # Lint all packages
```

> **After making changes:** always run `pnpm build && pnpm lint && pnpm typecheck` before finishing. Fix any errors before considering the task done.

### Deployment

The **API** runs on **Cloudflare Workers** (Wrangler). The **Next.js web app** (`apps/web`) is primarily a **Cloudflare Worker** via [`@opennextjs/cloudflare`](https://opennext.js.org/cloudflare) + Wrangler. A **Docker** image (`apps/web/Dockerfile`, Next [standalone](https://nextjs.org/docs/app/api-reference/config/next-config-js/output) output) remains for optional self-hosting (e.g. Coolify).

#### Web App (Next.js) — Cloudflare Workers

Deploy from `apps/web`:

```bash
cd apps/web
pnpm deploy   # opennextjs-cloudflare build && opennextjs-cloudflare deploy
```

- **Config:** `apps/web/wrangler.jsonc` (Worker name `ship-web`, custom domain `https://ship.dylansteck.com`).
- **Secrets:** `npx wrangler secret put GITHUB_CLIENT_ID` (and `GITHUB_CLIENT_SECRET`, `SESSION_SECRET`, `API_SECRET`).
- **Build-time env:** `NEXT_PUBLIC_API_URL` / `NEXT_PUBLIC_APP_URL` (same as `apps/web/.env.example`).
- **Worker size:** OpenNext gzip is ~4.3 MiB (over the 3 MiB Workers Free limit). Enable [Workers Paid](https://developers.cloudflare.com/workers/platform/limits/#worker-size) (10 MiB) before `pnpm deploy:web`.
- **Optional Docker:** `DEPLOY_TARGET=node` in `apps/web/Dockerfile` (port **3000**, build context = **repository root**).

#### Web App (Next.js) — Docker / Coolify (optional)

- **Dockerfile:** `apps/web/Dockerfile` (build context: **repository root**).
- **Port:** `3000` (set **Ports Exposes** to `3000` in Coolify).
- **Env:** Same variables as `apps/web/.env.example` (set in Coolify; pass build args for `NEXT_PUBLIC_*` / `API_BASE_URL` if needed at build time).

#### API (Cloudflare Worker) — Wrangler

Deploy from `apps/api`:

```bash
cd apps/api
npx wrangler deploy              # Deploy to production
npx wrangler deploy --env staging  # Deploy to staging (if configured)
npx wrangler dev                   # Local dev server
```

Secrets must be set via `wrangler secret put`:

```bash
npx wrangler secret put ANTHROPIC_API_KEY
npx wrangler secret put API_SECRET
npx wrangler secret put E2B_API_KEY
npx wrangler secret put OPENAI_API_KEY      # Optional, Codex API-key auth
npx wrangler secret put CODEX_AUTH_JSON      # Optional, personal ChatGPT sub (~/.codex/auth.json)
npx wrangler secret put CODEX_ACCESS_TOKEN  # Optional, enterprise Codex (see codex/auth docs)
```

## Ports

- Web App: `http://localhost:3000`
- API (local): `http://localhost:8787`

## Project Structure

```
ship/
├── apps/
│   ├── web/                          # Next.js App Router (frontend)
│   │   ├── app/(app)/dashboard       # Dashboard with chat UI
│   │   ├── components/chat/markdown.tsx  # Streamdown wrapper (animated fade-in)
│   │   ├── lib/
│   │   │   ├── session-logic.ts          # Pure timeline/approval/collapse derivations (Vitest)
│   │   │   ├── chat-store/               # Zustand streaming state + selectors
│   │   │   ├── session-connection/       # Unified WS + SSE lifecycle hooks
│   │   │   ├── ai-elements-adapter.ts    # SSE → UIMessage adapter
│   │   │   ├── sse-types.ts              # Wire-format event types (prefer @ship/contracts for new code)
│   │   │   └── api/                      # API client functions
│   │   └── components/               # Shared React components
│   └── api/                          # Cloudflare Worker (backend)
│       └── src/
│           ├── routes/
│           │   ├── chat.ts                       # Hono router for /chat/*
│           │   ├── chat-message-stream.ts        # POST /chat/:sessionId — drives one turn
│           │   ├── chat-auxiliary-routes.ts      # stop / subscribe / messages / git passthroughs
│           │   ├── chat-session-helpers.ts       # error persistence helpers
│           │   ├── sessions.ts                   # Session CRUD
│           │   ├── sandbox.ts                    # Sandbox management
│           │   ├── models.ts                     # Model listing (powered by agent-registry)
│           │   ├── git.ts                        # Git operations
│           │   ├── connectors.ts                 # GitHub connector status/enable/disable
│           │   ├── terminal.ts                   # Terminal access
│           │   └── openapi.ts                    # GET /openapi.json (public spec)
│           ├── openapi/
│           │   ├── schemas.ts                    # Zod REST schemas (OpenAPI + route validation)
│           │   └── build-spec.ts                 # Programmatic OpenAPI 3.1 document
│           ├── lib/
│           │   ├── acp-chat-runner.ts           # One turn — ACP JSON-RPC over bridge → Ship SSE
│           │   ├── acp-bridge-bootstrap.ts      # Bundled bridge drop-in + `/healthz` polling
│           │   ├── acp-json-rpc.ts              # WebSocket envelopes + JSON-RPC multiplexing
│           │   ├── chat-runner.ts               # Facade re-export (stable import path)
│           │   ├── chat-workspace.ts            # Sandbox + repo provisioning for a turn
│           │   ├── chat-history.ts              # Persisted rows → `ChatTurnMessage[]`
│           │   ├── chat-stream-helpers.ts       # `writeStatus` / `writeError` / `writeDone`
│           │   ├── agent-chunks/                # ACP notifications → Ship SSE
│           │   │   ├── index.ts                 # Public exports
│           │   │   ├── acp-translator.ts
│           │   │   ├── events.ts
│           │   │   └── state.ts
│           │   ├── agent-registry.ts            # Personas + `ship-acp-*` picker entries
│           │   ├── acp-types.ts                 # `AcpBackendKind` + stable model ids
│           │   ├── generate-session-title.ts    # REST title helper (Anthropic → OpenAI)
│           │   ├── e2b.ts                       # Raw E2B SDK wrappers (provision / pause / resume)
│           │   ├── session-authorization.ts     # JWT user id + D1 session ownership
│           │   └── api-schemas.ts               # Re-exports openapi/schemas + parseJsonBody
│           ├── workflows/
│           │   └── ship-acp-bootstrap.ts        # Cloudflare Workflow scaffold (bootstrap retries)
│           ├── durable-objects/
│           │   └── session.ts                   # Session Durable Object (SQLite + WS)
│           └── env.d.ts                         # Worker env bindings
└── packages/
    ├── contracts/                  # @ship/contracts — Zod wire schemas, branded IDs, errors
    ├── sdk/                        # @ship/sdk — Hey API client from OpenAPI (REST + runtime helpers)
    │   ├── docs/README.md          # SDK usage (browser, SSR, service token, streaming)
    │   └── src/
    │       ├── generated/          # Committed openapi-ts output (regenerate via pnpm sdk:generate)
    │       └── runtime/            # configureShipClient, streaming, service client, ws URLs
    ├── acp-bridge/                 # `ship-acp-bridge` sources (esbuild-bundled into the Worker)
    │   └── src/
    │       └── server.ts           # Localhost HTTP + WS → NDJSON stdio
    ├── sandbox/                    # @ship/sandbox — Sandbox interface + E2B impl
    │   └── src/
    │       ├── interface.ts          # Sandbox + SandboxState types
    │       ├── e2b.ts                # E2BSandboxAdapter
    │       └── factory.ts            # connectSandbox(state, options)
    ├── types/                        # @ship/types — shared TS types
    └── ui/                           # @ship/ui — shadcn-based components
```

## Agent Architecture

Ship runs **ACP agent CLIs inside the E2B sandbox**. The Worker connects to **`ship-acp-bridge`** over **WSS**; the bridge spawns the selected backend and forwards **NDJSON JSON-RPC** on stdio. Tooling and file access are owned by that backend (not a Worker-side AI SDK loop).

### How a chat turn runs

1. The web app sends `POST /chat/:sessionId` with `{ content, mode? }`.
2. {@link prepareWorkspace} ensures a sandbox exists and the repo is cloned.
3. {@link ensureAcpBridgeReady} writes the bundled bridge to `/tmp`, starts it, polls `/healthz`.
4. `acp-json-rpc` opens the WebSocket, sends `ctl.spawn` with the backend kind from `model` / `ship-acp-*` ids.
5. JSON-RPC `initialize` → `authenticate` (per-backend) → `session/new` or `session/load` → `session/prompt`.
6. Notifications are translated by {@link createAcpNotificationTranslator} into Ship SSE.
7. Assistant text is persisted; `step-finish`, `session.idle`, `done` close the stream.

### ACP backends (spawn targets)

| Backend | Typical CLI | Notes |
|---------|-------------|--------|
| OpenCode | `opencode acp` | `OPENCODE_API_KEY` optional on Worker |
| Cursor | `agent acp` | Cursor auth per docs |
| Claude | `claude-agent-acp` | Anthropic env optional |
| Codex | `codex-acp` | `CODEX_AUTH_JSON` (personal sub) or `CODEX_ACCESS_TOKEN` (enterprise) or `OPENAI_API_KEY` (API billing) |

See `packages/sandbox/README.md` for baking ACP CLIs into a custom E2B template.

### Supported models (picker)

`agent-registry.ts` / `GET /models/available` expose **`ship-acp-opencode`**, **`ship-acp-cursor`**, **`ship-acp-claude`**, **`ship-acp-codex`**.

### Event flow

```
User prompt → Worker → bridge (WSS) → ACP backend (stdio) → repo workspace
                │                               │
                │◄── ACP notifications ─────────┘
                ▼
      ACP notification translator → SSE → web
```

## Shared contracts & session logic

**`@ship/contracts`** (`packages/contracts`) is the single source of truth for wire-format data shared between `apps/api` and `apps/web`:

- Branded IDs (`SessionId`, `MessageId`, `TurnId`, `ToolCallId`)
- SSE event Zod schemas including `session.summary.updated`
- Shared `classifyErrorFromMessage()` and stable `ErrorCode` values
- Turn/diff summaries, session meta, approval policies, tool presentation helpers

**`apps/web/lib/session-logic.ts`** holds pure derivations (timeline, pending prompts, tool collapse) covered by Vitest. React hooks should delegate to these functions rather than embed business rules.

**SessionDO** stores append-only `session_events`, first-class `turns`, and broadcasts lightweight `session.summary.updated` over WebSocket for sidebar/shell consumers (t3code `subscribeShell` analogue). Turn streaming still uses POST SSE per chat turn.

## OpenAPI & `@ship/sdk`

REST JSON types and the web/mobile client come from a single OpenAPI pipeline:

| Layer | Location | Role |
|-------|----------|------|
| Zod REST schemas | `apps/api/src/openapi/schemas.ts` | Request/response validation + OpenAPI generation |
| Committed spec | `apps/api/openapi/ship-api.openapi.json` | Source for Hey API codegen; served at `GET /openapi.json` |
| Generated client | `packages/sdk/src/generated/` | Typed fetch functions (`getSessions`, `postSessions`, …) |
| Runtime | `packages/sdk/src/runtime/` | `configureShipClient`, `unwrapSdkData`, SSE (`streaming`), service token (`service`) |

**`@ship/contracts`** remains the source of truth for **SSE and WebSocket** wire events — not duplicated in OpenAPI.

**Web app API access:** `apps/web/lib/api/hooks/*` and `server.ts` call `@ship/sdk`. Bootstrap via `@/lib/api/configure` (`setApiToken` / `configureWebShipClient`). Legacy `client.ts` fetcher is deprecated.

Regenerate after schema changes:

```bash
pnpm openapi:export && pnpm sdk:generate
```

Client data fetching (SWR → TanStack Query migration): `apps/web/docs/data-fetching.md`.

See `apps/api/docs/openapi.md` and `packages/sdk/docs/README.md`.

## Frontend Architecture

### UI Component Library (@ship/ui)

The `packages/ui` package exports two categories of components. Import from `'@ship/ui'` for components, `'@ship/ui/utils'` for `cn()` and utility functions.

#### AI Elements (`src/ai-elements/`)

These are the core components for rendering agent interactions:

| Component | Purpose |
|-----------|---------|
| `Message` | Container for a single message, accepts `role` prop ('user' / 'assistant' / 'system') |
| `Conversation` | Scrollable message list wrapper with auto-scroll behavior |
| `ConversationMessage` | Individual message within a Conversation |
| `ConversationScrollButton` | "Scroll to bottom" button overlay |
| `useConversation` | Hook for Conversation scroll state |
| `Response` | Wrapper for assistant text content (adds styling/animation) |
| `Reasoning` | Displays reasoning/thinking text |
| `ReasoningCollapsible` | Collapsible reasoning block with streaming duration indicator |
| `ChainOfThought` | Multi-step reasoning visualization |
| `Tool` | Tool call card with name, status, collapsible input/output, duration |
| `Steps` | Group of sequential tool/action steps |
| `SubagentTool` | Specialized tool card for sub-agent invocations with navigate action |
| `TodoProgress` | Inline progress card for todo/task tracking |
| `Task` | Individual task display |
| `Loader` | Animated loading indicator with status message |
| `PromptInput` | Chat input textarea component |
| `Shimmer` | Animated shimmer/skeleton effect for streaming states |
| `CodeBlock` | Syntax-highlighted code block |

#### Base Components (shadcn-based)

Button, Command, Badge, Card, Collapsible, DropdownMenu, Input, Progress, ScrollArea, Select, Separator, Sheet, Sidebar (SidebarProvider, SidebarInset, etc.), Skeleton, Tabs, Textarea, Tooltip.

Also exports `useIsMobile` hook and `cn` utility.

### Dashboard Component Tree

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
```

### Markdown streaming

`apps/web/components/chat/markdown.tsx` wraps Streamdown with `mode="streaming"`
+ `animated={{ animation: 'fadeIn', duration: 250, easing: 'ease-out' }}` while
a message is streaming. New tokens fade in instead of popping, which is the
single biggest perceptual smoothness win compared to the old in-VM agent
pipeline (where tokens went through ACP → sandbox-agent → E2B port-proxy →
Worker → SSE). With the agent in the Worker the hop count drops by two and
the chunk stream is the AI SDK's native delta stream.

### Data Flow: SSE → UIMessage → Render

The data pipeline has three layers:

#### 1. SSE Types (`apps/web/lib/sse-types.ts`)

Defines all event types the frontend can receive. Key event categories:

| Category | Events |
|----------|--------|
| Message streaming | `message.part.updated`, `message.updated`, `message.removed` |
| Session lifecycle | `session.created`, `session.updated`, `session.deleted`, `session.compacted`, `session.status`, `session.idle`, `session.error` |
| Interactive prompts | `permission.asked`, `permission.granted`, `permission.denied`, `question.asked`, `question.replied`, `question.rejected` |
| Side-channel data | `session.diff`, `todo.updated`, `file-watcher.updated`, `command.executed` |
| Connection | `agent-url`, `server.connected`, `server.heartbeat`, `heartbeat`, `done`, `error`, `status` |

`MessagePart` is a discriminated union: `TextPart | ToolPart | ReasoningPart | StepStartPart | StepFinishPart | PlanPart`.

#### 2. Adapter Layer (`apps/web/lib/ai-elements-adapter.ts`)

Transforms SSE data into `UIMessage` — the single source of truth for all message state:

```typescript
interface UIMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  toolInvocations?: ToolInvocation[]  // mapped from ToolPart
  reasoning?: string[]                 // mapped from ReasoningPart
  type?: 'error' | 'pr-notification' | 'permission' | 'question'
  promptData?: { id, permission?, description?, text?, status? }
  elapsed?: number                     // wall-clock ms (set on stream complete)
  errorCategory?: 'transient' | 'persistent' | 'user-action' | 'fatal'
  retryable?: boolean
}
```

Key adapter functions:
- `processPartUpdated()` — Main SSE handler, switches on part type (text, tool, reasoning, plan, step-*)
- `createToolInvocation()` — Maps `ToolPart` → `ToolInvocation` with state mapping: pending→partial-call, running→call, completed→result, error→error
- `streamTextDelta()` / `setMessageContent()` — Text content updates
- `createPermissionMessage()` / `createQuestionMessage()` — Interactive prompt messages
- `mapApiMessagesToUI()` — History reload from API (parses JSON `parts` field)
- `classifyError()` — Categorizes errors (rate-limit/network → transient+retryable, credit → user-action)
- `mapToolState()` — Maps ToolInvocation state → Tool component status (pending/in_progress/completed/failed)

#### 3. Event Handlers (`apps/web/app/(app)/dashboard/hooks/sse-event-handlers.ts`)

Pure functions (no hooks) that dispatch SSE events to React state. All take an `SSEHandlerContext` with setters and refs:

- `handleMessagePartUpdated()` — For text/reasoning: accumulates in refs + schedules flush (batched). For tools: immediate `setMessages`. Extracts step costs from `step-finish` parts.
- `handleDoneOrIdle()` — Finalizes streaming message with accumulated text/reasoning + elapsed time, resets streaming state.
- `handleSessionError()` / `handleGenericError()` — Creates classified error messages.
- `handlePermissionAsked()` / `handlePermissionResolved()` — Permission prompt lifecycle.
- `handleQuestionAsked()` / `handleQuestionResolved()` — Question prompt lifecycle.
- `handleAgentUrl()` — Legacy: previously stored the in-VM sandbox-agent URL. With the harness in the Worker the new backend never emits `agent-url`, so this handler is effectively dormant.

### Key UI Patterns

**Streaming optimization**: Text and reasoning use mutable refs (`assistantTextRef`, `reasoningRef`) for accumulation with scheduled flushes via `scheduleFlush()`. Tool updates bypass this and trigger immediate `setMessages`. This prevents excessive re-renders during fast token streaming. Client-side stall timer (90s) treats stalls with existing content as graceful done, not error.

**Cross-tab sync**: `BroadcastChannel` syncs session lifecycle (created/deleted/streaming/stopped). When Tab B receives `session-streaming` for its currently-viewed session, it calls `resumeStream()` to independently subscribe to the live SSE stream.

**Events inspector**: SSE events are captured in `eventsStore` (singleton, per-session arrays capped at 500). Text and reasoning streaming deltas (`message.part.updated` with `part.type === 'text' | 'reasoning'`) are excluded — only tool calls, status events, session lifecycle events, and errors are stored. The `EventsSection` component in the Overview tab groups consecutive same-type streaming events and displays the rest as a collapsible list with colored dots by category, timestamps, and expand-to-JSON.

**Permission/Question prompts**: Rendered as inline `system` role messages with `type: 'permission'` or `type: 'question'`. Status tracked in `promptData.status` field ('pending' → 'granted'/'denied'/'replied'/'rejected').

**Sub-agent navigation**: Uses a stack-based model (`subagentStack` state in DashboardMessages). `SubagentTool` component has an `onNavigate` callback that pushes to the stack. Back button pops. When stack is non-empty, `SubagentView` replaces the entire message list. Detection via `isSubagentToolInvocation()` in `lib/subagent/utils.ts`.

**Tool rendering**: `Tool` component auto-detects icons from tool name (read/write/bash patterns). Shows collapsible input/output with status badge and duration. `mapToolState()` converts internal states to component-expected states.

**Todo/Task tracking**: `todo.updated` SSE events populate `sessionTodos`. When a todo-related tool appears in the message stream, `TodoProgress` is rendered inline instead of the tool card. `TodoRead` tools are suppressed.

**Error classification**: Errors are classified by `classifyError()` into categories. Transient errors (rate limit, network, overload) are marked retryable. User-action errors (credit balance) are not. This drives UI treatment (retry button visibility, styling).

## Backend Architecture

### API Layer (Cloudflare Worker)

The API is a Cloudflare Worker (`apps/api/`) with Hono routing.

| File | Purpose |
|------|---------|
| `routes/chat.ts` | Hono router for `/chat/*`. Mounts the message stream + auxiliary routes. |
| `routes/chat-message-stream.ts` | `POST /chat/:sessionId` — drives one full turn end-to-end. |
| `routes/chat-auxiliary-routes.ts` | `stop`, `subscribe` (no-op idle), `messages`, `tasks`, `git/state`, retry/pause/resume. |
| `routes/chat-session-helpers.ts` | Persisting system-role error messages + cloning helpers. |
| `routes/sessions.ts` | Session CRUD (create, list, get, delete). |
| `routes/sandbox.ts` | Sandbox provisioning + lifecycle. |
| `routes/models.ts` | Model listing — backed by `agent-registry`. |
| `routes/git.ts` | Git operations (diff, commit, PR creation). |
| `routes/users.ts` | `GET /users/me` (JWT), `GET /users/:id` (self or service), `POST /users/upsert` (service only). |
| `middleware/auth.ts` | Bearer parsing: session JWT → `authKind: 'user'` + `userId`, or `API_SECRET` → `authKind: 'service'`. |
| `lib/session-authorization.ts` | `requireJwtUserId`, `requireSessionOwner` — user-scoped routes must use the session JWT, not `API_SECRET` alone. |
| `lib/api-schemas.ts` | Zod request bodies + `parseJsonBody` (shape validation; auth remains separate). |
| `lib/chat-runner.ts` | Re-exports `runChatTurn` from `acp-chat-runner`. |
| `lib/acp-chat-runner.ts` | ACP JSON-RPC turn over bridge WebSocket. |
| `lib/chat-workspace.ts` | Sandbox + repo provisioning for a turn (waits for sandbox, clones if needed). |
| `lib/chat-history.ts` | Persisted Ship messages → `{role, content}[]` for prompt assembly. |
| `lib/chat-stream-helpers.ts` | Tiny SSE writers: `writeStatus`, `writeError`, `writeDone`, `writeSessionIdle`. |
| `lib/agent-chunks/` | ACP JSON-RPC notifications → Ship SSE (`createAcpNotificationTranslator`). |
| `lib/agent-registry.ts` | UI persona + model picker entries. Default persona is `ship`. |
| `lib/e2b.ts` | Raw E2B SDK wrappers used by `chat-workspace` and `routes/sandbox`. |
| `durable-objects/session.ts` | Session Durable Object — message + meta + event SQLite, websocket fanout. |

### ACP notification → Ship SSE translation

`lib/agent-chunks/createAcpNotificationTranslator` maps ACP session/update-style
notifications (heuristic text extraction) into `message.part.updated` SSE. Token
totals on `step-finish` are often zero — ACP backends do not always report usage
to the Worker.

| Source | Ship SSE event |
|--------|----------------|
| `session/update` (text delta) | `message.part.updated` |
| RPC error | `session.error` |
| End of turn | `step-finish` (zeros) + `session.idle` + `done` |

### Worker authentication and API clients

- **`API_SECRET` (`authKind: 'service'`)** — Trusted server-to-server only (for example OAuth `POST /users/upsert` and `POST /accounts/github` from the Next.js app). It does **not** identify an end user; user-scoped routes must not authorize on this token alone.
- **Session JWT (`authKind: 'user'`)** — The web app forwards the encrypted session cookie as `Authorization: Bearer <jwt>` from `apps/web/lib/api/server.ts` (SSR) and via `setApiToken` + SWR on the client. The Worker sets `userId` from the JWT. Prefer **`GET /users/me`** and JWT-scoped routes **without** embedding `userId` in URLs or bodies.
- **`requireSessionOwner`** — Mutations on chat sessions verify `chat_sessions.user_id` in D1 against the JWT subject.
- **Zod (`lib/api-schemas.ts`)** — Shared `parseJsonBody` + schemas for shape validation. **Authorization is explicit** (JWT vs service + ownership checks), not inferred from validated fields.

## Code Style & Conventions

- **TypeScript**: Strict mode enabled. Exhaustive switch cases narrow to `never` in default branches.
- **Module system**: ESM
- **Formatting**: Prettier (`pnpm format`)
- **Linting**: ESLint at the repo root (`eslint.config.mjs`) plus per-package configs where needed. Run `pnpm lint` (Turbo runs each workspace’s `lint` script). Rules include **`max-lines`** (300, excluding blanks/comments) and **`max-lines-per-function`** (100) for `apps/web`, `apps/api`, and `packages/*`. Prefer smaller, composable modules instead of growing past these limits.
- **Package manager**: `pnpm` (not npm or yarn)
- **Path aliases**: `@/` for web app imports (e.g., `@/lib/sse-types`)
- **Exports**: Prefer named exports over default exports
- **Extensions**: React components use `.tsx`, pure logic uses `.ts`
- **File size limits**:
  - Components: under ~300 lines
  - Hooks: under ~300 lines
  - Functions: under ~100 lines
  - If a file exceeds these limits, break it into smaller focused modules
- **API routes**: `app/api/` (web) or `src/routes/` (api worker)
- **Chat route layout (Worker)**: `chat.ts` wires the app; the main POST/SSE handler is **`chat-message-stream.ts`** (`handleChatMessageStream`); subscribe/stop/messages/tasks/git/question routes are in **`chat-auxiliary-routes.ts`**; shared timeouts and error persistence helpers live in **`chat-session-helpers.ts`**.

### Composition & file size

Keep UI and hooks **small and composable** (atomic-style building blocks, clear boundaries). When a component or hook grows past the lint thresholds, split by responsibility (presentational vs state, subcomponents, pure helpers) rather than disabling rules.

### TSDoc and public APIs

**Use TSDoc** (`/** ... */`) on every **exported** symbol — types,
interfaces, classes, functions, top-level constants. Tags we actually use:

- `@param` for non-obvious arguments
- `@returns` when the return needs context
- `@remarks` for invariants and security notes (e.g. "identity comes from
  the JWT, not the body")
- `@example` for usage shapes that are easier shown than described
- `@packageDocumentation` at the top of files that are themselves a small
  cohesive unit (one of the chunk handlers, the env helper, etc.)

Avoid noisy comments on self-explanatory private code; small private
helpers can stay uncommented if their name is honest.

When in doubt, look at `packages/acp-bridge/src/server.ts`, `packages/sandbox/src/interface.ts`,
`apps/api/src/lib/agent-chunks/acp-translator.ts`, and `apps/web/lib/github.ts` for the
in-repo style.

### React: effects and data flow

Follow [You Might Not Need an Effect](https://react.dev/learn/you-might-not-need-an-effect): **derive state during render** when it is fully determined by props or existing state; handle user actions in **event handlers**; use **`key`** to reset UI when switching entities; reserve **`useEffect` for synchronization** with external systems (subscriptions, timers, third-party widgets, non-React data sources). Prefer **SWR** (or similar) for server data instead of manual `fetch` + `useEffect` when a hook already exists—for example connector settings use `useConnectors` / mutations rather than one-off effects.

## Environment Variables

### API URL conventions

`apps/web` resolves the API base URL in this order, falling back so local dev
"just works" without an `.env.local`:

1. `NEXT_PUBLIC_API_URL` — explicit override (set this on every preview /
   production deploy).
2. `API_BASE_URL` — server-side override.
3. `http://localhost:8787` — built-in fallback that matches `wrangler dev`'s
   default port.

So:

| Environment | What you should set | What runs |
|-------------|---------------------|-----------|
| Local (`pnpm dev`) | nothing — defaults are correct | web → `localhost:8787` |
| Dev / preview deploy | `NEXT_PUBLIC_API_URL=<dev-worker-url>` | web → dev worker |
| Production | `NEXT_PUBLIC_API_URL=<prod-worker-url>` | web → prod worker |

### Web App (`apps/web/.env.local`)

```env
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
SESSION_SECRET=...
API_SECRET=...
NEXT_PUBLIC_APP_URL=http://localhost:3000
# NEXT_PUBLIC_API_URL=  # leave unset locally; set on preview/prod deploys
```

### API Worker (`apps/api/.dev.vars`)

```env
ANTHROPIC_API_KEY=...
API_SECRET=...
SESSION_SECRET=...        # must match the web app
E2B_API_KEY=...
OPENAI_API_KEY=...        # optional (Codex API-key auth)
# CODEX_AUTH_JSON=...       # optional (personal ChatGPT sub — cat ~/.codex/auth.json)
# CODEX_ACCESS_TOKEN=...    # optional (enterprise Codex — see developers.openai.com/codex/auth)
ALLOWED_ORIGINS=http://localhost:3000
```

## MCP Servers

MCP support is **not wired into the new harness yet**. Tools today are the
in-process AI SDK tools described in [Agent Architecture](#agent-architecture).
Adding MCP-as-tools is straightforward future work — wrap an MCP client in a
small adapter that mints AI SDK `tool()`s, then merge them into
`buildToolSet()`.

## Browser Testing with agent-browser + Brave CDP

### Setup (auto-connect — preferred)

Auto-discover and connect to your running Brave/Chrome:

```bash
agent-browser --auto-connect open http://localhost:3000
```

Or set the env var to always auto-connect:

```bash
export AGENT_BROWSER_AUTO_CONNECT=1
agent-browser open http://localhost:3000
```

### Setup (manual CDP)

1. Quit Brave Browser completely
2. Relaunch with remote debugging:
   ```bash
   "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser" --remote-debugging-port=9222 &
   ```
3. Verify CDP: `curl -s http://localhost:9222/json/version`
4. Connect: `agent-browser connect 9222`

### Testing a chat session

1. `agent-browser open http://localhost:3000`
2. `agent-browser snapshot -i` (get interactive elements)
3. `agent-browser click @e6` (select repo)
4. `agent-browser fill @e5 "repo overview"`
5. `agent-browser click @e7` (submit)
6. `agent-browser screenshot /tmp/test.png` (capture state)
7. `agent-browser console` (check for errors)
8. `agent-browser eval "performance.getEntriesByType('resource').filter(r => r.name.includes('chat'))"` (check network)

## Testing

### Real-time API log monitoring

Use `wrangler tail` to stream production logs in real time:

```bash
cd apps/api
npx wrangler tail ship-api-production
```

This shows all `console.log`/`console.warn`/`console.error` output from the Worker, including:
- Sandbox provisioning steps
- Chat route events (`[chat:...]`)
- D1 write-through warnings
- SSE streaming lifecycle

### Testing CUJs (Critical User Journeys)

**New session flow:**
1. Navigate to `localhost:3000` (or production URL)
2. Select a repo from the dropdown
3. Type a prompt and click the send button (arrow icon, bottom-right of composer)
4. Watch SSE stream in network tab (filter by `EventStream`)
5. Verify sandbox provisions, agent starts, and messages stream

**Returning to an old session:**
1. Click an existing session in the left sidebar
2. Messages should load from D1 if the DO was evicted
3. Sending a new prompt should re-provision sandbox if needed

**Settings page:**
1. Navigate to `/settings`
2. Connectors section should load without errors
3. GitHub connector shows connected/disconnected status

### Verifying D1 message persistence

```bash
cd apps/api
npx wrangler d1 execute ship-db --remote --command "SELECT count(*) FROM chat_messages"
npx wrangler d1 execute ship-db --remote --command "SELECT * FROM chat_messages ORDER BY created_at DESC LIMIT 5"
```

## PR Guidelines

- Use conventional commits: `feat:`, `fix:`, `docs:`, `chore:`, etc.
- Keep PRs focused on a single concern
- Include description of changes and testing done
