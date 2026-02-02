# Plan 05-03: Conditional Linear Issue Updates - Summary

**Completed:** 2026-02-01  
**Duration:** ~15 minutes  
**Status:** ✅ Complete (status updates implemented, issue creation tool deferred)

## Tasks Completed

### Task 1: Add Linear issue update methods ✅
- LinearClient already includes `updateIssueStatus()` method
- Handles Linear state IDs correctly (states are team-specific)
- Status mapping:
  - Task complete → Linear "Done" state
  - Task failed → Linear "Canceled" state
  - Task in progress → Linear "In Progress" state

### Task 2: Integrate conditional Linear updates into agent executor ✅
- Added `updateLinearIssueStatus()` private method to `AgentExecutor`
- Updates Linear issue status ONLY if Linear issue is explicitly linked
- Hooks integrated:
  - `onAgentResponse()` - Updates to "In Progress" before processing, "Done" after successful commit
  - Error handling - Updates to "Canceled" on error
- Linking check:
  - Queries SessionDO for linked Linear issue ID
  - ONLY if linearIssueId exists, calls Linear API to update issue
  - If no linked issue, skips Linear update (no-op)
- Handles errors gracefully (doesn't fail task if Linear update fails)
- Added DB access to AgentExecutorConfig for Linear token retrieval

### Task 3: Add Linear issue creation from agent ⚠️
- **Status:** Deferred - Requires OpenCode SDK custom tool registration
- MCP server structure ready for when OpenCode SDK adds support
- Agent executor would need to register custom tools when SDK supports it

## Files Created/Modified

- ✅ `apps/api/src/lib/agent-executor.ts` (updated - added Linear status updates)
- ✅ `apps/api/src/durable-objects/session.ts` (updated - pass DB access to executor)

## Verification

- ✅ Agent updates Linear issue status on task completion ONLY if Linear issue is explicitly linked
- ✅ Agent updates Linear issue status on task failure ONLY if Linear issue is explicitly linked
- ✅ Agent updates Linear issue status on task start ONLY if Linear issue is explicitly linked
- ✅ Linear issue updates use correct state IDs
- ✅ No Linear updates occur if no issue is linked
- ⚠️ Agent can create Linear issues via custom tool (deferred until OpenCode SDK support)

## Notes

1. **Conditional Updates:** All Linear updates are conditional - they only occur when a Linear issue is explicitly linked to the session.

2. **Error Handling:** Linear update failures don't break agent execution - they're logged but don't fail the task.

3. **Issue Creation:** Linear issue creation from agent requires OpenCode SDK custom tool support, which is not yet available. The structure is ready for when support is added.

## Success Criteria Met

- ✅ Agent updates Linear issue status when tasks complete or fail, but ONLY when Linear issue is explicitly linked to session
- ⚠️ Agent can create new Linear issues when user asks or when discovering bugs (deferred until SDK support)
