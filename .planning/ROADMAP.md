# Roadmap: Ship

## Overview

Ship is a background agent platform where AI agents autonomously work on coding tasks in isolated sandboxes. The roadmap follows a five-phase structure matching the architecture's natural dependency layers: authentication and database foundations, then stateful Durable Objects core, execution layer with E2B sandboxes and OpenCode agents, real-time UI via WebSockets, and finally external integrations with GitHub, Linear, and Vercel. Each phase delivers a coherent, testable capability that unblocks the next.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Foundation & Authentication** - User authentication, session management, and infrastructure setup
- [ ] **Phase 2: Stateful Core** - Durable Objects for session state and real-time communication
- [ ] **Phase 3: Execution Layer** - E2B sandboxes, OpenCode agents, and Git operations
- [ ] **Phase 4: Real-Time UI & Visibility** - Chat interface, status updates, and code/terminal viewers
- [ ] **Phase 5: External Integrations** - GitHub, Linear, and Vercel integrations

## Phase Details

### Phase 1: Foundation & Authentication
**Goal**: User can authenticate with GitHub and access the application with persistent sessions
**Depends on**: Nothing (first phase)
**Requirements**: AUTH-01, AUTH-02, AUTH-03
**Success Criteria** (what must be TRUE):
  1. User can sign in with GitHub OAuth and is redirected to authenticated application
  2. User session persists across browser restarts and tab closures
  3. Application has access to configured LLM API keys for agent operations
**Plans**: TBD

Plans:
- [ ] TBD (to be planned)

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
**Plans**: TBD

Plans:
- [ ] TBD (to be planned)

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
**Plans**: TBD

Plans:
- [ ] TBD (to be planned)

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
**Plans**: TBD

Plans:
- [ ] TBD (to be planned)

### Phase 5: External Integrations
**Goal**: Agent can sync with Linear for task management and integrate with Vercel for deployments
**Depends on**: Phase 4
**Requirements**: INTG-01, INTG-02, INTG-03, INTG-04, INTG-05, INTG-06
**Success Criteria** (what must be TRUE):
  1. System automatically syncs issues from Linear and creates tasks in sessions
  2. Agent updates Linear issue status when tasks complete or fail
  3. Agent can create new Linear issues when discovering bugs or suggesting improvements
  4. System links GitHub PRs created by agent to corresponding Linear issues
  5. User can access Vercel deployment tools via MCP in chat (preview, deploy, logs)
  6. User can enable or disable GitHub/Linear/Vercel connectors in settings
**Plans**: TBD

Plans:
- [ ] TBD (to be planned)

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation & Authentication | 0/0 | Not started | - |
| 2. Stateful Core | 0/0 | Not started | - |
| 3. Execution Layer | 0/0 | Not started | - |
| 4. Real-Time UI & Visibility | 0/0 | Not started | - |
| 5. External Integrations | 0/0 | Not started | - |

---
*Roadmap created: 2026-02-01*
*Last updated: 2026-02-01*
