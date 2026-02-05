# Roadmap: Ship

## Overview

Ship is a background agent platform where AI agents autonomously work on coding tasks in isolated sandboxes. The roadmap follows a five-phase structure matching the architecture's natural dependency layers: authentication and database foundations, then stateful Durable Objects core, execution layer with E2B sandboxes and OpenCode agents, real-time UI via WebSockets, and finally external integrations with GitHub, Linear, and Vercel. Each phase delivers a coherent, testable capability that unblocks the next.

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Foundation & Authentication** - User authentication, session management, and infrastructure setup
- [x] **Phase 2: Stateful Core** - Durable Objects for session state and real-time communication
- [x] **Phase 3: Execution Layer** - E2B sandboxes, OpenCode agents, and Git operations
- [x] **Phase 4: Real-Time UI & Visibility** - Chat interface, status updates, and code/terminal viewers
- [x] **Phase 5: External Integrations** - GitHub, Linear, and Vercel integrations
- [ ] **Phase 100: OpenCode UI Parity** - Rich event display matching OpenCode TUI/Web UI

## Phase Details

### Phase 1: Foundation & Authentication

**Goal**: User can authenticate with GitHub and access the application with persistent sessions
**Depends on**: Nothing (first phase)
**Requirements**: AUTH-01, AUTH-02, AUTH-03
**Success Criteria** (what must be TRUE):

1. User can sign in with GitHub OAuth and is redirected to authenticated application
2. User session persists across browser restarts and tab closures
3. Application has access to configured LLM API keys for agent operations
   **Plans**: 5 plans in 3 waves

Plans:

- [x] 01-01-PLAN.md — Scaffold Turborepo monorepo with Next.js web app and Cloudflare Worker API
- [x] 01-02-PLAN.md — Set up D1 database schema and user management API
- [x] 01-03-PLAN.md — Implement GitHub OAuth flow with Arctic and JWT session management
- [x] 01-04-PLAN.md — Create login, onboarding, and dashboard pages with theme support
- [x] 01-05-PLAN.md — Configure LLM API keys and finalize environment setup

### Phase 2: Stateful Core

**Goal**: Sessions exist as stateful entities that persist conversations, tasks, and real-time updates
**Depends on**: Phase 1
**Requirements**: SESS-01, SESS-02, SESS-03, SESS-04, SESS-05, SESS-06, SESS-07
**Success Criteria** (what must be TRUE):

1. User can create a new session and it appears in session list
2. User can chat with agent in a session and messages persist across page reloads
3. User can create tasks from chat messages and tasks appear in session
4. Session state survives Durable Object hibernation and wakes correctly
5. User sees real-time status updates when agent is working (via WebSocket)
6. User can add multiple tasks to one session and tasks execute in order
   **Plans**: 7 plans in 6 waves

Plans:

- [x] 02-01-PLAN.md — Create SessionDO Durable Object with SQLite schema and bindings
- [x] 02-02-PLAN.md — Implement session CRUD API and session list UI
- [x] 02-03-PLAN.md — Add WebSocket Hibernation support for real-time updates
- [x] 02-04-PLAN.md — Create chat API with message persistence in DO
- [x] 02-05-PLAN.md — Build chat UI with streaming and real-time WebSocket integration
- [x] 02-06-PLAN.md — Integrate OpenCode SDK for agent execution and task system
- [x] 02-07-PLAN.md — Add session side panel, status indicators, and verify phase

### Phase 3: Execution Layer

**Goal**: Agent autonomously executes multi-step coding tasks in isolated sandboxes with full Git workflow
**Depends on**: Phase 2
**Requirements**: SAND-01, SAND-02, SAND-03, SAND-04, SAND-05, GIT-01, GIT-02, GIT-03, GIT-04, GIT-05, AGNT-01, AGNT-02, AGNT-03
**Success Criteria** (what must be TRUE):

1. System provisions an E2B sandbox when user creates a session
2. User can access VS Code editor and terminal in the sandbox
3. Agent can clone a repository, create a branch, make changes, commit, and push autonomously
4. Agent can create GitHub pull requests with description and link to issue
5. Agent handles errors during task execution and recovers gracefully without manual intervention
6. Agent understands codebase context and makes relevant changes across multiple files
7. User can select which AI model (Claude, GPT, Gemini) to use for tasks
   **Plans**: 7 plans in 4 waves

Plans:

- [x] 03-01-PLAN.md — E2B Sandbox provisioning and SessionDO lifecycle integration
- [x] 03-02-PLAN.md — VS Code and Terminal access with inline drawer UI
- [x] 03-03-PLAN.md — Git workflow utilities (clone, branch, commit, push)
- [x] 03-04-PLAN.md — GitHub PR automation and PR panel in side panel
- [x] 03-05-PLAN.md — AI model selection with global preference and session override
- [x] 03-06-PLAN.md — Error handling with classification and automatic recovery
- [x] 03-07-PLAN.md — End-to-end integration and complete verification checkpoint

### Phase 4: Real-Time UI & Visibility

**Goal**: User has full visibility into agent work through real-time chat, code viewer, and terminal output
**Depends on**: Phase 3
**Requirements**: UI-01, UI-02, UI-03, UI-04, UI-05, GIT-06, AGNT-04
**Success Criteria** (what must be TRUE):

1. Chat interface matches Ramp Inspect design with clean layout and visual polish
2. User can view all past sessions and resume or delete any session
3. User sees real-time status indicators showing agent's current state (planning, executing, stuck)
4. User can view code changes the agent made in real-time as they happen
5. User can view terminal output from agent commands as they execute
6. User can view Git diffs showing what changed in the codebase
7. User sees cost breakdown per task after completion
   **Plans**: 6 plans in 2 waves

Plans:

- [x] 04-01-PLAN.md — Code viewer component with Monaco Editor integration
- [x] 04-02-PLAN.md — Git diff viewer component and session panel integration
- [x] 04-03-PLAN.md — Cost tracking and display system
- [x] 04-04-PLAN.md — Enhanced chat interface with Ramp design
- [x] 04-05-PLAN.md — Enhanced session list with Ramp design
- [x] 04-06-PLAN.md — Real-time status indicators enhancement

### Phase 5: External Integrations

**Goal**: Agent can sync with Linear for task management and integrate with Vercel for deployments
**Depends on**: Phase 4
**Requirements**: INTG-01, INTG-02, INTG-03, INTG-04, INTG-05, INTG-06
**Success Criteria** (what must be TRUE):

1. User can explicitly link Linear issues to sessions and optionally sync to create tasks
2. Agent updates Linear issue status when tasks complete or fail, but ONLY when Linear issue is explicitly linked
3. Agent can create new Linear issues when user asks or when discovering bugs
4. System links GitHub PRs to Linear issues ONLY when Linear issue is explicitly linked to session
5. User can access Vercel deployment tools via MCP in chat (preview, deploy, logs)
6. User can enable or disable GitHub/Linear/Vercel connectors in settings
   **Plans**: 6 plans in 3 waves

Plans:

- [x] 05-01-PLAN.md — Linear OAuth and API client integration
- [x] 05-02-PLAN.md — Linear issue linking and manual sync
- [x] 05-03-PLAN.md — Linear issue status updates from agent
- [x] 05-04-PLAN.md — GitHub PR to Linear issue linking
- [x] 05-05-PLAN.md — Vercel MCP server for deployment tools
- [x] 05-06-PLAN.md — Connector management UI and API

### Phase 100: OpenCode UI Parity

**Goal**: User sees rich agent activity matching OpenCode TUI/Web UI with all SSE events properly displayed
**Depends on**: Phase 5
**Requirements**: UI-PARITY-01, UI-PARITY-02, UI-PARITY-03
**Success Criteria** (what must be TRUE):

1. Big Pickle model appears in model selector and is default
2. All SSE events are typed and parsed correctly without React rendering errors
3. Tool calls display with collapsible input/output like OpenCode
4. Session sidebar shows context tokens, cost, todos, and file diffs
5. Step costs and token usage displayed per agent turn
   **Plans**: 4 plans in 3 waves

Plans:

- [ ] 100-01-PLAN.md — Fix Big Pickle model visibility in selector
- [x] 100-02-PLAN.md — Create typed SSE event system
- [ ] 100-03-PLAN.md — Create rich tool display and session sidebar components
- [ ] 100-04-PLAN.md — Integrate SSE types and components into chat interfaces

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5

| Phase                          | Plans Complete | Status      | Completed  |
| ------------------------------ | -------------- | ----------- | ---------- |
| 1. Foundation & Authentication | 5/5            | Complete    | 2026-02-01 |
| 2. Stateful Core               | 7/7            | Complete    | 2026-02-01 |
| 3. Execution Layer             | 7/7            | Complete    | 2026-02-01 |
| 4. Real-Time UI & Visibility   | 6/6            | Complete    | 2026-02-01 |
| 5. External Integrations       | 6/6            | Complete    | 2026-02-01 |
| 100. OpenCode UI Parity        | 1/4            | In progress | -          |

---

_Roadmap created: 2026-02-01_
_Last updated: 2026-02-05 (100-02 complete - Typed SSE event system)_
