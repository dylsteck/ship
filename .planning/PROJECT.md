# Ship

## What This Is

A background agent platform for building software. Sign in with GitHub, chat with an AI agent (powered by OpenCode SDK) that works on code in sandboxed environments. Tasks come from Linear issues or chat conversations. Sessions contain conversations with one or many tasks — the agent writes code, runs tests, and deploys while you focus on other things.

## Core Value

The agent works autonomously in the background on real coding tasks while you do other things — you come back to working code, not just suggestions.

## Requirements

### Validated

- ✓ GitHub OAuth authentication — v1.0
- ✓ Session management with persistent state — v1.0
- ✓ Chat interface with AI agent (OpenCode SDK) — v1.0
- ✓ E2B sandbox provisioning per session — v1.0
- ✓ Code-server (VS Code) in sandbox — v1.0
- ✓ Terminal access in sandbox — v1.0
- ✓ Task creation from chat — v1.0
- ✓ Linear integration (manual sync, conditional updates) — v1.0
- ✓ GitHub repo access (clone, commit, PR) — v1.0
- ✓ Session history and state persistence — v1.0
- ✓ UI matching Ramp Inspect layout and design — v1.0

### Active

- [ ] Headless browser testing (screenshots, results)
- [ ] Vercel integration (full MCP deployment tools)
- [ ] Screenshot capture and storage
- [ ] File upload/storage
- [ ] Linear issue creation from agent (requires OpenCode SDK custom tool support)

### Out of Scope

- Multiplayer/collaboration features — single-user focus for v1
- VNC/live browser view — headless with screenshots is sufficient
- Slack integration — defer to v2
- Mobile app — web-first

## Context

**Current State:** v1.0 MVP shipped with 5 phases complete (31 plans). Full authentication, session management, agent execution, real-time UI, and external integrations (GitHub, Linear, Vercel MCP structure).

**Codebase:** Turborepo monorepo with Next.js web app and Cloudflare Worker API. 106 files changed, ~17,600 LOC TypeScript.

**Tech Stack:**
- Frontend: Next.js 16, React 19, Tailwind CSS v4, shadcn/ui
- Backend: Cloudflare Workers, Durable Objects (SQLite), D1 database
- Sandbox: E2B (TypeScript-native)
- Agent: OpenCode SDK
- Auth: GitHub OAuth (Arctic), Linear OAuth (Arctic)

**Architecture:** One Durable Object per session with SQLite storage. WebSocket hibernation for real-time updates. E2B sandboxes with 5-minute idle timeout.

**Key Insight:** Sessions contain conversations, tasks are units of work within sessions. One session can have one task or many — flexible model.

**Known Issues:**
- OAuth tokens stored plaintext (encryption recommended for production)
- Phases 2-5 lack formal verification reports (code verified, docs pending)
- E2B sandbox cost monitoring not implemented
- Linear issue creation deferred (requires OpenCode SDK custom tool support)
- Vercel MCP full integration deferred (requires OpenCode SDK MCP support)

## Constraints

- **Sandbox provider**: E2B (TypeScript-native, no Python backend needed)
- **API platform**: Cloudflare Workers + Durable Objects (follow Ramp architecture)
- **Frontend**: Next.js + shadcn/ui (Base UI) in Turborepo
- **AI agent**: OpenCode SDK
- **Auth**: GitHub OAuth only for v1
- **Design**: Must match Ramp Inspect UI exactly (layout, visual design)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| E2B over Modal | TypeScript-native, no Python backend complexity | ✓ Good |
| Cloudflare Workers + DO | Follow Ramp's proven architecture | ✓ Good |
| Turborepo monorepo | Clean separation of apps/packages | ✓ Good |
| shadcn/ui + Base UI | Modern component foundation | ✓ Good |
| Headless browser over VNC | Simpler, screenshots sufficient for use case | — Pending |
| No multiplayer v1 | Single-user focus, add later | ✓ Good |
| One DO per session | Avoid bottlenecks, better isolation | ✓ Good |
| 5-minute sandbox timeout | Cost control from day one | ✓ Good |
| Explicit Linear linking | User control over integrations | ✓ Good |
| User's GitHub token for Git | Never store tokens in sandbox | ✓ Good |
| Four error categories | Transient, persistent, user-action, fatal | ✓ Good |

---
*Last updated: 2026-02-01 after v1.0 milestone*
