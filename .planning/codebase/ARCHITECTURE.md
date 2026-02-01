# Architecture

**Analysis Date:** 2026-02-01

## Pattern Overview

**Overall:** Full-stack Next.js application with API-driven client-server architecture and serverless sandbox integration.

**Key Characteristics:**
- Server-side rendering for pages with authentication guards
- Client-side state management via Jotai atoms for reactive UI updates
- REST API endpoints for all data mutations and queries
- Vercel Sandbox integration for multi-agent code execution
- PostgreSQL database with Drizzle ORM for schema and migrations
- Polling pattern for real-time task progress updates

## Layers

**Presentation Layer:**
- Purpose: React components and pages for user interaction
- Location: `app/` (pages), `components/` (UI components, layouts, dialogs)
- Contains: Page components (Server), Client components (marked with 'use client'), UI primitives, form components
- Depends on: Session atoms (Jotai), API routes, Lucide icons
- Used by: Browser clients accessing Next.js routes

**Client State Layer:**
- Purpose: Shared state management using Jotai atoms
- Location: `lib/atoms/`
- Contains: `sessionAtom`, `githubConnectionAtom`, `taskPromptAtom` - lightweight global state
- Depends on: Jotai library
- Used by: Client components for session, authentication, and form state

**API Layer:**
- Purpose: RESTful endpoints for data operations and integrations
- Location: `app/api/`
- Contains: Route handlers for tasks, repos, auth, connectors, user keys
- Depends on: Database layer, session management, external integrations (GitHub, Vercel Sandbox)
- Used by: Frontend components via fetch calls

**Business Logic Layer:**
- Purpose: Core functionality for sandbox orchestration, agents, and utilities
- Location: `lib/`
  - `sandbox/`: Sandbox creation, agent execution, package management, git operations
  - `auth/`: OAuth providers configuration
  - `session/`: Server-side session management and cookies
  - `utils/`: Task logging, rate limiting, ID generation, logging utilities
- Contains: Sandbox management, agent routing, rate limiters, task loggers
- Depends on: Database, external services (Vercel Sandbox, GitHub)
- Used by: API routes and server-side page rendering

**Data Layer:**
- Purpose: Database schema, queries, and user/settings management
- Location: `lib/db/`
- Contains: Schema definitions (Drizzle), client proxy, user helpers, settings management
- Depends on: PostgreSQL (via postgres driver), Drizzle ORM
- Used by: API routes and business logic

**Cryptography/Security Layer:**
- Purpose: JWE encryption for secure token handling
- Location: `lib/jwe/`, `lib/crypto.ts`
- Contains: Token encryption/decryption, OIDC handling
- Depends on: jose library
- Used by: Session management and authentication flows

## Data Flow

**Task Creation Flow:**

1. User fills task form on `/repos/[owner]/[repo]` (client)
2. Form submission → POST `/api/tasks` with prompt, repo, agent config
3. API validates rate limits, user authorization, creates task record
4. Task stored with `status: 'pending'` in database
5. Client component polls `/api/tasks/[taskId]` every 3 seconds
6. When status changes to `processing`, frontend updates UI with progress

**Agent Execution Flow:**

1. Backend receives task execution request (triggering mechanism unclear - appears async)
2. Creates Vercel Sandbox via `createSandbox()` → `lib/sandbox/creation.ts`
3. Registers sandbox in memory map → `lib/sandbox/sandbox-registry.ts`
4. Determines agent type (claude, codex, copilot, cursor, gemini, opencode)
5. Routes to appropriate agent executor → `lib/sandbox/agents/[agent].ts`
6. Agent executes inside sandbox, returns `AgentExecutionResult`
7. Task status updated to `completed` or `error`, logs stored in database
8. Client polls and displays real-time progress via stored logs

**Message Retrieval Flow:**

1. Client fetches `/api/tasks/[taskId]/messages`
2. API verifies task ownership
3. Returns conversation history (user prompts and agent responses)
4. Stored in `taskMessages` table with `role: 'user' | 'agent'`

**Session/Authentication Flow:**

1. User navigates to app
2. `SessionProvider` component calls `/api/auth/info` on mount
3. Reads session cookie → validates JWE token → returns user info
4. Session stored in Jotai `sessionAtom`
5. Protected pages check session and redirect if unauthenticated
6. GitHub connection status fetched separately → `githubConnectionAtom`

**State Management:**

- **Atoms (Jotai):** Lightweight client-side state (session, GitHub connection)
- **Database:** Source of truth for tasks, users, connectors, messages
- **In-Memory:** Active sandboxes tracked in Map during execution only
- **Polling:** Frontend polls task status every 3 seconds until completion

## Key Abstractions

**Sandbox Abstraction:**
- Purpose: Encapsulates Vercel Sandbox creation, command execution, and cleanup
- Examples: `lib/sandbox/creation.ts`, `lib/sandbox/commands.ts`, `lib/sandbox/sandbox-registry.ts`
- Pattern: Factory pattern for sandbox creation, registry pattern for tracking active instances

**Agent Abstraction:**
- Purpose: Unified interface for different AI agents (Claude, OpenAI, Gemini, etc.)
- Examples: `lib/sandbox/agents/claude.ts`, `lib/sandbox/agents/opencode.ts`
- Pattern: Strategy pattern - `executeAgentInSandbox()` dispatches to agent-specific executors based on type

**TaskLogger Abstraction:**
- Purpose: Unified logging interface for task execution with multiple log types
- Examples: `lib/utils/task-logger.ts`
- Pattern: Facade pattern - provides `info()`, `command()`, `error()`, `success()` methods that store logs in DB

**Rate Limiter Abstraction:**
- Purpose: Per-user message quotas with daily reset
- Examples: `lib/utils/rate-limit.ts`
- Pattern: Token bucket / sliding window - tracks daily message count by user ID

**Database Schema Abstraction:**
- Purpose: Type-safe database access via Zod validation
- Examples: `lib/db/schema.ts` with insert/select schemas for each table
- Pattern: Schema validation pattern - parse input with Zod, insert/select with Drizzle

## Entry Points

**Web Server:**
- Location: `app/layout.tsx`, `app/page.tsx`
- Triggers: HTTP requests to Next.js server
- Responsibilities: Root layout with providers, theme setup, analytics, home page redirect

**API Routes:**
- Location: `app/api/**/*.ts`
- Triggers: Fetch calls from client components
- Responsibilities: Handle HTTP methods (GET/POST/PATCH/DELETE), validate requests, call DB/external services

**Session Provider Component:**
- Location: `components/auth/session-provider.tsx`
- Triggers: Client-side on mount (runs in root layout)
- Responsibilities: Fetch and initialize session state, set up polling for auth status refresh

**Sandbox Execution (async):**
- Purpose: Actual agent execution inside sandbox
- Triggered by: (Mechanism not visible in code - likely via background job or webhook)
- Responsibilities: Clone repo, install dependencies, run agent, update task status

## Error Handling

**Strategy:** Try-catch-log with status code responses and user-facing error messages

**Patterns:**
- API routes catch errors and return `NextResponse.json({ error: string }, { status: number })`
- Task execution failures update task with `status: 'error'` and store error message
- Frontend catches fetch errors and displays toast notifications via sonner
- Sandbox failures are logged to task logs and surface to user in task details

**Error Recovery:**
- Rate limit errors return 429 with reset time - client should retry after
- Unauthorized access returns 401 - redirects to login
- Task stop attempts handle sandbox kill failures gracefully, still mark task as stopped
- Sandbox registry has fallback if task ID not found - kills oldest sandbox

## Cross-Cutting Concerns

**Logging:**
- Backend: Console.error() for system errors, TaskLogger for task-specific execution logs
- Frontend: Sonner toast notifications for user feedback
- Approach: TaskLogger stores structured logs as JSON array in task.logs database field

**Validation:**
- Zod schemas for all database models and API inputs
- Approach: Parse request body with schema before processing, return 400 for invalid data

**Authentication:**
- OAuth via GitHub/Vercel providers handled in auth routes
- JWE tokens stored in HTTP-only cookies
- Approach: getServerSession() helper wraps cookie reading and token validation
- Protected pages check session and redirect to home if missing

**Rate Limiting:**
- Per-user daily message limit enforced at POST /api/tasks
- Approach: Query task creation count for user in last 24 hours, return 429 if exceeded

**Cancellation:**
- Tasks can be stopped via PATCH `/api/tasks/[taskId]` with action: 'stop'
- Approach: Update task status to 'stopped', kill sandbox if running, log cancellation
- Agent execution checks `onCancellationCheck()` callback before and after critical operations

---

*Architecture analysis: 2026-02-01*
