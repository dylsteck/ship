# Ship

## What This Is

A background agent platform for building software. Sign in with GitHub, chat with an AI agent (powered by OpenCode SDK) that works on code in sandboxed environments. Tasks come from Linear issues or chat conversations. Sessions contain conversations with one or many tasks — the agent writes code, runs tests, and deploys while you focus on other things.

## Core Value

The agent works autonomously in the background on real coding tasks while you do other things — you come back to working code, not just suggestions.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] GitHub OAuth authentication
- [ ] Session management with persistent state
- [ ] Chat interface with AI agent (OpenCode SDK)
- [ ] E2B sandbox provisioning per session
- [ ] Code-server (VS Code) in sandbox
- [ ] Terminal access in sandbox
- [ ] Headless browser testing (screenshots, results)
- [ ] Task creation from chat
- [ ] Linear integration (sync issues as tasks)
- [ ] Vercel integration (deployments)
- [ ] GitHub repo access (clone, commit, PR)
- [ ] Screenshot capture and storage
- [ ] File upload/storage
- [ ] Session history and state persistence
- [ ] UI matching Ramp Inspect layout and design

### Out of Scope

- Multiplayer/collaboration features — single-user focus for v1
- VNC/live browser view — headless with screenshots is sufficient
- Slack integration — defer to v2
- Mobile app — web-first

## Context

**Existing codebase:** Scrapping most of it. Fresh start with Turborepo monorepo structure.

**UI framework:** shadcn/ui with Base UI foundation (2026 release)

**Architecture reference:** Ramp Inspect's background agent architecture
- Cloudflare Workers + Durable Objects for API layer
- D1 for metadata, auth, sessions
- R2 for screenshots, files
- E2B for sandboxes (TypeScript-native, simpler than Modal)
- OpenCode SDK as the AI agent runtime

**Key insight:** Sessions contain conversations, tasks are units of work within sessions. One session can have one task or many — flexible model.

**Browser testing:** Headless browser (playwright MCP or similar) with screenshots rather than live VNC view.

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
| E2B over Modal | TypeScript-native, no Python backend complexity | — Pending |
| Cloudflare Workers + DO | Follow Ramp's proven architecture | — Pending |
| Turborepo monorepo | Clean separation of apps/packages | — Pending |
| shadcn/ui + Base UI | Modern component foundation | — Pending |
| Headless browser over VNC | Simpler, screenshots sufficient for use case | — Pending |
| No multiplayer v1 | Single-user focus, add later | — Pending |

---
*Last updated: 2025-02-01 after initialization*
