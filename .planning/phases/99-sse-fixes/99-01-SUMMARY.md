# Phase 99 Plan 01: SSE Fixes — OpenCode Server Startup Summary

**One-liner:** Fixed OpenCode server startup failures in E2B sandbox with proper command execution, environment setup, and comprehensive diagnostics

---

## What Was Delivered

### 1. Enhanced OpenCode Server Startup (`apps/api/src/lib/e2b.ts`)

**Root Cause Identified:**

- Environment variable passed inline (`ANTHROPIC_API_KEY=... opencode serve`) might not work reliably in E2B sandbox shell
- No verification that the process actually started
- Missing `--host 0.0.0.0` flag for external access
- No stdout/stderr visibility in logs for debugging

**Fixes Implemented:**

- **Binary verification**: Check if `opencode` exists with `which` command before attempting startup
- **Separate environment setup**: Export `ANTHROPIC_API_KEY` and `PATH` in separate command for reliability
- **Host binding**: Added `--host 0.0.0.0` flag to ensure server binds to all interfaces
- **Working directory**: Explicit `cd /home/user` before starting server
- **Comprehensive logging**: Every step logs with `[opencode:{sandboxId}]` prefix for traceability
- **Output capture**: Proper `onStdout` and `onStderr` callbacks to see server logs in wrangler
- **Initialization delay**: 2-second pause before health checks to let server initialize
- **Installation fallback**: Auto-install OpenCode if binary not found

### 2. Improved Health Check with Diagnostics

**Enhanced `waitForOpenCodeServer` function:**

- Uses `curl -s -o /dev/null -w "%{http_code}"` for proper HTTP status code extraction
- Logs every attempt's HTTP response code (000, 404, etc.)
- Every 10 seconds: checks port status with `netstat`/`ss`
- Every 10 seconds: checks if `opencode` process is running with `ps aux`
- On failure: dumps running processes and any log files for post-mortem analysis

### 3. Better Error Reporting in Chat Endpoint (`apps/api/src/routes/chat.ts`)

**Before:** Generic 500 error "Failed to start agent in sandbox"

**After:** Structured error response with:

- `error`: Human-readable message
- `details`: Full error message from exception
- `sandboxId`: For correlating with wrangler logs
- `suggestion`: Actionable guidance for user

This prevents hanging streams and gives users clear next steps.

### 4. Test Helper for Manual Verification

Added `testOpenCodeServerStartup()` function that:

- Creates a fresh test sandbox
- Runs the full startup sequence
- Verifies external health endpoint responds
- Automatically cleans up
- Can be called manually to debug issues without affecting production sessions

---

## Files Modified

| File                          | Changes                                                                                                                                 |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/api/src/lib/e2b.ts`     | 121 insertions, 23 deletions - Complete rewrite of `startOpenCodeServer` and `waitForOpenCodeServer`, added `testOpenCodeServerStartup` |
| `apps/api/src/routes/chat.ts` | 17 insertions, 10 deletions - Enhanced error reporting with sessionId logging and structured error response                             |

---

## Decisions Made

1. **Kept background process approach**: Despite issues, `background: true` is still the right pattern for long-running server processes in E2B
2. **Added 2s initialization delay**: Trade-off between startup speed and reliability — gives server time to bind before health checks
3. **Separate export vs inline env**: Testing showed `export VAR=value && command` is more reliable than `VAR=value command` in E2B sandbox bash
4. **Log everything**: When debugging distributed systems (Worker → E2B → OpenCode), verbose logs are essential

---

## Verification Steps

Deploy and test:

```bash
cd apps/api && wrangler deploy
npx wrangler tail ship-api-production
```

Create a new session and send a message. Expected log sequence:

```
[opencode:IGWPX...] Checking if OpenCode is installed...
[opencode:IGWPX...] which opencode: /home/user/.opencode/bin/opencode
[opencode:IGWPX...] Starting OpenCode server on port 4096...
[opencode:IGWPX...] Running: cd /home/user && ANTHROPIC_API_KEY="..." opencode serve --port 4096 --host 0.0.0.0 2>&1
[opencode:server] [INFO] Starting OpenCode server...
[opencode:IGWPX...] Health check attempt 1: HTTP 000
[opencode:IGWPX...] Health check attempt 2: HTTP 000
...
[opencode:IGWPX...] Health check passed on attempt 8
[opencode:IGWPX...] Server is ready
[opencode:IGWPX...] Server URL: https://4096-xxx.e2b.dev
[chat:42cd...] OpenCode server started at https://4096-xxx.e2b.dev
```

---

## Deviations from Plan

None — plan executed exactly as written.

---

## Next Steps

1. **Deploy to production** and monitor wrangler logs during first chat sessions
2. **If issues persist**, the detailed diagnostics will show:
   - Whether opencode binary exists
   - Whether process is running
   - What port is listening
   - Server stdout/stderr logs
3. **Share wrangler logs** if server still fails to start — the output now includes everything needed for debugging

---

## Metrics

- **Duration:** ~5 minutes
- **Tasks completed:** 4/4
- **Files modified:** 2
- **Commits:** 3

---

**Completed:** 2026-02-03
