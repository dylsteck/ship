# Pitfalls Research

**Domain:** Background Agent Platform (E2B, Cloudflare Workers, OpenCode SDK)
**Researched:** 2026-02-01
**Confidence:** HIGH

## Critical Pitfalls

### Pitfall 1: E2B Sandbox Lifecycle Mismanagement

**What goes wrong:**
Sandboxes terminate unexpectedly during agent execution, losing work in progress and requiring expensive restarts. The default 5-minute timeout is far too short for most agent workflows, leading to partial executions and incomplete tasks.

**Why it happens:**
Developers assume sandboxes persist like traditional VMs and don't implement proper timeout management. The timeout unit inconsistency (JavaScript uses milliseconds, Python uses seconds) causes confusion. Many developers don't realize that the maximum persistence is 24 hours on Pro tier and only 1 hour on Base tier, requiring monthly recreation after the 30-day deletion policy.

**How to avoid:**
- Implement dynamic timeout extension using `setTimeout()` / `set_timeout()` on user interaction
- Monitor sandbox lifetime with `getInfo()` / `get_info()` and warn users before termination
- Design agent workflows to checkpoint state frequently (every 30-60 seconds)
- Use pause/resume functionality for user sessions spanning multiple days
- Budget for monthly sandbox recreation costs and automate the rebuild process
- Verify timeout units for your language (milliseconds vs seconds)

**Warning signs:**
- Users reporting "agent stopped working mid-task"
- Increased error rates around the 5-minute mark
- High sandbox creation costs relative to actual usage
- Incomplete agent executions without error messages

**Phase to address:**
Phase 1 (Core Infrastructure) - Implement sandbox lifecycle management from the start. This is foundational and cannot be retrofitted easily.

---

### Pitfall 2: Durable Objects Global Singleton Anti-Pattern

**What goes wrong:**
Creating a single Durable Object to handle all background agent sessions creates a catastrophic bottleneck. All requests funnel through one instance, limiting throughput to ~200 requests/second and causing cascading failures as traffic grows. The system appears to work fine in development but collapses under production load.

**Why it happens:**
Developers misunderstand the "Durable" part and think one instance should manage everything. The singleton pattern from traditional OOP doesn't translate to distributed coordination. Cloudflare's documentation emphasizes "atom of coordination," but developers default to global state patterns.

**How to avoid:**
- Create one Durable Object per agent session, user, or workspace
- Model DOs around your coordination atom: individual background jobs, not global state
- Use the pattern: DO per entity (user/workspace/session), not DO per entity type
- For global counters or rate limits, use Workers KV or Queues instead
- Distribute load by entity ID: `const id = env.AGENT_SESSION.idFromName(sessionId)`

**Warning signs:**
- Increasing latency as user count grows
- Single DO instance showing high CPU/memory usage
- Request queuing and timeouts during peak usage
- Cannot scale beyond a few hundred concurrent users

**Phase to address:**
Phase 1 (Core Infrastructure) - This architectural decision must be correct from the start. Migrating from singleton to distributed DOs later requires rewriting the entire coordination layer.

---

### Pitfall 3: In-Memory State Loss in Durable Objects

**What goes wrong:**
Critical agent state (execution history, tool outputs, context) stored in class properties vanishes when the Durable Object hibernates or crashes. Users return to find their agent session completely reset, losing hours of work. WebSocket reconnections fail because per-connection metadata is gone.

**Why it happens:**
Developers treat Durable Objects like traditional stateful classes where properties persist. The documentation clearly warns "In-memory state is not preserved if the Durable Object is evicted from memory due to inactivity, or if it crashes from an uncaught exception," but developers don't internalize this until production failures occur. Hibernation (for cost savings) becomes a data loss mechanism.

**How to avoid:**
- Always persist critical state to SQLite storage, never rely on class properties alone
- Use write coalescing: batch multiple storage writes without intervening `await` calls
- For WebSocket connections, use `serializeAttachment()` to persist per-connection state
- Implement the pattern: in-memory cache + SQLite backing store
- Write state incrementally as operations progress, not at workflow end
- Add recovery logic: check storage first, rebuild from storage on wake

**Warning signs:**
- Users report "session state disappeared"
- WebSocket reconnections create new sessions instead of resuming
- Data loss after periods of inactivity (>10 minutes)
- Debugging shows DO instances being recreated frequently

**Phase to address:**
Phase 1 (Core Infrastructure) - State persistence architecture is foundational. Implement proper storage patterns from day one, including migration patterns for schema changes.

---

### Pitfall 4: WebSocket Connection Reliability Failures

**What goes wrong:**
Agent-to-client WebSocket connections drop silently during network interruptions or server restarts. Messages get lost or delivered out of order. Clients don't reconnect properly, and agents continue executing while disconnected, leading to invisible failures. Users see frozen UIs while agents crash in the background.

**Why it happens:**
WebSockets provide no built-in delivery guarantees or message ordering at the protocol level. The complexity of maintaining long-lived bidirectional connections requires explicit logic for session health, retries, broken connections, and message protocols. Developers assume TCP handles reliability, but application-level failures (DO hibernation, Workers restarts) break connections without client notification. 65% of DIY WebSocket solutions experience significant downtime.

**How to avoid:**
- Implement heartbeat/ping-pong with 30-second intervals to detect dead connections
- Use DO WebSocket hibernation API (`acceptWebSocket()`, `getWebSockets()`) for cost-effective persistence
- Add client-side reconnection with exponential backoff (max 5 retries, 2s to 30s intervals)
- Implement message ACKs: client confirms receipt, server retries on timeout
- Use message sequence numbers to detect gaps and handle out-of-order delivery
- Store undelivered messages in DO storage for replay on reconnection
- Add connection state to UI: show "connected", "reconnecting", "disconnected"
- Implement idempotent message handlers (messages may be delivered multiple times)

**Warning signs:**
- Users report UI "freezing" but agent still executing
- Missing real-time updates during task execution
- Error rates spike during network issues or deployments
- WebSocket connection count doesn't match active sessions

**Phase to address:**
Phase 2 (Real-time Communication) - Build robust WebSocket infrastructure before enabling real-time features. Cannot bolt reliability onto existing fragile connections.

---

### Pitfall 5: Sandbox Cost Explosion from Idle Time

**What goes wrong:**
E2B sandbox costs spiral out of control because sandboxes run continuously even when idle. A single user keeping a session open overnight costs 12 hours of compute ($7-15 depending on tier). Multiply by hundreds of users and monthly costs become unsustainable. The per-second billing model punishes always-on architectures.

**Why it happens:**
Developers design agents like long-running servers instead of on-demand executors. The pattern "create sandbox on session start, keep until user leaves" seems natural but is economically disastrous. Sandboxes bill per second while running, and the default keep-alive behavior keeps them active. Without automatic pause/kill logic, sandboxes accumulate costs during coffee breaks, meetings, and overnight.

**How to avoid:**
- Implement aggressive idle timeout: pause/kill sandbox after 5 minutes of inactivity
- Use E2B pause/resume for mid-session breaks (15+ minutes idle)
- Destroy sandboxes completely for end-of-day (1+ hour idle), recreate on return
- Track "last activity" timestamp, run cleanup cron every 5 minutes
- Show cost-per-session metrics in admin dashboard to detect runaway usage
- Set per-user sandbox limits (max 2-3 concurrent sandboxes)
- Use sandbox pooling: share sandboxes across similar tasks when possible
- Budget for actual usage patterns: 20-30% of users will leave tabs open indefinitely

**Warning signs:**
- Monthly E2B costs growing faster than user count
- Average sandbox duration exceeding 30 minutes per session
- Many sandboxes in "idle" state on E2B dashboard
- Cost spikes not correlating with feature usage

**Phase to address:**
Phase 1 (Core Infrastructure) - Implement lifecycle management with aggressive cleanup from the start. Retrofitting cost controls after users expect "always available" sessions causes UX disruption.

---

### Pitfall 6: Cloudflare Workers 128MB Memory Limit Exceeded

**What goes wrong:**
Workers crash with "exceeded memory limit" errors during agent execution, particularly when streaming large responses from AI models, loading substantial codebases into context, or accumulating execution history over long-running sessions. The error is often misreported as "exceeded CPU" because garbage collection spikes CPU when approaching memory limits.

**Why it happens:**
The 128MB per-isolate limit is much smaller than developers expect. Buffering AI model responses, storing full conversation history, loading multiple files for context, or caching GitHub/Linear API responses quickly exhausts memory. Developers write code that works in Node.js (unlimited memory) but fails in Workers' constrained environment.

**How to avoid:**
- Stream AI responses using TransformStream instead of buffering complete responses
- Store conversation history in DO storage or KV, not in Worker memory
- Use cursor-based pagination for GitHub/Linear API responses, process in chunks
- Implement context window management: keep only last N messages in memory
- Avoid loading entire repositories; fetch files on-demand as agents request them
- Use Cloudflare Streams API for large file operations
- Monitor memory usage: log `process.memoryUsage()` at operation boundaries
- Design for stateless Workers: each request should complete in <10MB memory

**Warning signs:**
- Intermittent "exceeded memory limit" or "exceeded CPU" errors
- Errors correlate with conversation length or codebase size
- Memory errors during AI model response streaming
- Failures when multiple agents run concurrently

**Phase to address:**
Phase 2 (Agent Execution) - Address before enabling multi-file operations or long conversations. Memory architecture decisions (streaming vs buffering) must be made early.

---

### Pitfall 7: OpenCode Agent Infinite Loops and Runaway Costs

**What goes wrong:**
AI agents enter infinite loops, repeatedly attempting the same failed operation, retrying tool calls that will never succeed, or getting stuck in planning cycles. Costs explode as the agent burns through API calls. The agent never surfaces the error to users, appearing "busy" indefinitely while racking up charges.

**Why it happens:**
LLMs lack true self-awareness about failure states. Without explicit loop detection, agents retry failed operations hoping for different results. Tool failures that should halt execution (API rate limits, invalid credentials, file not found) get interpreted as temporary issues. The `steps` limit prevents truly infinite loops but defaults to high values (50-100 steps), allowing substantial damage before halting.

**How to avoid:**
- Set conservative `steps` limit (15-25 for most tasks) in agent configuration
- Implement tool-level circuit breakers: after 3 consecutive failures, return hard error
- Add operation-level timeouts: individual tool calls should complete in <30 seconds
- Track retry counts in DO state, halt after 3 attempts on same operation
- Use OpenCode's `doom_loop: deny` permission to prevent infinite loops
- Implement cost limits: halt agent after $X in API calls per session
- Surface agent state to users: show "stuck" status after N consecutive failures
- Add exponential backoff to retries: 2s, 4s, 8s delays between attempts
- Log agent decision trails for debugging loop patterns

**Warning signs:**
- Sessions showing high step counts (>30 steps)
- Same tool being called repeatedly with identical parameters
- API costs spiking without corresponding successful completions
- Agent sessions running for 30+ minutes without user interaction
- Error logs showing repeated failures of the same operation

**Phase to address:**
Phase 2 (Agent Execution) - Implement before enabling autonomous agent operation. Loop prevention must be built into the agent framework, not added as a patch.

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Polling instead of WebSockets | Simpler implementation, no connection management | 10-100x more Workers requests, higher latency, poor UX | Never - WebSocket complexity is unavoidable for real-time agents |
| Single DO for all sessions | Faster initial development | Catastrophic bottleneck, requires complete rewrite at scale | Never - distributed DOs are fundamental to architecture |
| No timeout management on E2B | Fewer lines of code | Unpredictable failures, poor UX, wasted costs | Never - timeout handling is 10 lines but prevents major issues |
| Buffering AI responses | Simpler code flow | Memory limit crashes, cannot stream to users | Only for very short responses (<1KB) or non-streaming UIs |
| Storing conversation in Worker memory | Fast access, no storage calls | Memory limits, state loss on hibernation | Only for stateless request-response (not agent sessions) |
| No message ACKs on WebSocket | Simpler protocol | Silent message loss, inconsistent state | Only for non-critical notifications where loss is acceptable |
| Manual sandbox cleanup | Skip automation complexity | Runaway costs, requires constant monitoring | Only during initial prototype (<10 users) |
| Global rate limiting in single DO | Easiest to implement | Bottleneck, single point of failure | Never - use Workers KV or distributed counters instead |

## Integration Gotchas

Common mistakes when connecting to external services.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| E2B Sandbox | Assuming sandboxes persist indefinitely | Implement timeout extension, pause/resume, and checkpoint state frequently |
| GitHub API | Not handling rate limits (5000/hour authenticated) | Implement exponential backoff, cache responses in DO storage, use conditional requests with ETags |
| Linear API | Webhook signature verification missing | Always verify webhook signatures using Linear's secret to prevent spoofing |
| Vercel API | Missing `teamId` query parameter for team projects | Check access_token response for team scope, add teamId to all API calls |
| OpenCode SDK | Using `any` timeout without step limits | Set explicit `steps` limit (15-25) and operation-level timeouts (30s) |
| Cloudflare DO | Not awaiting RPC calls on stubs | Always `await` method calls: `await stub.method()`, not `stub.method()` |
| WebSockets | No reconnection logic on client | Implement exponential backoff reconnection with max 5 retries |
| AI Model APIs | Buffering streaming responses | Use TransformStream to process streaming responses chunk-by-chunk |

## Performance Traps

Patterns that work at small scale but fail as usage grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Loading full codebase into DO memory | Slow response times, memory errors | Store file tree in SQLite, load files on-demand | >50MB codebases or >100 files |
| Storing all agent history in single DO | Increasing latency, storage timeouts | Partition by time period, archive old sessions to R2 | >10,000 messages per session |
| Synchronous GitHub API calls | Request timeouts, slow agent execution | Parallelize API calls, batch requests, cache aggressively | >100 API calls per session |
| No connection pooling to external APIs | Connection overhead, rate limit exhaustion | Reuse HTTP clients, implement request queuing | >10 requests/second |
| Full table scans in DO SQLite | Query timeouts, high CPU usage | Create indexes on frequently-queried columns | >10,000 rows in table |
| Broadcasting to all WebSocket clients on every update | High CPU, message delivery delays | Send updates only to affected clients, batch updates | >100 concurrent connections per DO |
| Storing large files in DO storage | Storage limit errors, slow reads | Store large files in R2, keep metadata in DO | Files >10MB |
| Creating new E2B sandbox per tool execution | High latency, excessive costs | Reuse sandboxes within session, implement sandbox pooling | >5 tool executions per minute |

## Security Mistakes

Domain-specific security issues beyond general web security.

| Mistake | Risk | Prevention |
|---------|------|------------|
| Not validating OpenCode tool permissions | Agent can execute arbitrary bash commands, modify any file | Use OpenCode's granular permissions with `deny` defaults, whitelist specific commands with glob patterns |
| Missing webhook signature verification | Attackers can forge GitHub/Linear events, trigger unauthorized operations | Verify HMAC signatures using secret keys for all webhook endpoints |
| Storing API tokens in DO in-memory state | Tokens lost on hibernation, logged in error traces | Store tokens in DO SQLite with encryption, use Workers Secrets for static keys |
| No sandbox resource limits | Runaway processes consume CPU/memory indefinitely, DoS attack vector | Set E2B sandbox CPU/memory limits, implement kill-on-timeout |
| Trusting user-provided file paths | Path traversal attacks, access to system files | Validate paths with allowlist, use `external_directory: deny` in OpenCode |
| No rate limiting per user | Single user can exhaust API quotas, increase costs for all users | Implement per-user rate limits in DO (N requests per minute) |
| Exposing internal error details via WebSocket | Information leakage about system architecture, file paths, credentials | Sanitize error messages sent to clients, log full errors server-side only |
| No timeout on AI model API calls | Malicious prompts can cause indefinite hangs, tie up resources | Set 30-second timeout on all AI API calls, implement fallback responses |

## UX Pitfalls

Common user experience mistakes in this domain.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| No visible indication of agent status | Users don't know if agent is working, stuck, or failed | Show real-time status: "Planning", "Executing", "Stuck", with step count |
| Silent failures during execution | Users assume success, discover failures later | Surface all errors immediately with actionable messages: "GitHub rate limit - retry in 15 minutes" |
| No way to stop runaway agents | Users forced to close browser, waste credits, frustration | Add prominent "Stop" button that immediately kills agent and sandbox |
| Loading states that never resolve | Users abandon sessions, assume system is broken | Implement timeout UIs: show "Taking longer than expected" after 30s, offer to retry |
| No persistence of work on disconnect | Users lose progress on network issues, must restart tasks | Checkpoint state every 30s, enable resume-from-checkpoint on reconnection |
| Real-time updates without conversation history | Users can't see what agent did, difficult to debug | Maintain complete execution log with timestamps, make it searchable |
| No cost visibility during execution | Bill shock when users see monthly invoice | Show estimated cost in real-time: "This session: $0.43 (15 API calls, 3 min sandbox time)" |
| Agent continues after user leaves | Wasted resources, unexpected costs, outdated results | Detect tab close/visibility change, pause agent after 60s of inactivity |

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **WebSocket implementation:** Often missing reconnection logic, message ACKs, and proper error handling - verify heartbeat mechanism and test network interruption recovery
- [ ] **E2B sandbox lifecycle:** Often missing timeout extension, pause/resume, and cleanup - verify sandboxes are killed when idle and users warned before timeout
- [ ] **Durable Object state:** Often missing SQLite persistence for critical data - verify in-memory state has storage backing and recovery from hibernation works
- [ ] **Agent error handling:** Often missing circuit breakers and retry limits - verify agents halt after 3 failures and don't enter infinite loops
- [ ] **Cost controls:** Often missing idle timeout, per-user limits, and visibility - verify sandboxes terminate on inactivity and cost metrics are tracked
- [ ] **Real-time sync:** Often missing conflict resolution and offline support - verify concurrent edits are handled and state recovers from disconnection
- [ ] **API integration:** Often missing rate limit handling, webhook verification, and exponential backoff - verify GitHub/Linear APIs handle 429s and verify signatures
- [ ] **Memory management:** Often missing streaming for large responses - verify Workers don't buffer entire AI responses or codebase files

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Sandbox timeout during execution | MEDIUM | Implement checkpoint/resume: save execution state to DO storage every 30s, restore on new sandbox creation. Show user "Session interrupted - resuming..." message. |
| Durable Object singleton bottleneck | HIGH | Complete rewrite: migrate to distributed DOs with entity-based routing. Requires data migration and careful rollout. Expect 2-4 weeks of work. |
| In-memory state loss | MEDIUM | Add storage backing: implement write-through cache pattern where all state writes go to SQLite. Requires schema design and migration path. |
| WebSocket connection failure | LOW | Client-side: implement reconnection with exponential backoff. Server-side: store undelivered messages for replay. Usually 1-2 days of work. |
| Cost explosion from idle sandboxes | LOW | Add cleanup cron job: scan all active sessions, kill sandboxes idle >5 minutes. Implement in DO alarm handler. Can deploy in hours. |
| Memory limit exceeded | MEDIUM | Refactor to streaming: replace buffering with TransformStream, move history to storage. Requires testing under load. 3-5 days typically. |
| Agent infinite loop | LOW | Add step limit and retry tracking: store retry counts in DO state, halt after N failures. Can implement in 1 day. |
| Missing webhook signature verification | LOW | Add verification middleware: implement HMAC validation on webhook routes. Can deploy in hours but requires testing. |

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| E2B Sandbox Lifecycle Mismanagement | Phase 1: Core Infrastructure | Test: Create session, verify timeout extension works, check cleanup after idle period |
| DO Global Singleton Anti-Pattern | Phase 1: Core Infrastructure | Test: Create 100 concurrent sessions, verify each gets own DO instance and no bottleneck |
| In-Memory State Loss in DOs | Phase 1: Core Infrastructure | Test: Simulate DO hibernation, verify state persists and recovers correctly |
| WebSocket Connection Reliability | Phase 2: Real-time Communication | Test: Kill connection mid-session, verify reconnect + message replay works |
| Sandbox Cost Explosion | Phase 1: Core Infrastructure | Test: Leave session idle 10 minutes, verify sandbox killed and cost metrics tracked |
| Workers Memory Limit Exceeded | Phase 2: Agent Execution | Test: Stream large AI response + load 100 files, verify memory stays <100MB |
| Agent Infinite Loops | Phase 2: Agent Execution | Test: Create failing tool, verify agent halts after 3 retries and surfaces error |
| Missing API Rate Limit Handling | Phase 3: External Integrations | Test: Exhaust GitHub rate limit, verify exponential backoff and user notification |

## Sources

**E2B Sandbox:**
- [E2B Sandbox Lifecycle Documentation](https://e2b.dev/docs/sandbox)
- [E2B Breakdown Analysis](https://memo.d.foundation/breakdown/e2b)
- [Best Alternatives to E2B for Secure Sandboxes](https://northflank.com/blog/best-alternatives-to-e2b-dev-for-running-untrusted-code-in-secure-sandboxes)
- [E2B Sandbox Cost Optimization](https://betterstack.com/community/comparisons/best-sandbox-runners/)
- [AI Code Sandbox Benchmark 2026](https://www.superagent.sh/blog/ai-code-sandbox-benchmark-2026)

**Cloudflare Durable Objects:**
- [Rules of Durable Objects](https://developers.cloudflare.com/durable-objects/best-practices/rules-of-durable-objects/)
- [Durable Object State Management](https://developers.cloudflare.com/durable-objects/api/state/)
- [Access Durable Objects Storage Best Practices](https://developers.cloudflare.com/durable-objects/best-practices/access-durable-objects-storage/)
- [Durable Objects: Easy, Fast, Correct — Choose Three](https://blog.cloudflare.com/durable-objects-easy-fast-correct-choose-three/)
- [WebSocket Hibernation with Durable Objects](https://developers.cloudflare.com/durable-objects/examples/websocket-hibernation-server/)
- [Debugging WebSocket Hibernation](https://thomasgauvin.com/writing/how-cloudflare-durable-objects-websocket-hibernation-works/)

**Cloudflare Workers:**
- [Cloudflare Workers Platform Limits](https://developers.cloudflare.com/workers/platform/limits/)
- [Workers Memory Management Nightmare](https://medium.com/@morphinewan_37034/when-a-20mb-file-crashed-my-cloudflare-worker-an-indie-developers-memory-management-nightmare-1fc6d52ce46b)
- [Long-Running Background Tasks in Workers](https://developers.cloudflare.com/workflows/reference/limits/)
- [Cloudflare Workflows for Long Tasks](https://workers.cloudflare.com/product/workflows/)

**OpenCode SDK:**
- [OpenCode Agents Documentation](https://opencode.ai/docs/agents/)
- [Writing OpenCode Agent Skills: Practical Guide](https://blog.devgenius.io/writing-opencode-agent-skills-a-practical-guide-with-examples-870ff24eec66)
- [How Coding Agents Actually Work: Inside OpenCode](https://cefboud.com/posts/coding-agents-internals-opencode-deepdive/)

**WebSocket Reliability:**
- [WebSocket Reliability in Realtime Infrastructure](https://ably.com/topic/websocket-reliability-in-realtime-infrastructure)
- [WebSocket Architecture Best Practices](https://ably.com/topic/websocket-architecture-best-practices)
- [How We Improved Reliability of WebSocket Connections](https://making.close.com/posts/reliable-websockets/)
- [WebSocket Common Issues and Solutions](https://appmaster.io/blog/websocket-common-issues-and-solutions)

**AI Agent Architecture:**
- [5 Key Trends Shaping Agentic Development in 2026](https://thenewstack.io/5-key-trends-shaping-agentic-development-in-2026/)
- [Agentic AI Design Patterns (2026 Edition)](https://medium.com/@dewasheesh.rana/agentic-ai-design-patterns-2026-ed-e3a5125162c5)
- [Error Recovery and Fallback Strategies in AI Agents](https://www.gocodeo.com/post/error-recovery-and-fallback-strategies-in-ai-agent-development)
- [Sandbox Escalation - Codex Agentic Patterns](https://artvandelay.github.io/codex-agentic-patterns/learning-material/16-sandbox-escalation/)
- [15 Best Practices for Deploying AI Agents in Production](https://blog.n8n.io/best-practices-for-deploying-ai-agents-in-production/)
- [7 Types of AI Agent Failure and How to Fix Them](https://galileo.ai/blog/prevent-ai-agent-failure)

**Security and Sandboxing:**
- [Browser Sandboxing for Coding Agents: 2026 Security Guide](https://blaxel.ai/blog/browser-sandboxing-for-coding-agents)
- [TypeScript Secure Coding Best Practices](https://www.aptori.com/blog/secure-coding-in-typescript-best-practices-to-build-secure-applications)

**Integration Patterns:**
- [GitHub to Linear Webhook Integration](https://tryzero.com/blog/updating-a-linear-issue-from-a-github-pull-request-using-webhooks)

---
*Pitfalls research for: Background Agent Platform with E2B, Cloudflare Workers, and OpenCode SDK*
*Researched: 2026-02-01*
