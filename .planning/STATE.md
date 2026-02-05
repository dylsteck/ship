# Project State

## Project Reference

**Core value:** Agent works autonomously in the background on real coding tasks while you do other things
**Current focus:** OpenCode UI Parity - Complete

## Current Position

Phase: 100-opencode-ui-parity
Plan: 04 of 4 (SSE Integration)
Status: Phase complete
Last activity: 2026-02-05 — Completed 100-04-PLAN.md

Progress: [██████████████████████] 100% (v1.0 + hotfixes + UI parity complete)

## Performance Metrics

**Velocity:**

- Total plans completed: 31 (v1.0 milestone)
- Average duration: 4.4 min
- Total execution time: 2.25 hours

**By Phase:**

| Phase                        | Plans | Total    | Avg/Plan |
| ---------------------------- | ----- | -------- | -------- |
| 01-foundation-authentication | 5     | 13 min   | 2.6 min  |
| 02-stateful-core             | 7     | 9 min    | 1.3 min  |
| 03-execution-layer           | 7     | 65.5 min | 9.4 min  |
| 04-real-time-ui-visibility   | 6     | 15 min   | 2.5 min  |
| 05-external-integrations     | 6     | 35 min   | 5.8 min  |

**Recent Trend:**

- Last 6 plans: 05-01 (20min), 05-02 (15min), 05-03 (15min), 05-04 (10min), 05-05 (15min), 05-06 (10min)
- Trend: Phase 5 complete - External integrations implemented with conditional Linear updates

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
- SSE parsing: Use parseSSEEvent() from sse-parser for typed event handling in streaming loops
- Activity state: Track tools, reasoning, costs separately using typed SSEToolPart for rich display
- UI fallback: Show ActivityFeed when typed tools available, fallback to ThinkingIndicator otherwise
- Stream cleanup: Clear activity state with 3-second delay after stream ends to let user see final state

### Pending Todos

- Test Phase 100 UI parity features in production
- Verify Big Pickle model works as default
- Monitor ActivityFeed display with real agent sessions
- Deploy and verify all SSE improvements work correctly

### Blockers/Concerns

- None currently - all phases complete including UI parity

### Recent Decisions (99-01)

- OpenCode startup: Export ANTHROPIC_API_KEY separately before running `opencode serve` (more reliable than inline)
- Host binding: Added `--host 0.0.0.0` to ensure server accessible from outside sandbox
- Error handling: Return structured 500 error with details instead of hanging stream
- Diagnostics: Log everything with sandboxId prefix for distributed tracing Worker → E2B → OpenCode

## Session Continuity

Last session: 2026-02-05T03:24:40Z
Stopped at: Completed 100-04-PLAN.md (SSE Integration - Phase complete)
Resume file: .planning/phases/100-opencode-ui-parity/100-04-SUMMARY.md

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

---

## Phase 100: OpenCode UI Parity — Complete

**Status:** ✅ **COMPLETE**  
**Date:** 2026-02-04  
**Plans:** 4 plans across 3 waves

### Deliverables

**100-01: Big Pickle Model Fix**

- Fixed model ID from `opencode/big-pickle` to `big-pickle`
- Updated provider name to "OpenCode Zen"
- OpenCode Zen appears first in dropdown, Big Pickle is default

**100-02: Typed SSE Event System**

- Comprehensive TypeScript types for all SSE events (sse-types.ts)
- Parser functions for safe event handling (sse-parser.ts)
- Type guards and extraction utilities

**100-03: Rich UI Components**

- ToolCard: Collapsible tool display with input/output tabs, status badges
- ActivityFeed: Live activity feed with tool grouping and cost tracking
- SessionPanel: Complete session sidebar with context, cost, todos, diffs
- Added Progress, ScrollArea, Tabs to @ship/ui

**100-04: SSE Integration**

- Dashboard and chat interface use typed SSE parsing
- ActivityFeed integrated into both interfaces
- Real-time tool visibility, cost tracking, session metadata

---

## Phase 99-01: SSE Fixes — Complete

**Status:** ✅ **COMPLETE**  
**Date:** 2026-02-03  
**Plans:** 10 categories of fixes covering OpenCode startup, event streaming, repo cloning, agent initialization, UI enhancements, and comprehensive debug logging

---

## Performance Metrics (Phase 99-01)

- **Duration:** ~25 minutes (discovery, fixes, testing, documentation)
- **Files Modified:** 8 files
- **Commits:** 10
- **Lines Changed:** ~450 insertions/deletions

---

## Known Issues (Post-Deployment)

**What's Working:**

- ✅ OpenCode server startup optimized (health checks in ~2s instead of up to 60s)
- ✅ All debug logging operational
- ✅ Agent executor RPC endpoint added
- ✅ Error reporting enhanced in UI

**Open Investigation Needed:**

- ⚠️ SSE connects successfully but agent may not be processing prompts
- ⚠️ Frontend may show "Starting" indefinitely
- ⚠️ Requires user testing on production deployment
- ✅ Debug endpoint available for monitoring

---

## Next Steps

**Phase 100 Complete!**

All planned phases for v1.0 milestone are now complete:

- ✅ Foundation & Authentication
- ✅ Stateful Core
- ✅ Execution Layer
- ✅ Real-Time UI & Visibility
- ✅ External Integrations
- ✅ OpenCode UI Parity

**Recommended Actions:**

1. Run full end-to-end testing with Big Pickle model
2. Verify ActivityFeed shows tools correctly during agent execution
3. Check SessionPanel displays context, cost, and todos accurately
4. Consider planning v1.1 or v2.0 features
