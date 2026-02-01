# Codebase Concerns

**Analysis Date:** 2026-02-01

## Tech Debt

**Sandbox Lifecycle Management:**
- Issue: In-memory sandbox tracking in `lib/sandbox/sandbox-registry.ts` is ephemeral and doesn't survive server restarts. Sandboxes may be orphaned if application crashes.
- Files: `lib/sandbox/sandbox-registry.ts`, `lib/sandbox/creation.ts`
- Impact: Long-running tasks may lose connection to their sandboxes; cleanup becomes unreliable; resource leaks in production.
- Fix approach: Implement persistent sandbox registry (database or Redis). Track sandbox state with heartbeat mechanism. Add cleanup job for stale sandboxes.

**Task Logger Database Thrashing:**
- Issue: Every log message causes a full database read-fetch-update cycle on the task record (lines 36-46 in `lib/utils/task-logger.ts`). Reading existing logs, appending, and writing entire array back for each message.
- Files: `lib/utils/task-logger.ts` (lines 36-46, 76-86, 108-110)
- Impact: O(n) database queries for n logs; severe performance degradation for long-running tasks with many logs; potential connection pool exhaustion.
- Fix approach: Implement batch logging with configurable flush interval, or use append-only log architecture. Consider denormalized logging table separate from tasks.

**Environment Variable Mutation During Agent Execution:**
- Issue: Process.env is temporarily mutated with user API keys and restored in finally block (lines 48-125 in `lib/sandbox/agents/index.ts`). Race conditions possible if concurrent requests share same Node.js process.
- Files: `lib/sandbox/agents/index.ts`
- Impact: API keys could leak between user requests in high-concurrency scenarios; keys temporarily visible in process memory/logs.
- Fix approach: Use dependency injection or context managers instead of process.env mutation. Pass API keys as function parameters through call stack.

**Error Handling Swallowed in TaskLogger:**
- Issue: TaskLogger catch blocks silently fail (lines 48-50, 87-89, 114-116 in `lib/utils/task-logger.ts`). Errors disappear without notification.
- Files: `lib/utils/task-logger.ts`
- Impact: Silent failures during task execution; logs don't persist; difficult to debug; misleading task status.
- Fix approach: Log errors to external error tracking (Sentry, datadog). Return success/failure indicators from logger methods. Implement fallback logging.

**Schema Type Mismatches:**
- Issue: `selectTaskSchema` uses `z.string().nullable()` for `selectedAgent` and `selectedModel` (lines 152-153) but database table defaults to 'claude' string (line 82). Nullable doesn't match reality.
- Files: `lib/db/schema.ts`
- Impact: Type-checking gives false confidence; potential null reference errors in agent selection logic.
- Fix approach: Align schema to match actual nullable/non-nullable database columns. Make selectedAgent non-nullable with default enum validation.

## Known Bugs

**Sandbox Cleanup Race Condition:**
- Symptoms: When killSandbox is called multiple times or during graceful shutdown, second call may pick random sandbox due to fallback logic (lines 22-28 in `sandbox-registry.ts`).
- Files: `lib/sandbox/sandbox-registry.ts`
- Trigger: User stops task, then application restarts during stop operation; two users stop tasks simultaneously.
- Workaround: None. Sandboxes may not terminate cleanly.

**Task Message Failure Silent:**
- Symptoms: User prompt fails to save to taskMessages table, but task still creates and returns success (lines 72-81 in `app/api/tasks/route.ts`).
- Files: `app/api/tasks/route.ts`
- Trigger: Database constraint violation or connection timeout during message insert.
- Workaround: None. Check task_messages table to detect unsaved prompts.

**Soft-Delete Inconsistency:**
- Symptoms: DELETE handler removes entire task record (line 126 in `app/api/tasks/[taskId]/route.ts`) while GET/PATCH handlers respect soft-delete with `isNull(tasks.deletedAt)` (line 26).
- Files: `app/api/tasks/route.ts` (DELETE route), `app/api/tasks/[taskId]/route.ts` (GET/PATCH routes)
- Trigger: User deletes filtered tasks via query parameter action.
- Impact: Inconsistent delete behavior; some deletes are hard (immediate cleanup) while others soft (reversible).

**Account Merge Data Loss Risk:**
- Symptoms: When GitHub account already connected to different user during OAuth callback, account merge happens without transaction safety (lines 160-171 in `app/api/auth/github/callback/route.ts`).
- Files: `app/api/auth/github/callback/route.ts`
- Trigger: User A signs up with GitHub account X, User B signs in with different auth then connects GitHub account X.
- Impact: Tasks from User A → transferred to User B without notification or audit trail; data appears to vanish from User A's perspective.

## Security Considerations

**API Key Exposure in Process Memory:**
- Risk: API keys stored in process.env during agent execution. Keys visible to error stacktraces, crash logs, and memory dumps.
- Files: `lib/sandbox/agents/index.ts`, `lib/sandbox/agents/claude.ts`, `lib/utils/logging.ts`
- Current mitigation: Redaction patterns in logging (regex-based), partial obfuscation.
- Recommendations:
  - Remove API key mutation from process.env; use sealed containers (AsyncLocalStorage, context objects)
  - Implement request-scoped secret storage
  - Redact all error messages before returning to client
  - Never log full API key values even in debug mode

**Encryption Key Management:**
- Risk: ENCRYPTION_KEY validates length (32 bytes) but no rotation mechanism. Compromised key exposes all historical encrypted tokens.
- Files: `lib/crypto.ts`
- Current mitigation: Throws if key is missing or wrong size.
- Recommendations:
  - Implement key versioning (store key version with encrypted data)
  - Add key rotation procedure to docs
  - Consider using sealed secrets (HashiCorp Vault, AWS Secrets Manager)
  - Audit all decryption sites to ensure keys never logged

**OAuth State Validation Flexible:**
- Risk: State parameter validation works but cookie pattern fallback (lines 20-22 in callback route) silently accepts both old and new patterns. Could allow confusion if cookie names collide.
- Files: `app/api/auth/github/callback/route.ts`
- Current mitigation: Checks against stored state values.
- Recommendations:
  - Consolidate to single cookie naming pattern
  - Add explicit error logging for unexpected cookie states
  - Implement CSRF token rotation after each use

**Rate Limit Easily Bypassed:**
- Risk: Rate limit counts messages per day (UTC) but check happens at request start only (lines 21-24, 37-43 in `app/api/tasks/route.ts`). Queue of 50 requests all pass check simultaneously.
- Files: `lib/utils/rate-limit.ts`, `app/api/tasks/route.ts`
- Current mitigation: Simple count check.
- Recommendations:
  - Implement sliding window rate limiting
  - Add per-IP rate limiting as additional layer
  - Persist rate limit state to database (not memory)
  - Implement leaky bucket or token bucket algorithm

**Session Cookie Security:**
- Risk: Session uses `cache()` wrapper (line 6 in `lib/session/get-server-session.ts`) which caches across request boundary. No explicit HttpOnly, Secure, SameSite settings visible.
- Files: `lib/session/get-server-session.ts`, `lib/session/server.ts` (not read)
- Current mitigation: Next.js cookie defaults.
- Recommendations:
  - Verify HttpOnly and Secure flags are set on SESSION_COOKIE_NAME
  - Add SameSite=Strict
  - Set short expiration (15-30 min) with refresh token rotation
  - Implement CSRF tokens for state-changing operations

## Performance Bottlenecks

**Rate Limit Query N+1:**
- Problem: Rate limit check queries both tasks table AND does a join with taskMessages table (lines 21-38 in `lib/utils/rate-limit.ts`). Called on every task creation.
- Files: `lib/utils/rate-limit.ts`
- Cause: Separate queries for tasks and messages; no index on taskMessages.createdAt or taskMessages.taskId.
- Improvement path:
  - Add composite index on (taskMessages.taskId, taskMessages.createdAt, taskMessages.role)
  - Consider single aggregated query with COUNT
  - Cache rate limit check result with TTL (5 min)
  - Pre-calculate message counts in tasks table

**Logs Array Bloat:**
- Problem: Task logs stored as JSONB array in single column; entire array fetched on every read (lines 37-38 in `lib/utils/task-logger.ts`). Array grows unbounded.
- Files: `lib/db/schema.ts` (logs field), `lib/utils/task-logger.ts`
- Cause: Fetching full task = fetching full logs; appending requires full update.
- Improvement path:
  - Create separate taskLogs table with foreign key to tasks
  - Implement pagination for log retrieval
  - Add log archival for completed tasks
  - Use streaming/chunked log delivery to frontend

**Repo Cloning Per Task:**
- Problem: Every task clones entire repository from GitHub (lines 98-104 in `lib/sandbox/creation.ts`). No caching of repo between tasks.
- Files: `lib/sandbox/creation.ts`
- Cause: Each sandbox is fresh with no shared volumes or cache.
- Improvement path:
  - Implement Vercel Sandbox cache layer for common repos
  - Use git shallow clone with depth=1 (already done)
  - Consider monorepo-specific clone strategies
  - Cache node_modules between task runs on same repo

**Sandbox Creation Timeout Default:**
- Problem: Default sandbox timeout 60 minutes (line 62 in `lib/sandbox/creation.ts`) is excessive for most tasks; ties up resources.
- Files: `lib/sandbox/creation.ts`, `lib/db/schema.ts` (maxDuration default)
- Cause: Fallback to 1 hour when no timeout specified.
- Improvement path:
  - Lower default to 10-15 minutes based on usage patterns
  - Implement early termination when task completes
  - Add configurable timeout per agent type
  - Monitor actual task durations to optimize defaults

## Fragile Areas

**Agent Execution Result Type Inconsistency:**
- Files: `lib/sandbox/agents/index.ts`, `lib/sandbox/agents/claude.ts`, `lib/sandbox/agents/codex.ts`, `lib/sandbox/agents/opencode.ts`
- Why fragile: Six agent implementations (claude, codex, copilot, cursor, gemini, opencode) all return similar AgentExecutionResult but with inconsistent fields. Some set changesDetected, some don't. Parameter lists differ (agentMessageId only in claude and copilot).
- Safe modification:
  - Create strict interface with all required fields
  - Enforce consistency across all agent implementations
  - Add test suite verifying all agents return complete results
  - Use discriminated unions if agents need different result types
- Test coverage: No test files found for agent implementations.

**GitHub Callback Route Complexity:**
- Files: `app/api/auth/github/callback/route.ts` (231 lines)
- Why fragile: Single route handler manages both sign-in flow (new user) and connect flow (existing user adding GitHub account). Complex nested conditions, cookie pattern fallbacks, account merge logic all in one function. Easy to introduce bugs during maintenance.
- Safe modification:
  - Split into separate sign-in and connect handlers
  - Extract account merge logic to separate function with transaction safety
  - Add explicit test cases for: new sign-in, account link, account merge, edge cases
  - Implement database transaction wrapping account updates
- Test coverage: No tests found.

**Task Deletion Query Logic:**
- Files: `app/api/tasks/route.ts` (lines 90-136)
- Why fragile: DELETE handler dynamically builds status conditions using or() function (line 124). Complex condition logic with array manipulation. Easy to accidentally delete wrong tasks if action parsing changes.
- Safe modification:
  - Validate actions array before building conditions
  - Use explicit type-safe action mapping (enum or record)
  - Add unit tests covering all action combinations
  - Consider hard requirement for explicit IDs instead of status-based bulk delete
- Test coverage: No tests found.

**Sandbox Registry Memory Leak:**
- Files: `lib/sandbox/sandbox-registry.ts`
- Why fragile: Map stores Sandbox objects indefinitely. No automatic cleanup if stopSandbox never called. No size limits or warnings.
- Safe modification:
  - Add WeakMap for automatic cleanup when Sandbox is garbage collected
  - Implement cleanup timer (mark-and-sweep) for sandboxes inactive > 1 hour
  - Add metrics/monitoring for active sandbox count
  - Implement maximum sandbox limits
- Test coverage: No tests found.

**Encryption/Decryption Error Messages:**
- Files: `lib/crypto.ts`
- Why fragile: Throws errors with full message passed to client (lines 61). Decryption error message includes original error details that might leak information.
- Safe modification:
  - Return generic error message to client
  - Log detailed errors server-side only
  - Never include decryption failure reasons in API responses
- Test coverage: No tests found for crypto functions.

## Scaling Limits

**Rate Limit UTC Boundary Issues:**
- Current capacity: 50 messages per day per user (configurable via MAX_MESSAGES_PER_DAY)
- Limit: No handling for users spanning UTC boundary; request at 23:59 UTC and 00:01 UTC could bypass limits if queries execute out of order.
- Scaling path: Implement monotonic clock-based time windows; use database for authoritative time; add request deduplication by ID.

**Sandbox Resource Constraints:**
- Current capacity: 4 vCPU per sandbox (configurable in sandbox config line 72)
- Limit: Vercel Sandbox has global resource pool; no prioritization or queuing when resources exhausted. Concurrent user requests compete for sandboxes.
- Scaling path: Implement request queue with priority levels; add sandbox resource monitoring; implement fair-share scheduling; document max concurrent users.

**Database Connection Pool:**
- Current capacity: Default Next.js pool (typically 10-20 connections)
- Limit: TaskLogger performs DB operations on every log message. High-concurrency scenarios (5+ simultaneous tasks) exhaust pool quickly.
- Scaling path: Implement connection pooling at library level; switch to Neon serverless with connection pooling; batch logging operations; implement async queue for non-critical writes.

**Task History Unbounded Growth:**
- Current capacity: Logs JSONB array per task; no archival
- Limit: Completed tasks accumulate logs indefinitely; large logs = slow task fetch queries
- Scaling path: Implement log archival (move old logs to separate table after 30 days); add partition on createdAt; implement TTL deletion policy; compress logs before storage.

## Dependencies at Risk

**@vercel/sandbox 0.0.21:**
- Risk: Pre-1.0 version; API could change; no stability guarantees. Three recent commits in git history indicate active development but may be abandonment.
- Impact: Breaking changes could force major refactoring of sandbox creation and command execution.
- Migration plan: Monitor Vercel/sandbox repository for deprecation notices. Have backup plan to migrate to Docker containers or AWS CodeBuild if abandoned.

**ai 5.0.51:**
- Risk: Major version pinned but package.json shows version 5.0.51 (specific patch). Anthropic SDK frequently updates; may have deprecated methods.
- Impact: SDK functions used in agent implementations may become unavailable.
- Migration plan: Set up automated dependency scanning; test upgrade path to ai 6.x; review Anthropic changelog monthly.

**drizzle-orm 0.36.4 with Next.js 16.0.10:**
- Risk: ORM and framework versions may not align; drizzle is rapidly evolving.
- Impact: Query patterns may break; performance optimizations may be lost.
- Migration plan: Pin drizzle version after testing; monitor drizzle migration guides; allocate quarterly time for updates.

**jose 6.1.3 (JWT/JWE):**
- Risk: Cryptographic library; vulnerabilities here are critical. Keep updated.
- Impact: Session handling could be compromised.
- Migration plan: Set up automated security scanning (npm audit, Snyk); update immediately on security releases; review JWE encryption settings monthly.

## Missing Critical Features

**Sandbox Cancellation Mechanism:**
- Problem: onCancellationCheck callbacks exist but only check before major operations. Agent execution can't be interrupted mid-operation (line 37 in agents/index.ts).
- Blocks: Users can't stop stuck long-running agent operations; they must wait for timeout.
- Recommendation: Implement interrupt signals to running processes; add heartbeat mechanism to detect stuck operations; implement graceful shutdown path in agent CLIs.

**Audit Logging:**
- Problem: No audit trail for sensitive operations (OAuth connects, API key storage, task deletions, account merges).
- Blocks: Can't investigate who did what when; security investigations impossible.
- Recommendation: Create auditLog table; log all authentication/authorization decisions; log all data modifications with user ID and timestamp.

**Database Transaction Safety:**
- Problem: Account merge (lines 160-171 in github/callback route) and task creation with message save (lines 72-81 in tasks/route.ts) lack transaction wrapping.
- Blocks: Partial failures leave database in inconsistent state; no rollback capability.
- Recommendation: Wrap multi-step operations in database transactions; use Drizzle transaction API; add constraint checks to prevent orphaned records.

**Monitoring and Alerting:**
- Problem: No metrics on sandbox success rates, task failure rates, rate limit hits, database performance.
- Blocks: Can't detect degradation; hard to debug production issues; no visibility into scaling limits.
- Recommendation: Implement OpenTelemetry or Prometheus metrics; add dashboard for task status distribution; alert on error rate > 5%; monitor database query times.

**Dead Letter Queue for Failed Operations:**
- Problem: Failed async operations (message saves, logging) are silently dropped. No retry mechanism.
- Blocks: Data loss on transient failures; no recovery path.
- Recommendation: Implement persistent queue (Bull, Inngest); add retry logic with exponential backoff; implement dead letter queue for permanent failures; add observability for queue health.

## Test Coverage Gaps

**Agent Execution Consistency:**
- What's not tested: All six agent implementations (claude, codex, copilot, cursor, gemini, opencode)
- Files: `lib/sandbox/agents/claude.ts`, `lib/sandbox/agents/codex.ts`, `lib/sandbox/agents/copilot.ts`, `lib/sandbox/agents/cursor.ts`, `lib/sandbox/agents/gemini.ts`, `lib/sandbox/agents/opencode.ts`
- Risk: Agents may fail silently; inconsistent result types leak to API; result field mismatches (changesDetected, agentResponse) cause runtime errors.
- Priority: High. Agents are core to application functionality.

**OAuth Callback Logic:**
- What's not tested: State validation, cookie handling, sign-in vs. connect flows, account merge edge cases
- Files: `app/api/auth/github/callback/route.ts`
- Risk: OAuth vulnerabilities; CSRF attacks; account takeover during merge; data loss during merge.
- Priority: Critical. Security-sensitive code.

**Rate Limiting:**
- What's not tested: UTC boundary conditions, concurrent requests, custom limits per user
- Files: `lib/utils/rate-limit.ts`, `app/api/tasks/route.ts`
- Risk: Rate limit bypass; resource exhaustion; fairness issues.
- Priority: High. Affects user experience and system stability.

**Sandbox Lifecycle:**
- What's not tested: Sandbox creation, cleanup, error handling, timeout behavior, concurrent sandbox operations
- Files: `lib/sandbox/creation.ts`, `lib/sandbox/sandbox-registry.ts`
- Risk: Resource leaks; orphaned sandboxes; race conditions; unhandled failures.
- Priority: High. Core infrastructure concern.

**Database Operations:**
- What's not tested: Task creation with message save, soft-delete consistency, schema validation
- Files: `app/api/tasks/route.ts`, `lib/utils/task-logger.ts`, `lib/db/schema.ts`
- Risk: Data corruption; inconsistent state; type mismatches at runtime.
- Priority: Medium. Data integrity critical but less likely to fail.

**Error Handling Paths:**
- What's not tested: Encryption failures, invalid task IDs, unauthorized access, malformed requests
- Files: `lib/crypto.ts`, `app/api/tasks/[taskId]/route.ts`, all API routes
- Risk: Unhandled exceptions; cryptic error messages to users; security info leakage.
- Priority: Medium. Affects reliability and user experience.

---

*Concerns audit: 2026-02-01*
