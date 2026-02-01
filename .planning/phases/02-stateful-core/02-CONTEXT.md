# Phase 2: Stateful Core - Context

**Gathered:** 2026-02-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Sessions exist as stateful entities that persist conversations, tasks, and real-time updates. Each session is tied to a GitHub repository and serves as an isolated working environment. Users chat with the agent, which infers intent and breaks down work into tasks. State persists in Durable Objects with real-time updates via WebSocket.

This phase covers: session CRUD, chat with persistence, task creation from chat, Durable Object state management, WebSocket real-time updates.

NOT in scope: sandbox execution, code editing, Git operations, external integrations (those are Phase 3+).

</domain>

<decisions>
## Implementation Decisions

### Session Model
- Session = one GitHub repository, but multiple sessions per repo allowed (parallel work streams)
- User selects repo from connected repos when creating session (no paste URL option)
- Sessions auto-archive after inactivity, user can manually delete from archive
- Session list is the main dashboard view

### Chat Behavior
- Token-by-token streaming for responses
- Tool use displayed inline as collapsible blocks within message flow
- Both stop button AND message queuing available — user can interrupt or queue follow-ups
- Recent messages shown by default (~20-30), "Load earlier" for history
- Tool blocks collapsed by default to keep chat readable

### Task Creation
- Agent infers intent from natural language and breaks down into tasks automatically (like Claude Code)
- Two modes: Build mode (default, execute immediately) and Plan mode (propose first, user confirms)
- User can switch between modes at any time
- Tasks managed through chat only — no direct manipulation in side panel
- Mini side panel shows: repo context, current branch, active tasks/tools being used

### Real-time Updates
- High-level status by default ("Planning", "Coding", "Testing"), expandable to see detailed tool calls
- Auto-reconnect WebSocket silently in background, catch up on missed updates invisibly
- In-app indicator only for completion (badge on session) — no browser notifications
- Current session gets full real-time updates; session list shows live status if feasible, otherwise last-known

### Claude's Discretion
- Exact message count for "recent" (around 20-30, adjust based on performance)
- Auto-archive timing (after X days of inactivity)
- Side panel design details and information density
- Reconnection retry logic and backoff strategy
- Status indicator visual design

</decisions>

<specifics>
## Specific Ideas

- "Like Claude Code" — agent infers what user wants and breaks it into local tasks
- "Build mode vs Plan mode like OpenCode" — two execution modes with build as default
- "Mini side panel on right" showing repo, branch, and tasks/tools (like Ramp Inspect reference)
- "Token streaming but make it look really nice" — tool use and responses should feel polished
- "High level then click to expand" — like Claude Code desktop showing 'exploring xyz' then detailed tool call on expand

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 02-stateful-core*
*Context gathered: 2026-02-01*
