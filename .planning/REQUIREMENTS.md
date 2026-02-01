# Requirements: Ship

**Defined:** 2025-02-01
**Core Value:** Agent works autonomously in the background on real coding tasks while you do other things

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Authentication

- [x] **AUTH-01**: User can sign in with GitHub OAuth
- [x] **AUTH-02**: User session persists across browser sessions
- [x] **AUTH-03**: LLM API keys configured via environment/config

### Sessions & Tasks

- [ ] **SESS-01**: User can create, view, delete sessions
- [ ] **SESS-02**: User can chat with agent in session
- [ ] **SESS-03**: User can create tasks from chat messages
- [ ] **SESS-04**: Session state persists in Durable Objects
- [ ] **SESS-05**: User sees real-time status updates via WebSocket
- [ ] **SESS-06**: Session can contain multiple tasks
- [ ] **SESS-07**: Tasks process in FIFO order

### Sandbox & Execution

- [ ] **SAND-01**: System provisions E2B sandbox per session
- [ ] **SAND-02**: User can access code-server (VS Code) in sandbox
- [ ] **SAND-03**: User can access terminal in sandbox
- [ ] **SAND-04**: Agent executes multi-step tasks autonomously
- [ ] **SAND-05**: Agent handles errors and recovers gracefully

### Git & Code

- [ ] **GIT-01**: Agent can clone repos into sandbox
- [ ] **GIT-02**: Agent can create branches
- [ ] **GIT-03**: Agent can commit changes
- [ ] **GIT-04**: Agent can push to remote
- [ ] **GIT-05**: Agent can create GitHub PRs
- [ ] **GIT-06**: User can view diffs in UI

### Integrations

- [ ] **INTG-01**: System syncs issues from Linear
- [ ] **INTG-02**: Agent updates Linear issue status
- [ ] **INTG-03**: Agent can create Linear issues
- [ ] **INTG-04**: System links GitHub PRs to Linear issues
- [ ] **INTG-05**: Vercel available as MCP in chat
- [ ] **INTG-06**: User can enable/disable connectors globally

### Agent & AI

- [ ] **AGNT-01**: OpenCode SDK powers agent runtime
- [ ] **AGNT-02**: Agent has codebase context awareness
- [ ] **AGNT-03**: User can select model (Claude, GPT, Gemini)
- [ ] **AGNT-04**: User sees cost per task

### UI & Experience

- [ ] **UI-01**: Chat interface matches Ramp Inspect design
- [ ] **UI-02**: Session list with history
- [ ] **UI-03**: Real-time status indicators
- [ ] **UI-04**: Code viewer shows agent's changes live
- [ ] **UI-05**: Terminal viewer shows agent output

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Sandbox Enhancements

- **SAND-06**: Agent can run headless browser tests
- **SAND-07**: System captures screenshots of agent work

### UI Enhancements

- **UI-06**: File browser for sandbox files
- **UI-07**: Screenshot gallery

### Collaboration

- **COLLAB-01**: Multiple users can view same session
- **COLLAB-02**: Team workspace with shared sessions

### Notifications

- **NOTIF-01**: Slack notifications for task completion
- **NOTIF-02**: Email notifications for errors

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Multiplayer editing | Single-user focus for v1, complexity too high |
| VNC/live browser view | Headless with screenshots sufficient |
| Custom sandbox images | Small repos don't need optimization |
| Automatic deployments | Manual via Vercel MCP is enough for v1 |
| Mobile app | Web-first |
| OAuth providers beyond GitHub | GitHub sufficient for target user |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 | Phase 1 | Complete |
| AUTH-02 | Phase 1 | Complete |
| AUTH-03 | Phase 1 | Complete |
| SESS-01 | Phase 2 | Pending |
| SESS-02 | Phase 2 | Pending |
| SESS-03 | Phase 2 | Pending |
| SESS-04 | Phase 2 | Pending |
| SESS-05 | Phase 2 | Pending |
| SESS-06 | Phase 2 | Pending |
| SESS-07 | Phase 2 | Pending |
| SAND-01 | Phase 3 | Pending |
| SAND-02 | Phase 3 | Pending |
| SAND-03 | Phase 3 | Pending |
| SAND-04 | Phase 3 | Pending |
| SAND-05 | Phase 3 | Pending |
| GIT-01 | Phase 3 | Pending |
| GIT-02 | Phase 3 | Pending |
| GIT-03 | Phase 3 | Pending |
| GIT-04 | Phase 3 | Pending |
| GIT-05 | Phase 3 | Pending |
| GIT-06 | Phase 4 | Pending |
| AGNT-01 | Phase 3 | Pending |
| AGNT-02 | Phase 3 | Pending |
| AGNT-03 | Phase 3 | Pending |
| AGNT-04 | Phase 4 | Pending |
| UI-01 | Phase 4 | Pending |
| UI-02 | Phase 4 | Pending |
| UI-03 | Phase 4 | Pending |
| UI-04 | Phase 4 | Pending |
| UI-05 | Phase 4 | Pending |
| INTG-01 | Phase 5 | Pending |
| INTG-02 | Phase 5 | Pending |
| INTG-03 | Phase 5 | Pending |
| INTG-04 | Phase 5 | Pending |
| INTG-05 | Phase 5 | Pending |
| INTG-06 | Phase 5 | Pending |

**Coverage:**
- v1 requirements: 36 total
- Mapped to phases: 36
- Unmapped: 0 ✓

---
*Requirements defined: 2025-02-01*
*Last updated: 2026-02-01 after roadmap creation*
