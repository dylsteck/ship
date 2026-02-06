---
phase: 03-execution-layer
plan: 01
subsystem: infra
tags: [e2b, sandbox, durable-objects, cloudflare-workers, code-execution]

# Dependency graph
requires:
  - phase: 02-stateful-core
    provides: SessionDO with SQLite storage and message persistence
provides:
  - E2B sandbox wrapper with betaCreate() and auto-pause (5-min timeout)
  - SessionDO sandbox lifecycle methods (provision, resume, pause)
  - Sandbox API routes for creation, status checking, and pausing
  - Auto-sandbox provisioning on session creation
affects: [03-execution-layer, agent-execution, code-execution]

# Tech tracking
tech-stack:
  added: [@e2b/code-interpreter v2.3.3]
  patterns:
    - One sandbox per session with ID persistence in session_meta
    - Auto-pause enabled for cost control (5-minute idle timeout)
    - SandboxManager class for lifecycle encapsulation

key-files:
  created:
    - apps/api/src/lib/e2b.ts
    - apps/api/src/routes/sandbox.ts
  modified:
    - apps/api/src/durable-objects/session.ts
    - apps/api/src/env.d.ts
    - apps/api/src/routes/sessions.ts
    - apps/api/src/index.ts

key-decisions:
  - "Use betaCreate() with autoPause for cost control per RESEARCH.md Pattern 1"
  - "Store sandbox_id and sandbox_status in session_meta table for persistence"
  - "Auto-provision sandbox on session creation for seamless UX"
  - "5-minute idle timeout as default for auto-pause"

patterns-established:
  - "E2B sandbox lifecycle: create → store ID → resume after hibernation → pause on idle"
  - "SessionDO RPC pattern: /sandbox/provision, /sandbox/status, /sandbox/pause, /sandbox/resume"
  - "SandboxManager class encapsulates E2B API calls with error handling"

# Metrics
duration: 15min
completed: 2026-02-01
---

# Phase 03 Plan 01: E2B Sandbox Provisioning Summary

**E2B sandboxes auto-provision on session creation with betaCreate() auto-pause and 5-minute idle timeout for cost control**

## Performance

- **Duration:** 15 min
- **Started:** 2026-02-01T20:44:07Z
- **Completed:** 2026-02-01T20:59:12Z
- **Tasks:** 3
- **Files modified:** 6

## Accomplishments
- E2B SDK integrated with wrapper supporting betaCreate(), Sandbox.connect(), and betaPause()
- SessionDO extended with sandbox lifecycle methods persisting sandbox_id in SQLite
- Session creation automatically provisions E2B sandbox and returns sandboxId in response
- API routes for sandbox management (create, status, pause) with E2B_API_KEY validation

## Task Commits

Each task was committed atomically:

1. **Task 1: Install E2B SDK and create sandbox wrapper** - `94a1f20` (feat)
2. **Task 2: Extend SessionDO with sandbox lifecycle** - `0d7d2f7` (feat)
3. **Task 3: Create sandbox API routes and integrate with sessions** - `c6cdec4` (feat)

## Files Created/Modified
- `apps/api/src/lib/e2b.ts` - E2B wrapper with createSessionSandbox(), resumeSandbox(), pauseSandbox(), SandboxManager class
- `apps/api/src/durable-objects/session.ts` - Added provisionSandbox(), getSandbox(), resumeSandbox(), pauseSandbox() methods with RPC endpoints
- `apps/api/src/env.d.ts` - Added E2B_API_KEY to Env interface
- `apps/api/src/routes/sandbox.ts` - POST /sandbox, GET /sandbox/:id/status, POST /sandbox/:id/pause
- `apps/api/src/routes/sessions.ts` - Auto-provision sandbox on POST /sessions, added GET /sessions/:id/sandbox
- `apps/api/src/index.ts` - Registered sandbox routes, added E2B_API_KEY validation warning

## Decisions Made

1. **Use betaCreate() with autoPause:** Per RESEARCH.md Pattern 1, using betaCreate() instead of create() to enable auto-pause feature for cost control
2. **5-minute idle timeout:** Default timeout aligns with cost control decision from Phase 3 CONTEXT.md
3. **Store sandbox ID in session_meta:** Using session_meta key-value store instead of new table column for flexibility
4. **Auto-provision on session creation:** Sandbox provisioning happens automatically during POST /sessions for seamless UX
5. **SandboxManager pattern:** Encapsulate E2B API calls in class for cleaner SessionDO integration

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

1. **E2B API pattern update:** Initial implementation used older Sandbox.create() pattern. Updated to betaCreate() with autoPause per RESEARCH.md recommendations.
2. **TypeScript type errors:** Hono response status codes required explicit typing. Fixed by using 500 status for error responses.

## User Setup Required

**External services require manual configuration.** E2B API key must be set:

**Environment variables:**
- `E2B_API_KEY` - E2B API key from E2B Dashboard → Settings → API Keys

**Local development (.dev.vars):**
```
E2B_API_KEY=your_e2b_api_key_here
```

**Production (wrangler secret):**
```bash
wrangler secret put E2B_API_KEY
```

**Verification:**
- Start API: `npm run dev` in apps/api
- Check startup logs for E2B_API_KEY validation warning (should not appear if configured)
- Create session: `POST /api/sessions` should return sandboxId in response
- Check sandbox status: `GET /api/sessions/:id/sandbox` should return sandbox info

## Next Phase Readiness

**Ready for next phase:**
- E2B sandbox infrastructure complete
- SessionDO can provision, resume, and pause sandboxes
- Sandbox ID persists across Durable Object hibernation
- API endpoints functional for sandbox management

**For next plans:**
- OpenCode SDK integration (Plan 03-02) can use sandbox for agent execution
- Git operations (Plan 03-03) can run in sandbox environment
- VS Code/terminal access (Plan 03-04) can connect to provisioned sandboxes

**Blockers/concerns:**
- E2B_API_KEY must be configured before sandbox provisioning will work
- Auto-pause is in beta - pricing may change when beta ends
- Sandbox persistence after long idle periods needs monitoring

---
*Phase: 03-execution-layer*
*Completed: 2026-02-01*
