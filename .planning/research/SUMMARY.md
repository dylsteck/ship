# Project Research Summary

**Project:** Background Agent Platform with Sandboxed Execution
**Domain:** Autonomous Coding Agents (SaaS)
**Researched:** 2026-02-01
**Confidence:** HIGH

## Executive Summary

This project is a background agent platform that enables autonomous coding agents to work on developer tasks in secure, isolated sandbox environments. Expert implementations (Ramp Inspect, Devin, Cursor Background) use a distributed architecture with edge compute for orchestration, secure microVMs for execution, and real-time communication for status updates. The recommended approach leverages Cloudflare Workers with Durable Objects for stateful coordination, E2B sandboxes for isolated code execution, and OpenCode SDK for the agent framework.

The critical architectural decision is using one Durable Object per session (not a global singleton) to avoid bottlenecks at scale. E2B sandboxes provide ~150ms cold starts and VM-level isolation, making them ideal for secure agent execution. The main risks are sandbox lifecycle mismanagement (unexpected terminations), in-memory state loss in Durable Objects (hibernation), and WebSocket connection reliability for real-time updates. All three require explicit handling from day one—they cannot be retrofitted.

Cost management is paramount: idle sandboxes billing per-second can destroy economics. Implement aggressive 5-minute idle timeouts and automatic cleanup. The winning pattern is: Cloudflare Workers for routing → Durable Objects for session state → E2B sandboxes for execution → WebSockets for real-time → R2 for artifacts. This architecture scales horizontally, maintains strong consistency per session, and keeps costs predictable.

## Key Findings

### Recommended Stack

The stack centers on Cloudflare's edge platform for coordination and E2B for execution. Cloudflare Workers provide zero cold starts and global distribution for API routing. Durable Objects with SQLite storage (GA January 2026) offer strongly consistent state management per session. E2B sandboxes deliver secure, isolated execution environments with fast startup times. OpenCode SDK provides the agent framework with built-in tool support and multi-provider LLM access.

**Core technologies:**
- **Cloudflare Workers + Durable Objects**: Edge compute with stateful coordination—zero cold starts, one DO per session eliminates bottlenecks, SQLite storage provides persistence
- **E2B Sandboxes (Firecracker microVMs)**: Secure code execution with ~150ms cold starts, 30-day persistence, VM-level isolation prevents cross-contamination
- **OpenCode SDK**: Agent framework with 75+ AI provider support, programmatic control, tool permissions system prevents runaway execution
- **Next.js 15+ with React 19**: Frontend framework with Server Components, stable ecosystem, first-class TypeScript support
- **Drizzle ORM + Neon PostgreSQL**: Serverless-ready database layer, lightweight ORM for edge runtimes, auto-scaling connection pooling
- **Hono**: Ultra-fast web framework for Worker API routes, zero dependencies, officially used by Cloudflare for internal APIs
- **R2 Storage**: Zero egress fees for artifacts/screenshots, S3-compatible, unlimited storage compared to DO's 10GB limit

### Expected Features

The MVP requires nine core features to complete the user loop: assign Linear issue → agent works autonomously → creates PR → human reviews. Every table stakes feature (sandbox, git, terminal, browser, context awareness) is non-negotiable—missing any breaks the agent workflow. Multi-step autonomous execution is the key differentiator from autocomplete tools.

**Must have (table stakes):**
- Secure sandbox environment (code-server, terminal, browser)—users expect isolated execution without local machine risks
- Multi-step autonomous execution with error handling—agents must complete full tasks, not just respond to prompts
- Context awareness across codebase—required for quality; agents need to understand project structure and dependencies
- Git integration (branch, commit, push, PR creation)—essential for delivering work to review
- GitHub and Linear integrations—primary use case is "agent works on tickets from issue tracker"
- Session persistence and real-time status updates—background work requires state persistence and progress visibility
- Basic observability (logs, traces)—debugging failures is critical from day one

**Should have (competitive):**
- Multi-model support—let users choose Claude/GPT-4/etc for cost optimization or specific capabilities
- Confidence scoring—agent self-assessment reduces wasted work on low-confidence tasks
- Auto-testing & validation—reduces review burden, agent writes tests before creating PR
- Cost tracking per task—transparency builds trust, enables budget optimization
- Semantic code search—natural language search beats grep for large codebases
- Slack integration—high engagement feature for teams, agent responds to mentions

**Defer (v2+):**
- Multi-agent orchestration—adds massive complexity; single agent must work reliably first
- Visual component editing—frontend-specific, high complexity, serves subset of users
- Proactive agent behavior—requires event-driven architecture redesign
- Parallel background sessions—resource management complexity; Cursor spent months on this

### Architecture Approach

The architecture follows a control/data plane separation pattern. Cloudflare Workers handle routing and authentication, creating Durable Object stubs for each session. SessionAgent DOs manage per-session state (messages, task status, sandbox lifecycle) with SQLite storage for persistence. EventBus DOs use Hibernatable WebSockets for cost-effective real-time broadcasting. E2B sandboxes run OpenCode agents in isolated microVMs, one per session. Storage layers match data characteristics: DO SQLite for hot session data, D1 for global metadata queries, R2 for large artifacts.

**Major components:**
1. **SessionAgent Durable Object (per session)** — Coordinates agent execution, manages sandbox lifecycle, persists conversation history to SQLite, broadcasts events to EventBus
2. **EventBus Durable Object (per session)** — Handles real-time WebSocket connections with hibernation API, broadcasts progress updates to connected clients, reduces costs by 90%+ during idle periods
3. **E2B Sandbox (per session)** — Isolated execution environment with code-server, terminal, and browser; runs OpenCode agent; terminates after idle timeout to control costs
4. **Worker Router** — Authenticates requests, creates DO stubs with entity-based routing, implements RPC-first communication for type safety
5. **Storage Layer** — DO SQLite (hot session state), D1 (global metadata/archives), R2 (artifacts >100KB), appropriate storage prevents bottlenecks and cost issues

### Critical Pitfalls

Research identified seven critical pitfalls. The top five must be addressed in Phase 1 or Phase 2—they cannot be patched later without major rewrites. E2B sandboxes terminate after 5 minutes by default; implement timeout extension on user activity or face constant mid-task failures. Durable Objects global singletons create catastrophic bottlenecks; use one DO per session from the start. In-memory state vanishes on hibernation; persist everything to SQLite storage. WebSocket connections require explicit reconnection logic and message ACKs; 65% of DIY implementations have significant reliability issues. Idle sandboxes destroy economics; implement 5-minute idle timeouts immediately.

1. **E2B Sandbox Lifecycle Mismanagement** — Implement timeout extension, monitor lifetime with getInfo(), checkpoint state every 30-60s, use pause/resume for multi-day sessions
2. **Durable Objects Global Singleton** — Create one DO per session (not global), route by sessionId using idFromName(), enables horizontal scaling and eliminates bottleneck
3. **In-Memory State Loss** — Persist critical state to DO SQLite storage, use write coalescing for batching, implement recovery logic that checks storage first on wake
4. **WebSocket Connection Reliability** — Implement heartbeat (30s intervals), client reconnection with exponential backoff, message ACKs, sequence numbers for gap detection
5. **Sandbox Cost Explosion** — Aggressive 5-minute idle timeout, pause/resume for breaks, destroy sandboxes for 1+ hour idle, track cost-per-session metrics
6. **Workers 128MB Memory Limit** — Stream AI responses via TransformStream (don't buffer), store conversation history in DO storage (not Worker memory), process API responses in chunks
7. **Agent Infinite Loops** — Set conservative steps limit (15-25), circuit breakers after 3 tool failures, operation-level timeouts (30s), use OpenCode's doom_loop: deny permission

## Implications for Roadmap

Based on research, the roadmap should follow a 5-phase structure matching the architecture's natural dependency layers. Start with authentication and database foundations, then build the stateful Durable Objects core, add execution layer with E2B, connect real-time UI via WebSockets, and finally layer on external integrations. This order minimizes blocked work and enables testing each layer independently before adding the next.

### Phase 1: Foundation & Authentication
**Rationale:** Everything depends on auth and database—get foundations right before adding complexity. Workers/DOs/R2 setup must be correct from day one; architectural mistakes here require complete rewrites.

**Delivers:** User authentication, session management, database schema, Cloudflare infrastructure configured

**Addresses:**
- Table stakes: Session persistence (partially)
- Stack: Cloudflare Workers, Next.js 15, D1 database, R2 storage, Arctic/Clerk for OAuth

**Avoids:**
- DO global singleton pitfall by establishing per-session routing pattern from start
- Sandbox cost explosion by building lifecycle management before connecting E2B

**Research flag:** None—authentication patterns are well-documented (Clerk, Arctic). Standard OAuth flows with JWE session cookies.

### Phase 2: Stateful Core (Durable Objects)
**Rationale:** DOs are the heart of the system—build and test them in isolation before connecting external services. SessionAgent state management and EventBus real-time broadcasting are critical paths that block all other features.

**Delivers:** SessionAgent DO with SQLite storage, EventBus DO with hibernatable WebSockets, Worker routing with RPC-first communication

**Addresses:**
- Table stakes: Session persistence (complete), real-time status updates (infrastructure)
- Architecture: Control/data plane separation, RPC-first communication, storage layering pattern

**Avoids:**
- In-memory state loss by implementing SQLite persistence from start
- WebSocket reliability issues by using Hibernatable WebSocket API correctly
- Performance traps by designing storage layering (DO SQLite, D1, R2) upfront

**Research flag:** Moderate—Cloudflare Durable Objects best practices are well-documented, but WebSocket hibernation requires careful implementation. Budget 2-3 days for testing hibernation/wake cycles.

### Phase 3: Execution Layer (E2B + OpenCode)
**Rationale:** Sandbox integration requires working SessionAgent DO. Build sandbox lifecycle management before implementing agent features to control costs from start. OpenCode agent configuration needs custom E2B template.

**Delivers:** E2B sandbox lifecycle in SessionAgent DO, custom E2B template with OpenCode installed, task execution flow, webhook handler for progress updates

**Addresses:**
- Table stakes: Sandbox environment, multi-step autonomous execution, terminal/browser access, context awareness (infrastructure)
- Stack: E2B sandboxes, OpenCode SDK, code-server, Playwright for browser

**Avoids:**
- E2B lifecycle mismanagement by implementing timeout extension and cleanup immediately
- Sandbox cost explosion via aggressive idle timeouts (5 min) and pause/resume
- Agent infinite loops by setting steps limit (15-25) and circuit breakers in OpenCode config
- Workers memory limit by streaming execution output instead of buffering

**Research flag:** High—OpenCode configuration and E2B custom template creation need deeper research. Budget 3-5 days for:
- Creating E2B custom template with OpenCode, code-server, and dependencies
- Configuring OpenCode permissions (doom_loop: deny, external_directory: deny)
- Testing sandbox pause/resume and checkpoint/recovery flows

### Phase 4: Real-Time UI & File Operations
**Rationale:** UI depends on working DOs and E2B. Build frontend once backend is stable to avoid rework. WebSocket client must handle reconnection/message loss from start—cannot bolt reliability onto fragile connections.

**Delivers:** WebSocket client with reconnection logic, session viewer UI, real-time updates from EventBus, file upload to sandbox, artifact download from R2

**Addresses:**
- Table stakes: Real-time status updates (complete), session persistence (UI), basic observability (logs/traces visible in UI)
- Stack: Next.js with React Server Components, shadcn/ui, TanStack Query for data fetching

**Avoids:**
- UX pitfalls by showing visible agent status (planning/executing/stuck) with step count
- Silent failures by surfacing all errors immediately with actionable messages
- No way to stop runaway agents—implement prominent Stop button that kills sandbox

**Research flag:** Low—Next.js + shadcn/ui patterns are standard. WebSocket client reconnection is well-documented. Budget 1-2 days for testing network interruption recovery.

### Phase 5: External Integrations (GitHub, Linear, Vercel)
**Rationale:** Integrations are independent features that can be added incrementally without blocking core functionality. Build in parallel once Phases 1-4 are stable. Each integration adds value but isn't required for others.

**Delivers:** GitHub integration (list repos, create PRs), Linear integration (read issues, update status), Vercel integration (deploy previews)

**Addresses:**
- Table stakes: Git integration, PR creation, GitHub integration, Linear integration (all complete)
- Stack: Octokit for GitHub API, Linear SDK for GraphQL API, Vercel SDK for deployments

**Avoids:**
- API rate limit issues by implementing exponential backoff and caching in DO storage
- Missing webhook verification by validating HMAC signatures for GitHub/Linear webhooks
- Security mistakes by validating all webhook signatures and not trusting external input

**Research flag:** Low-to-moderate—GitHub/Linear/Vercel APIs are well-documented with official SDKs. Rate limiting and webhook verification are standard patterns. Budget 1 day per integration for rate limit testing and webhook security validation.

### Phase Ordering Rationale

- **Phase 1 before Phase 2:** Authentication and database are hard dependencies for Durable Objects (need to validate user sessions)
- **Phase 2 before Phase 3:** SessionAgent DO must exist before integrating E2B (DO manages sandbox lifecycle)
- **Phase 3 before Phase 4:** Backend execution must work before building real-time UI (otherwise UI has nothing to display)
- **Phase 5 last:** Integrations are independent; can build in parallel once core is stable
- **No Phase 6 for v2+ features:** Multi-agent orchestration, visual editing, proactive behavior deferred until post-MVP

This ordering follows architecture research's "Build Order & Dependencies" guidance: Foundation (Weeks 1-2) → Stateful Core (Weeks 3-4) → Execution Layer (Weeks 5-6) → Real-Time UI (Weeks 7-8) → Integrations (Weeks 9-10). Each phase can be tested independently before moving to the next, minimizing rework.

### Research Flags

Phases likely needing deeper research during planning:

- **Phase 3 (Execution Layer):** E2B custom template creation and OpenCode configuration are complex. Need to research: sandbox initialization scripts, OpenCode permission system, tool configuration for GitHub/Linear APIs, checkpoint/recovery patterns. Allocate 3-5 days for this research phase.

- **Phase 2 (Stateful Core):** Durable Objects WebSocket hibernation requires careful implementation. Need to research: hibernation event handlers, connection attachment serialization (2KB limit), message replay on reconnection. Allocate 2-3 days for hibernation testing.

Phases with standard patterns (skip dedicated research-phase):

- **Phase 1 (Foundation):** OAuth flows, Next.js authentication, and D1 database setup are well-documented. Use Clerk or Arctic documentation directly—no custom research needed.

- **Phase 4 (Real-Time UI):** Next.js + React patterns are standard. WebSocket client libraries (native WebSocket API or libraries like reconnecting-websocket) have established patterns.

- **Phase 5 (Integrations):** GitHub/Linear/Vercel SDKs have official documentation and TypeScript types. Rate limiting and webhook patterns are standard—no special research required.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All recommendations verified with official documentation (Cloudflare, E2B, OpenCode, Next.js). Version compatibility confirmed. Security CVEs checked (Next.js CVE-2025-29927 patched in 15.2.3+). |
| Features | MEDIUM-HIGH | Extensive competitor analysis (Ramp Inspect, Devin, Cursor) confirms table stakes features. MVP definition validated against industry standards. Some differentiators (multi-agent, visual editing) deferred to v2 based on complexity. |
| Architecture | HIGH | Control/data plane pattern is Cloudflare's official best practice. Per-session DO pattern confirmed in official docs. Storage layering (DO SQLite, D1, R2) matches Cloudflare guidance. Build order validated against Ramp architecture articles. |
| Pitfalls | HIGH | All critical pitfalls sourced from official Cloudflare best practices, E2B documentation, and production experience reports. Phase mapping verified against architectural dependencies. Recovery strategies tested in community discussions. |

**Overall confidence:** HIGH

Research is comprehensive with official documentation sources. Stack recommendations are production-proven (Ramp uses similar architecture). Feature set validated against multiple competitors. Architecture patterns follow Cloudflare best practices. Critical pitfalls well-documented with prevention strategies.

### Gaps to Address

Minor gaps that need validation during implementation:

- **OpenCode agent tool permissions:** Documentation exists but custom tool creation for GitHub/Linear APIs needs hands-on testing. Plan to build proof-of-concept custom tools in Phase 3 research period.

- **E2B sandbox cost optimization:** Research provides idle timeout guidance (5 min), but optimal timeout may vary by usage patterns. Implement telemetry in Phase 3 to measure actual idle patterns and adjust timeouts accordingly.

- **Durable Objects SQLite storage limits:** 10GB limit per DO is known, but archival frequency to D1 needs tuning based on message volume. Plan to monitor storage usage in Phase 2 and implement archival when approaching 8GB (80% threshold).

- **WebSocket scaling limits:** Hibernatable WebSockets support "thousands of concurrent connections" per DO, but exact limit depends on message frequency. Plan load testing in Phase 4 to determine if EventBus DO needs sharding at scale.

## Sources

### Primary (HIGH confidence)
- Cloudflare Durable Objects Documentation—control/data plane patterns, WebSocket hibernation, storage best practices
- E2B Documentation—sandbox lifecycle, timeout management, custom templates, persistence limits
- OpenCode Documentation—agent configuration, tool permissions, SDK usage, doom loop prevention
- Next.js 15 Documentation—React 19 compatibility, App Router patterns, Server Components
- Ramp Inspect Architecture (InfoQ)—production implementation of background agent platform with similar architecture

### Secondary (MEDIUM confidence)
- E2B Sandbox Benchmark 2026 (Superagent)—cold start times (~90-150ms), performance comparison
- AI Code Sandbox Alternatives Analysis (Better Stack)—cost optimization strategies, sandbox lifecycle patterns
- Background Agent Platform Comparisons (Builder.io, Faros AI)—feature analysis of Devin, Cursor, GitHub Copilot
- Cloudflare Workers Memory Management (Medium)—real-world memory limit failures and solutions
- WebSocket Reliability Best Practices (Ably, Close.com)—reconnection patterns, message ACKs, connection monitoring

### Tertiary (LOW confidence)
- Gartner/Forrester 2026 Trends—AI agent market predictions (directional guidance only, not technical)
- Community blog posts on agent failures—anecdotal evidence of pitfalls, validated against official docs

---
*Research completed: 2026-02-01*
*Ready for roadmap: yes*
