# AGENTS.md

This document provides context for AI agents working on this codebase.

## Setup

```bash
pnpm install
pnpm dev
```

## Build

```bash
pnpm build        # Build all apps
pnpm type-check   # Type check only
```

## Deployment

### Web App (Next.js) — Vercel

Deploy from the repository root:

```bash
vercel             # Preview deploy
vercel --prod      # Production deploy
```

The Vercel project is configured to build `apps/web`.

### API (Cloudflare Worker) — Wrangler

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
npx wrangler secret put CURSOR_API_KEY      # Optional, for Cursor agent
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
│   │   ├── lib/                # Frontend business logic
│   │   │   ├── ai-elements-adapter.ts  # SSE → UIMessage adapter
│   │   │   ├── sse-types.ts            # SSE event type definitions
│   │   │   ├── sse-parser.ts           # SSE event parser
│   │   │   └── api/                    # API client functions
│   │   └── components/         # React components
│   └── api/                    # Cloudflare Worker (backend)
│       └── src/
│           ├── routes/
│           │   └── chat.ts             # SSE streaming chat endpoint
│           ├── lib/
│           │   ├── sandbox-agent.ts    # sandbox-agent SDK wrapper
│           │   ├── agent-registry.ts   # Agent config registry
│           │   ├── event-translator.ts # UniversalEvent → Ship SSE translator
│           │   └── e2b.ts              # E2B sandbox management
│           ├── durable-objects/
│           │   └── session.ts          # Session Durable Object
│           └── env.d.ts                # Environment type definitions
└── packages/
    └── ui/                     # Shared UI components (@ship/ui)
```

## Agent Architecture

Ship uses **sandbox-agent** (by Rivet) as its agent runtime, which supports multiple coding agents through the Agent Client Protocol (ACP).

### How it works

1. An E2B sandbox is provisioned for each session
2. `sandbox-agent` binary is installed inside the sandbox
3. The requested agent (Claude Code, OpenCode, Cursor, Codex) is installed via `sandbox-agent install-agent <name>`
4. `sandbox-agent server` exposes an HTTP/SSE API inside the sandbox
5. The Cloudflare Worker connects to the sandbox-agent API and translates events to Ship's SSE format

### Supported Agents

| Agent | sandbox-agent name | Required Env Var | Modes |
|-------|-------------------|------------------|-------|
| Claude Code | `claude` | `ANTHROPIC_API_KEY` | default, plan |
| OpenCode | `opencode` | — | build, plan |
| Cursor | `cursor` | `CURSOR_API_KEY` | agent, plan, ask |
| Codex | `codex` | `OPENAI_API_KEY` | read-only, auto, full-access |

Agent configs are defined in `apps/api/src/lib/agent-registry.ts`.

### Key API Files

- **`sandbox-agent.ts`** — Wrapper around the sandbox-agent SDK. Handles server startup, client connection, session creation, prompting, and cancellation.
- **`event-translator.ts`** — Stateful translator (`EventTranslatorState`) that maps sandbox-agent's `UniversalEvent` schema to Ship's SSE events (`message.part.updated`, `session.idle`, `session.error`, etc.).
- **`agent-registry.ts`** — Registry of supported agents with their configs (required env vars, modes, sandbox-agent names).

### Event Flow

```
User prompt → Cloudflare Worker → sandbox-agent (HTTP) → ACP agent (stdio)
                                                              ↓
Frontend ← SSE stream ← EventTranslatorState ← UniversalEvents
```

## Code Style

- **TypeScript**: Strict mode enabled
- **Module system**: ESM
- **Formatting**: Prettier (`pnpm format`)
- **Linting**: ESLint with Next.js config
- **File size**: Keep files and functions small and focused
  - Components should be under ~300 lines
  - Hooks should be under ~300 lines
  - Functions should be under ~100 lines
  - If a file exceeds these limits, break it into smaller, focused components/hooks

## Key Conventions

- Use `pnpm` (not npm or yarn)
- Import with `@/` path alias (e.g., `@/lib/db/client`)
- API routes in `app/api/` (web) or `src/routes/` (api worker)
- React components use `.tsx` extension
- Prefer named exports over default exports

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
CURSOR_API_KEY=...         # Optional, for Cursor agent
```

## MCP Servers

MCP (Model Context Protocol) servers are configured and loaded into agent sessions via sandbox-agent's `sessionInit.mcpServers`:

- **Grep**: GitHub code search — `https://mcp.grep.app`
- **DeepWiki**: Deep documentation search — `https://mcp.deepwiki.com/mcp`
- **Context7**: Library documentation — `https://mcp.context7.com/mcp`
- **Exa**: Web search — `https://mcp.exa.ai/mcp`

## Testing

(To be added)

## PR Guidelines

- Use conventional commits: `feat:`, `fix:`, `docs:`, `chore:`, etc.
- Keep PRs focused on a single concern
- Include description of changes and testing done
