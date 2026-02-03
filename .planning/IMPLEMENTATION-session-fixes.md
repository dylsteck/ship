# Implementation Summary: Session Page Fixes

**Date:** 2026-02-02
**Related Plan:** See detailed context in [CONTEXT-opencode-e2b.md](./CONTEXT-opencode-e2b.md)

## Overview

This implementation fixed four related issues affecting the session page functionality:

1. **Chat API 500/400 Error** (Critical) - Root cause of most issues
2. **"Starting" Status Stuck** - Symptom of #1
3. **Sandbox Section Not Showing** - UI visibility issue
4. **Delete Session UI Not Updating** - Navigation issue

## Changes Made

### Phase 0: Fix Chat Endpoint - Connect to OpenCode in E2B Sandbox

**Root Cause:** The chat endpoint tried to connect to `localhost:4096` which doesn't exist in Cloudflare Workers. OpenCode must run INSIDE the E2B sandbox, not as a separate server.

**Files Modified:**

1. **`apps/api/src/lib/e2b.ts`**
   - Added `startOpenCodeServer()` function to start OpenCode server in sandbox
   - Added `waitForOpenCodeServer()` helper to poll health endpoint (60s timeout)
   - Added `getSandboxPortUrl()` to get public URL for sandbox ports
   - **Auto-installs OpenCode** if not present using `curl -fsSL https://opencode.ai/install | bash`
   - Added detailed logging for debugging

2. **`apps/api/src/lib/opencode.ts`**
   - Added `createOpenCodeClientForSandbox(baseUrl)` for production use
   - Added `sandboxClients` cache map for reusing clients per sandbox URL
   - Modified all functions to accept optional `sandboxUrl` parameter
   - Updated `getOpenCodeClient()` to require sandbox URL in production
   - Updated `createOpenCodeSession()`, `promptOpenCode()`, `subscribeToEvents()`, `stopOpenCode()` to pass sandbox URL
   - Fixed `cleanupOpenCode()` to clear sandbox clients cache

3. **`apps/api/src/routes/chat.ts`**
   - **Added sandbox provisioning wait loop** - waits up to 60s for sandbox to be ready
   - Polls sandbox status every 2s while provisioning
   - Returns 504 if provisioning times out
   - Returns 500 if provisioning fails
   - Gets/starts OpenCode server URL from sandbox
   - Stores `opencode_url` in session metadata for reuse
   - Passes sandbox URL through all OpenCode operations
   - Fixed tool name type checking (`part.tool` is a string, not object)

**Architecture:**
```
┌─────────────────────────────────────────────────────────────┐
│                    E2B Sandbox                               │
│  ┌────────────────┐                                         │
│  │ OpenCode Server │◄─── opencode serve --port 4096         │
│  │   (port 4096)   │     (auto-installed if missing)        │
│  └────────┬───────┘                                         │
│           │                                                  │
│           │ localhost:4096                                   │
│           ▼                                                  │
│  ┌────────────────┐                                         │
│  │  Public URL    │◄─── sandbox.getHost(4096)               │
│  │ (e2b tunnels)  │     returns: "4096-{id}.e2b.dev"        │
│  └────────┬───────┘                                         │
└───────────┼─────────────────────────────────────────────────┘
            │
            │ HTTPS (public internet)
            ▼
┌─────────────────────────────────────────────────────────────┐
│                 Cloudflare Worker                            │
│                                                              │
│  1. Wait for sandbox provisioning (up to 60s)               │
│  2. Start OpenCode server (install if needed)               │
│  3. createOpencodeClient({ baseUrl: sandbox URL })          │
│  4. Send prompts, stream responses via SSE                  │
└─────────────────────────────────────────────────────────────┘
```

### Phase 1: Fix Sandbox Status Polling (Stale Closure Bug)

**Root Cause:** The `sandboxStatus` state variable in the polling interval callback was captured at creation time, creating a stale closure.

**File Modified:** `apps/web/app/(app)/session/[id]/page-client.tsx`

**Changes:**
- Added `sandboxStatusRef` to track current status
- Updated polling interval to use `sandboxStatusRef.current` instead of `sandboxStatus` state
- Removed `sandboxStatus` from useEffect dependencies

### Phase 2: Improve Sandbox Section Visibility

**Root Cause:** Sandbox section only showed when status was not 'none', but it should also show when we have a sandboxId (e.g., paused sandbox).

**File Modified:** `apps/web/components/session/session-panel.tsx`

**Changes:**
- Updated condition to show sandbox section: `(sandboxStatus !== 'none') || sandboxId`
- Added handling for paused state display
- Added gray status indicator for 'none' status when sandboxId exists

### Phase 3: Fix Delete Session UI Update

**Root Cause:** The delete flow had issues with optimistic updates and router refresh timing.

**Files Modified:**

1. **`apps/web/app/(app)/session/[id]/page-client.tsx`**
   - Added `useLocalSessions()` hook for optimistic session state management
   - Passed `onSessionDeleted` callback to AppSidebar

2. **`apps/web/components/app-sidebar.tsx`**
   - Fixed delete flow order: delete API first, then update local state
   - Added `router.refresh()` on success to ensure server state consistency
   - Properly handle redirect when deleting current session

## Commits

1. `9bd4123` - fix: session page stuck state, sandbox display, and delete navigation
2. `8aa7ce2` - fix: wait for sandbox provisioning and install OpenCode before starting server
3. `f69afce` - fix: use curl install script for OpenCode instead of npm

## Testing Checklist

1. **Chat Works:**
   - [ ] Send a message, verify no 500/400 error
   - [ ] Verify SSE streaming works
   - [ ] Check that status transitions from "Starting" to "Exploring codebase", "Writing code", etc.
   - [ ] Check Cloudflare Worker logs for OpenCode install/startup messages

2. **Sandbox Display:**
   - [ ] Verify sidebar shows sandbox section with status
   - [ ] Verify sandbox ID is displayed (truncated)
   - [ ] Check status indicator colors (green=ready, yellow=provisioning, gray=paused)

3. **Delete Session:**
   - [ ] Delete a session from sidebar while NOT viewing it - list updates
   - [ ] Delete the CURRENT session - redirects to `/` and list updates
   - [ ] Verify session is actually deleted (doesn't reappear on refresh)

## File Summary

| File | Changes |
|------|---------|
| `apps/api/src/lib/e2b.ts` | +70 lines - OpenCode server management with auto-install |
| `apps/api/src/lib/opencode.ts` | +45 lines - Dynamic URL support, client caching |
| `apps/api/src/routes/chat.ts` | +50 lines - Sandbox wait loop, URL handling |
| `apps/web/app/(app)/session/[id]/page-client.tsx` | +15 lines - Stale closure fix, session delete |
| `apps/web/components/session/session-panel.tsx` | +10 lines - Sandbox visibility |
| `apps/web/components/app-sidebar.tsx` | ~10 lines - Delete flow fix |

## Potential Issues to Monitor

1. **OpenCode Install Time**: First request to a new sandbox may take 1-2 minutes while OpenCode installs
2. **Sandbox Timeout**: If E2B sandbox takes >60s to provision, chat will fail with 504
3. **OpenCode Health Endpoint**: Assumes `/health` endpoint exists - may need adjustment based on actual OpenCode API

## Dependencies

- E2B sandbox must have `curl` and `bash` available
- `ANTHROPIC_API_KEY` must be set in Cloudflare Worker environment
- E2B sandbox must support `getHost()` for public URL generation
