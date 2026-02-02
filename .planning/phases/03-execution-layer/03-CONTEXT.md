# Phase 03: Execution Layer - Context

**Gathered:** 2026-02-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Agent autonomously executes multi-step coding tasks in isolated E2B sandboxes with full Git workflow. This phase delivers the execution infrastructure: sandbox provisioning, OpenCode agent integration, VS Code/terminal access, model selection, and complete Git operations (clone, branch, commit, push, PR).

Success means the agent can receive a task, work in an isolated environment, make code changes, and deliver a pull request — all while the user monitors via chat.

</domain>

<decisions>
## Implementation Decisions

### Sandbox Access Pattern

- **Background execution**: Agent works autonomously like Ramp Inspect — no blocking UI
- **Access buttons**: Small icons in top-right (like Ramp Inspect screenshot) for terminal and preview
- **Opening behavior**: Inline drawer/slide-out panel — not new tab or modal
- **UX principle**: Check in when you want, don't wait for the agent

### AI Model Selection

- **Default level**: Global user preference with per-session override
- **UI locations**: Settings page for default + session creation dialog for override
- **Supported models**: All OpenCode-supported models (query OpenCode API for available models, including Zen)
- **Mid-session changes**: Changeable during session, but NOT while model is actively generating
- **Display**: Show current model somewhere in session UI (side panel or header)

### Error Handling UX

- **Primary behavior**: Claude decides based on error type — generation errors get retries with nice user display
- **Error display**: Inline in chat as system message (for chat/stream errors)
- **User controls**: Retry button + options to open VS Code or terminal if manual intervention needed
- **Recovery approach**: Automatic retry for transient errors, pause and notify for persistent issues

### Git Workflow Behavior

- **Commit timing**: Per AI response/answer — when agent completes a coherent chunk of work
- **Branch strategy**: Auto-create new branch for each session
- **Branch naming**: Smaller model auto-names the chat, branch name derived from task description with timestamp
  - Override: User can explicitly specify branch name in chat (e.g., "use branch fix-auth")
- **Pull requests**: Auto-create draft PR at first commit
  - User can mark ready for review via button or chat command
  - User can edit PR description via chat
- **Attribution**: PRs opened as the user (not the app), using user's GitHub token

### Claude's Discretion

- Exact retry logic and error classification
- Sandbox warming strategy (pre-warm vs on-demand)
- Specific E2B vs Modal tradeoffs
- VS Code embedding approach (iframe vs direct)
- Exact placement of model selector in UI
- Error message formatting and tone

</decisions>

<specifics>
## Specific Ideas

### Reference: Ramp Inspect

- "Why we built our background agent" blog post is the gold standard
- Key principles: fast session start, background execution, check in when you want
- Multiplayer support: sessions can be shared with colleagues
- Modal sandboxes for instant startup + snapshots for state preservation

### Interface Details

- Screenshot buttons in top-right: ![Ramp Inspect interface](https://builders.ramp.com/assets/take-screenshot-Db3a9PFs.png)
- Agent status visible but not blocking
- Terminal and preview accessible but not required to watch

### Workflow Inspiration

- Background agent works while user does other things
- No limit on concurrent sessions
- Fast to start, free to run (within limits)
- Capture ideas anytime, check results later

</specifics>

<deferred>
## Deferred Ideas

**Phase 4 (Real-Time UI):**

- Live code diff viewer showing changes as they happen
- Before/after screenshots in PR descriptions (computer use)
- Cost breakdown per task after completion
- Detailed terminal output streaming

**Phase 5 (Integrations):**

- Linear issue linking
- Vercel deployment integration
- Slack bot for session updates
- Chrome extension for visual editing

**Future Improvements:**

- Sandbox pool warming for high-volume repos
- Scheduled/image builds every 30 minutes
- Multiplayer session sharing
- Voice chat interface
- Chrome extension for element selection

</deferred>

---

_Phase: 03-execution-layer_
_Context gathered: 2026-02-01_
