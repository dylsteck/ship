# AGENTS.md

This document provides context for AI agents working on this codebase.

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
pnpm type-check   # Type check only
```

### Deployment

#### Web App (Next.js) — Vercel

Deploy from the repository root:

```bash
vercel             # Preview deploy
vercel --prod      # Production deploy
```

The Vercel project is configured to build `apps/web`.

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
npx wrangler secret put OPENAI_API_KEY      # Optional, for Codex agent
```

## Ports

- Web App: `http://localhost:3000`
- API (local): `http://localhost:8787`

## Project Structure

```
ship/
├── apps/
│   ├── web/                    # Next.js App Router (frontend)
│   │   ├── app/                # Pages and routes
│   │   │   └── (app)/dashboard # Dashboard with chat UI
│   │   │       ├── dashboard-client.tsx       # Top-level orchestrator
│   │   │       ├── components/
│   │   │       │   ├── dashboard-messages.tsx  # Message list rendering
│   │   │       │   ├── composer/              # Input + model/mode selection
│   │   │       │   ├── right-sidebar.tsx      # Stats, tasks, changes, VCS
│   │   │       │   ├── subagent-view.tsx      # Nested agent session viewer
│   │   │       │   ├── permission-prompt.tsx  # Permission request UI
│   │   │       │   └── question-prompt.tsx    # Agent question UI
│   │   │       └── hooks/
│   │   │           ├── use-dashboard-chat.ts  # Core state management + WebSocket
│   │   │           ├── use-dashboard-sse.ts   # SSE streaming handler
│   │   │           ├── sse-event-handlers.ts  # Pure event handler functions
│   │   │           ├── use-session-sync.ts    # URL/model/repo sync effects
│   │   │           ├── use-right-sidebar.ts   # Sidebar open/close state
│   │   │           └── use-subagent-stream.ts # Sub-agent event streaming
│   │   ├── lib/                # Frontend business logic
│   │   │   ├── ai-elements-adapter.ts  # SSE → UIMessage adapter
│   │   │   ├── sse-types.ts            # SSE event type definitions
│   │   │   ├── sse-parser.ts           # SSE event parser
│   │   │   ├── subagent/utils.ts       # Sub-agent detection + extraction
│   │   │   └── api/                    # API client functions
│   │   └── components/         # Shared React components
│   └── api/                    # Cloudflare Worker (backend)
│       └── src/
│           ├── routes/
│           │   ├── chat.ts             # SSE streaming chat endpoint
│           │   ├── sessions.ts         # Session CRUD
│           │   ├── sandbox.ts          # Sandbox management
│           │   ├── desktop.ts          # Desktop stream start/stop/status
│           │   ├── models.ts           # Model listing
│           │   └── git.ts              # Git operations
│           ├── lib/
│           │   ├── sandbox-agent.ts    # sandbox-agent SDK wrapper (with pre-install detection)
│           │   ├── desktop.ts          # E2B desktop stream helpers (@e2b/desktop)
│           │   ├── agent-registry.ts   # Agent config registry
│           │   ├── event-translator.ts # UniversalEvent → Ship SSE translator
│           │   └── e2b.ts              # E2B sandbox management (custom template support)
│           ├── durable-objects/
│           │   └── session.ts          # Session Durable Object
│           └── env.d.ts                # Environment type definitions
└── packages/
    └── ui/                     # Shared UI components (@ship/ui)
        └── src/
            ├── ai-elements/    # AI-specific rendering components
            └── *.ts            # Base shadcn components + hooks
```

## Agent Architecture

Ship uses **sandbox-agent** (by Rivet) as its agent runtime, which supports multiple coding agents through the Agent Client Protocol (ACP).

### How it works

1. An E2B sandbox is provisioned for each session using a custom template (`e2b/Dockerfile`) that extends `e2bdev/desktop:latest`
2. The custom template has `sandbox-agent` binary and all agent binaries (claude, opencode, codex) pre-installed for fast startup
3. If binaries are missing (non-custom template fallback), they are installed at runtime
4. `sandbox-agent server` exposes an HTTP/SSE API inside the sandbox on port 3000
5. The Cloudflare Worker connects to the sandbox-agent API and translates events to Ship's SSE format
6. Users can open an interactive desktop stream via the Desktop tab (noVNC via `@e2b/desktop` SDK)

### Supported Agents

| Agent | sandbox-agent name | Required Env Var | Modes |
|-------|-------------------|------------------|-------|
| Claude Code | `claude` | `ANTHROPIC_API_KEY` | default, plan, acceptEdits, bypassPermissions |
| OpenCode | `opencode` | — | build, plan |
| Codex | `codex` | `OPENAI_API_KEY` | read-only, auto, full-access |

Agent configs are defined in `apps/api/src/lib/agent-registry.ts`. Default agent is `opencode`.

### Key API Files

- **`sandbox-agent.ts`** — SDK wrapper. Functions: `startSandboxAgentServer`, `connectToSandboxAgent`, `createAgentSession`, `promptAgent`, `cancelAgent`, `subscribeToSessionEvents`. Caches client instances per sandbox URL. Checks for pre-installed binaries before installing (custom template fast path).
- **`desktop.ts`** — Desktop stream helpers using `@e2b/desktop` SDK. Functions: `startDesktopStream`, `stopDesktopStream`.
- **`e2b.ts`** — E2B sandbox provisioning. Supports custom template via `E2B_TEMPLATE_ID` constant.
- **`event-translator.ts`** — Stateful translator class (`EventTranslatorState`) that maps sandbox-agent's `UniversalEvent` schema to Ship's SSE events. Tracks text/reasoning accumulators, tool call state, and file changes across a session stream.
- **`agent-registry.ts`** — Registry of `AgentConfig` objects with `getAgent()`, `listAgents()`, and `getDefaultAgentId()` helpers.

### Event Flow

```
User prompt → Cloudflare Worker → sandbox-agent (HTTP) → ACP agent (stdio)
                                                              ↓
Frontend ← SSE stream ← EventTranslatorState ← UniversalEvents
```

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
- `handleAgentUrl()` — Stores sandbox-agent URL (persisted to localStorage).

### Key UI Patterns

**Streaming optimization**: Text and reasoning use mutable refs (`assistantTextRef`, `reasoningRef`) for accumulation with scheduled flushes via `scheduleFlush()`. Tool updates bypass this and trigger immediate `setMessages`. This prevents excessive re-renders during fast token streaming.

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
| `routes/chat.ts` | SSE streaming endpoint. Creates/resumes sandbox-agent sessions, subscribes to events, translates via `EventTranslatorState`, streams to client. |
| `routes/sessions.ts` | Session CRUD (create, list, get, delete) |
| `routes/sandbox.ts` | Sandbox lifecycle management |
| `routes/models.ts` | Available model listing |
| `routes/git.ts` | Git operations (diff, commit, PR creation) |
| `lib/sandbox-agent.ts` | SDK wrapper around `sandbox-agent` npm package. Handles server startup in E2B, client connection (cached), session create/resume/prompt/cancel. |
| `lib/event-translator.ts` | Stateful `EventTranslatorState` class. One instance per streaming session. |
| `lib/agent-registry.ts` | Agent config definitions and lookup functions. |
| `lib/e2b.ts` | E2B sandbox provisioning and lifecycle. |
| `durable-objects/session.ts` | Session Durable Object for persistent session state across Worker invocations. |

### Event Translation

`EventTranslatorState` maps sandbox-agent's ACP `UniversalEvent` types to Ship SSE events:

| UniversalEvent | Ship SSE Event(s) |
|---------------|-------------------|
| `session.started` | `status` (agent-active) |
| `session.ended` | `session.idle` + `done` (normal), or `session.error` (error) |
| `turn.started` | `status` (sending-prompt); resets accumulators |
| `turn.ended` | `session.idle` |
| `item.started` (message) | (internal: ensures messageId) |
| `item.started` (tool_call) | `message.part.updated` (tool, status=pending) |
| `item.delta` (text) | `message.part.updated` (text, with delta) |
| `item.delta` (tool) | `message.part.updated` (tool, status=running) |
| `item.completed` (tool_call) | `message.part.updated` (tool, status=completed/error) |
| `item.completed` (tool_result) | `message.part.updated` (tool, with output) |
| `item.completed` (message) | `message.part.updated` (text/reasoning final) |
| `permission.requested` | `permission.asked` |
| `permission.resolved` | `permission.granted` or `permission.denied` |
| `question.requested` | `question.asked` |
| `question.resolved` | `question.replied` or `question.rejected` |
| `error` | `session.error` |

The translator tracks state: `textAccumulator`, `reasoningAccumulator`, `toolCallMap` (Map of itemId → tool state), `partCounter` for synthetic IDs, and `hasChanges` flag for file-modifying tools.

## Code Style & Conventions

- **TypeScript**: Strict mode enabled. Exhaustive switch cases narrow to `never` in default branches.
- **Module system**: ESM
- **Formatting**: Prettier (`pnpm format`)
- **Linting**: ESLint with Next.js config
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

## Environment Variables

### Web App (`apps/web/.env`)

```env
# Auth
JWE_SECRET=...
ENCRYPTION_KEY=...
NEXT_PUBLIC_GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
```

### API Worker (`apps/api/.dev.vars`)

```env
ANTHROPIC_API_KEY=...
API_SECRET=...
E2B_API_KEY=...
OPENAI_API_KEY=...         # Optional, for Codex agent
```

## MCP Servers

Shared MCP (Model Context Protocol) servers are registered per repo directory through the sandbox-agent SDK before session creation, so they are available across supported agent harnesses:

- **Grep**: GitHub code search — `https://mcp.grep.app`
- **DeepWiki**: Deep documentation search — `https://mcp.deepwiki.com/mcp`
- **Exa**: Web search — `https://mcp.exa.ai/mcp`

## Browser Testing with agent-browser + Brave CDP

### Setup

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

(To be added)

## PR Guidelines

- Use conventional commits: `feat:`, `fix:`, `docs:`, `chore:`, etc.
- Keep PRs focused on a single concern
- Include description of changes and testing done
