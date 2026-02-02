# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-01)

**Core value:** Agent works autonomously in the background on real coding tasks while you do other things
**Current focus:** Phase 3 - Execution Layer

## Current Position

Phase: 3 of 5 (Execution Layer)
Plan: 7 of 7 in current phase
Status: Phase complete
Last activity: 2026-02-02 — Completed 03-07-PLAN.md (End-to-End Integration)

Progress: [████████░░] 75%

## Performance Metrics

**Velocity:**

- Total plans completed: 14
- Average duration: 5.0 min
- Total execution time: 1.42 hours

**By Phase:**

| Phase                        | Plans | Total    | Avg/Plan |
| ---------------------------- | ----- | -------- | -------- |
| 01-foundation-authentication | 5     | 13 min   | 2.6 min  |
| 02-stateful-core             | 2     | 9 min    | 4.5 min  |
| 03-execution-layer           | 7     | 65.5 min | 9.4 min  |

**Recent Trend:**

- Last 5 plans: 03-02 (13min), 03-04 (6min), 03-05 (9.5min), 03-06 (5min), 03-07 (4min)
- Trend: Phase 3 complete - integration plans faster than infrastructure setup

_Updated after each plan completion_

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Roadmap: 5-phase structure following research recommendations (Foundation → Stateful Core → Execution → UI → Integrations)
- Architecture: One Durable Object per session (not global singleton) to avoid bottlenecks
- Sandbox lifecycle: 5-minute idle timeout from day one to control costs
- Monorepo: Turborepo 2.x with pnpm workspaces for Next.js + Cloudflare Workers
- Tailwind v4: CSS-first configuration using @theme directive (not JS config)
- TypeScript configs: Relative path extends (not package name resolution)
- Database: D1 with Auth.js-compatible schema for users, accounts, sessions
- API: Hono framework on Cloudflare Workers with D1 bindings
- Types: DTO pattern to prevent leaking sensitive data in API responses
- Timestamps: Unix timestamps (seconds) for all date fields in D1
- OAuth: Arctic library for edge-compatible GitHub OAuth flow
- Sessions: jose for JWT encryption (7-day expiry, httpOnly cookies)
- Security: Data Access Layer (DAL) pattern for session verification in Server Components
- Middleware: Next.js 16 proxy.ts for optimistic route protection (not security boundary)
- Environment: Multi-environment (dev/staging/prod) in wrangler.toml from day one
- Secrets: wrangler secret put for production, .dev.vars for local development
- LLM API: ANTHROPIC_API_KEY configured as Worker secret for Phase 3 agent operations
- UI Theme: Light mode as default (not system preference) with next-themes
- Route groups: (auth) for public pages, (app) for protected pages in Next.js
- Protected pages: Call verifySession() at top for defense in depth security
- Session management: Soft delete pattern (status=deleted) for data retention
- DTO pattern: Map snake_case DB columns to camelCase API responses
- Server/Client split: Page fetches data (Server), interactions handled by Client Component
- Repo selection: Text inputs in Phase 2, GitHub repo selector in Phase 3
- Agent runtime: OpenCode SDK provides complete agent runtime (Build/Plan modes, tool execution)
- Task creation: Tasks created from agent todo.updated events, not manual user creation
- Event streaming: Worker streams to client via SSE, DO handles persistence and WebSocket broadcast
- Environment detection: SDK wrapper detects Node.js vs Cloudflare Workers for client initialization
- E2B sandboxes: betaCreate() with autoPause enabled, 5-minute idle timeout for cost control
- Sandbox lifecycle: One sandbox per session, ID persists in session_meta table across hibernation
- Sandbox provisioning: Auto-provision on session creation for seamless UX
- Git workflow: User's GitHub token for all operations, never stored in sandbox
- Branch naming: ship-{slug}-{timestamp}-{sessionId} format for uniqueness
- Pull requests: Draft by default, user marks ready for review
- Git attribution: All commits use user's name/email from GitHub
- PR tracking: SessionDO stores PR state (number, URL, draft status) for UI display and persistence
- Auto-PR timing: Created on first commit only, using markFirstCommit() boolean transition pattern
- PR panel: Shows three states (no PR, draft, ready) with Mark Ready button in session side panel
- Git error handling: Wrapped in try/catch to log errors without failing agent execution
- Model selection: Global user default with per-session override, stored in user_preferences table
- Default AI model: anthropic/claude-sonnet-4-20250514 when no preference set
- Settings pattern: Server page fetches session, client component handles interactions and API calls
- User preferences: Key-value store with composite PK (user_id, key) for flexible settings storage
- Error handling: Four categories (transient, persistent, user-action, fatal) with auto-retry for transient
- Retry strategy: Exponential backoff (2s, 4s, 8s) with jitter (0-100ms) to prevent thundering herd
- Error UI: Inline chat display (not modals) with category-based styling and action buttons
- Error sanitization: Remove tokens/API keys from error messages before displaying to users
- Agent orchestration: SessionDO owns lifecycle, AgentExecutor handles logic with callbacks for errors/status
- Task detection: Pattern matching on action verbs to trigger git workflow automatically
- Dual communication: SSE for streaming responses, WebSocket for real-time status updates
- File change tracking: Detect write/edit/create tool calls to determine if commit needed

### Pending Todos

None yet.

### Blockers/Concerns

None yet.

## Session Continuity

Last session: 2026-02-02
Stopped at: Completed 03-07-PLAN.md (End-to-End Integration) - Phase 3 complete, ready for Phase 4
Resume file: None

## Phase 1 Summary

**Foundation & Authentication** — 5 plans, 3 waves

Delivered:

- Turborepo monorepo with Next.js 16 + Cloudflare Worker API
- D1 database with users/accounts/sessions tables
- GitHub OAuth flow with Arctic and jose JWT sessions
- Login, onboarding, and dashboard pages
- Theme system (light default)
- Environment configuration with LLM API key setup

Human verification needed before Phase 2:

- Complete GitHub OAuth flow end-to-end
- Session persistence across browser restarts
- LLM API key accessibility (will verify in Phase 3)
