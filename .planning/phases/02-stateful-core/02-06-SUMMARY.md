---
phase: 02-stateful-core
plan: 06
subsystem: api

tags: [opencode, sdk, agent, tasks, streaming, sse]

# Dependency graph
requires:
  - phase: 02-04
    provides: Chat API with message persistence
provides:
  - OpenCode SDK integration for agent execution
  - Task persistence with FIFO ordering in SessionDO
  - Real-time SSE streaming of agent events
  - Build/Plan mode support
  - Stop button functionality
affects: [02-07-side-panel, 03-execution]

# Tech tracking
tech-stack:
  added: ['@opencode-ai/sdk']
  patterns:
    - 'OpenCode SDK wrapper for agent runtime'
    - 'Event streaming with SSE and WebSocket broadcast'
    - 'Task persistence with FIFO queue management'
    - 'Session metadata storage for OpenCode session ID'

key-files:
  created:
    - apps/api/src/lib/opencode.ts
  modified:
    - apps/api/src/durable-objects/session.ts
    - apps/api/src/routes/chat.ts
    - apps/api/package.json

key-decisions:
  - 'OpenCode SDK handles all LLM calls and tool execution (not direct API)'
  - 'Build mode (execute) vs Plan mode (propose) supported via mode parameter'
  - 'Tasks inferred from agent todo.updated events'
  - 'Project path stored in session metadata for OpenCode session creation'
  - 'Event streaming happens in Worker, DO handles persistence and broadcast'

patterns-established:
  - 'SDK wrapper pattern: Abstract OpenCode client management with env detection'
  - 'Event filtering: Filter global events to specific session'
  - 'Task FIFO: Tasks ordered by created_at for sequential processing'
  - 'Dual broadcast: SSE to HTTP client + WebSocket to all connected clients'

# Metrics
duration: 7min
completed: 2026-02-01
---

# Phase 02-06: OpenCode SDK Integration Summary

**OpenCode SDK integration for agent execution with task system and FIFO ordering**

## Performance

- **Duration:** 7 min
- **Started:** 2026-02-01T20:00:00Z
- **Completed:** 2026-02-01T20:07:00Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments

- Installed @opencode-ai/sdk package for agent runtime
- Created OpenCode wrapper (apps/api/src/lib/opencode.ts) with:
  - Client management for dev (auto-start) and production (connect)
  - Session creation with project path
  - Event subscription and session filtering
  - Stop/abort functionality
- Extended SessionDO with task persistence:
  - `persistTask()` - Create tasks with FIFO ordering
  - `updateTaskStatus()` - Update task state
  - `getNextPendingTask()` - Get next task in queue
  - `getTasks()` - Query tasks with status filter
  - RPC endpoints for /tasks, /meta, /broadcast
- Updated chat route with OpenCode integration:
  - Stream OpenCode events via SSE
  - Handle message.part.updated for content
  - Handle todo.updated to create tasks
  - Handle permission.updated for approvals
  - Stop endpoint to abort sessions

## Task Commits

1. **Task 1: Install OpenCode SDK and create wrapper** - `babc947` (chore)
2. **Task 2: Add task persistence to SessionDO** - `13447d0` (feat)
3. **Task 3: Update chat route with OpenCode integration** - `32c20eb` (feat)

## Files Created/Modified

- `apps/api/src/lib/opencode.ts` - OpenCode SDK wrapper (new)
- `apps/api/src/durable-objects/session.ts` - Task persistence methods
- `apps/api/src/routes/chat.ts` - OpenCode streaming integration
- `apps/api/package.json` - Added @opencode-ai/sdk dependency

## Decisions Made

- OpenCode SDK provides complete agent runtime including Build/Plan modes
- Direct LLM calls avoided - OpenCode handles everything
- Task creation happens when agent emits todo.updated events
- Session metadata stores OpenCode session ID for persistence
- Event streaming is split: Worker streams to client, DO persists and broadcasts

## Deviations from Plan

None - plan executed as written.

## Issues Encountered

- SDK types required careful reading of actual exports (ToolPart not ToolCallPart)
- Environment detection needs to work in both Node.js and Cloudflare Workers
- SSE event structure differs from original plan - adapted to actual SDK types

## User Setup Required

1. Install OpenCode CLI globally: `npm install -g opencode`
2. Configure provider settings in `.opencode/config.json` (optional, defaults to anthropic)

## Next Phase Readiness

- OpenCode integration ready for side panel task display (Plan 02-07)
- Agent can create and execute tasks in sessions
- SSE streaming ready for chat UI integration
- TypeScript compiles cleanly
- Ready for human verification checkpoint

---

_Phase: 02-stateful-core_
_Completed: 2026-02-01_
