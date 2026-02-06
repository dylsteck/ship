---
phase: 03-execution-layer
plan: 03
subsystem: git-operations
tags: [octokit, github-api, git-workflow, e2b-sandbox, pull-requests]

# Dependency graph
requires:
  - phase: 03-01
    provides: E2B sandbox provisioning and lifecycle management
provides:
  - Git workflow utilities for cloning, branching, committing, and pushing in E2B sandboxes
  - GitHub API client with PR creation and management
  - Git operations API routes for autonomous agent workflows
affects: [03-04, 03-05, agent-execution]

# Tech tracking
tech-stack:
  added:
    - "@octokit/rest": GitHub API client
    - "octokit-plugin-create-pull-request": Simplified PR creation
  patterns:
    - "Git operations in E2B sandbox via sandbox.commands.run()"
    - "User token authentication per-operation (never stored in sandbox)"
    - "Draft PR creation by default with manual ready-for-review"
    - "Branch naming: ship-{slug}-{timestamp}-{sessionId}"

key-files:
  created:
    - apps/api/src/lib/github.ts
    - apps/api/src/lib/git-workflow.ts
    - apps/api/src/routes/git.ts
  modified:
    - apps/api/src/index.ts
    - apps/api/package.json

key-decisions:
  - "GitHub PRs use user's token for proper attribution (not app token)"
  - "Draft PRs by default, user marks ready for review"
  - "Branch naming includes timestamp and session ID for uniqueness"
  - "Check for existing PR before creating to avoid duplicates"
  - "Git user config set per-commit for proper attribution"

patterns-established:
  - "Token injection pattern: Insert GitHub token into HTTPS URL for authentication"
  - "Session meta storage: Store current_branch, repo_url, pr_number in SessionDO meta"
  - "Error handling: GitWorkflowError and GitHubError with operation context"

# Metrics
duration: 13min
completed: 2026-02-01
---

# Phase 3 Plan 3: Git Workflow Infrastructure Summary

**Complete Git workflow for autonomous agents: clone with token auth, auto-branch creation with timestamp naming, per-response commits, and draft PR creation via Octokit**

## Performance

- **Duration:** 13 min
- **Started:** 2026-02-01T18:35:20Z
- **Completed:** 2026-02-01T18:48:18Z
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments

- GitHub API wrapper with Octokit supporting PR creation, updates, and duplicate detection
- Git workflow utilities executing all git operations within E2B sandboxes
- Complete API routes for clone, commit, push, and PR creation with user token authentication
- Branch naming pattern (ship-{slug}-{timestamp}-{sessionId}) for unique, readable branch names
- Draft PR workflow matching CONTEXT.md autonomous agent requirements

## Task Commits

Each task was committed atomically:

1. **Task 1: Install GitHub SDK and create GitHub API wrapper** - `800e9d9` (feat)
   - Installed @octokit/rest and octokit-plugin-create-pull-request
   - Created GitHubClient class with user token authentication
   - Implemented createPullRequest with duplicate PR checking
   - Added parseRepoUrl helper for GitHub URL parsing

2. **Task 2: Create Git workflow utilities for sandbox** - `5358297` (feat)
   - Implemented generateBranchName with ship-{slug}-{timestamp}-{session} format
   - Added cloneRepo with token authentication in URL
   - Added createBranch with graceful handling of existing branches
   - Added configureGitUser for commit attribution
   - Added commitChanges with per-response commit pattern
   - Added pushBranch with temporary token injection

3. **Task 3: Create Git operations API routes** - `188c2cf` (feat)
   - Created POST /git/clone for repository cloning with branch creation
   - Created POST /git/commit for committing changes with user attribution
   - Created POST /git/push for pushing branches to remote
   - Created POST /git/pr for creating draft pull requests
   - Registered git routes in main API app

## Files Created/Modified

- `apps/api/src/lib/github.ts` - Octokit wrapper with GitHubClient class for PR operations
- `apps/api/src/lib/git-workflow.ts` - Git workflow utilities for E2B sandbox operations
- `apps/api/src/routes/git.ts` - API routes orchestrating SessionDO + GitWorkflow + GitHubClient
- `apps/api/src/index.ts` - Registered /git routes
- `apps/api/package.json` - Added @octokit/rest and octokit-plugin-create-pull-request

## Decisions Made

1. **Token handling**: User's GitHub token passed per-operation, never persisted in sandbox
   - Stored in SessionDO meta for retrieval
   - Injected into HTTPS URLs for git authentication
   - Used for Octokit client instantiation

2. **Branch naming pattern**: `ship-{slug}-{timestamp}-{sessionId}`
   - Slug: task description sanitized (lowercase, alphanumeric, max 30 chars)
   - Timestamp: ISO date format (YYYY-MM-DD) for git safety
   - Session suffix: last 8 chars of session ID for uniqueness
   - Prevents collisions while maintaining readability

3. **PR workflow**: Draft by default, check for existing before creating
   - Matches CONTEXT.md requirement for auto-draft PRs
   - Duplicate detection prevents multiple PRs on same branch
   - Returns existing PR if found instead of erroring

4. **User attribution**: Git config set per-commit with user's name/email
   - Retrieved from session meta (user_name, user_email)
   - Ensures commits appear under user's GitHub identity
   - Fallback to "Ship Agent" if meta not available

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

**TypeScript compilation errors with E2B result.error types**
- **Issue**: E2B sandbox.commands.run() returns `result.error` as string, not Error object
- **Resolution**: Changed error handling from `result.error.message` to `result.error` (direct string)
- **Impact**: 6 error handling blocks updated in git-workflow.ts
- **Verification**: TypeScript compilation succeeds, error messages preserved

## User Setup Required

None - no external service configuration required beyond existing E2B_API_KEY.

Users must provide their GitHub personal access token via session creation, which is stored in SessionDO meta.

## Next Phase Readiness

**Ready for agent execution:**
- Agent can clone repositories using user credentials
- Agent can create uniquely-named branches per session
- Agent can commit changes with proper user attribution
- Agent can push to remote and create draft PRs

**Remaining for Phase 3:**
- Plan 03-04: VS Code/terminal access (complete)
- Plan 03-05: Agent orchestration with OpenCode integration

**No blockers** - Git workflow infrastructure is complete and ready for integration with agent runtime.

---
*Phase: 03-execution-layer*
*Completed: 2026-02-01*
