# Codebase Structure

**Analysis Date:** 2026-02-01

## Directory Layout

```
ship/
├── app/                        # Next.js app router - pages and API routes
│   ├── api/                    # API route handlers
│   │   ├── auth/               # OAuth and session endpoints
│   │   ├── tasks/              # Task CRUD endpoints
│   │   ├── repos/              # GitHub repository data endpoints
│   │   ├── connectors/         # MCP connector endpoints
│   │   └── user/               # User settings/keys endpoints
│   ├── tasks/                  # Task pages (list, detail)
│   ├── repos/                  # Repository browsing pages
│   ├── page.tsx                # Home page
│   ├── layout.tsx              # Root layout with providers
│   └── globals.css             # Global Tailwind styles
├── components/                 # React UI components
│   ├── ui/                     # Radix UI primitives (button, dialog, etc.)
│   ├── auth/                   # Session provider, user menu, sign-in/out
│   ├── layout/                 # App layout, header, sidebar
│   ├── dialogs/                # Modal dialogs
│   ├── file-browser/           # File tree viewer
│   ├── logos/                  # Agent logo components
│   ├── terminal/               # Terminal UI components
│   ├── task-form.tsx           # Task creation form
│   ├── task-details.tsx        # Task execution UI with tabs
│   ├── task-page-client.tsx    # Task detail page wrapper
│   ├── repo-page-client.tsx    # Repository browsing UI
│   ├── tasks-list-client.tsx   # Tasks list view
│   ├── home-page-content.tsx   # Home page content
│   └── providers/              # Context/Jotai providers
├── lib/                        # Business logic and utilities
│   ├── db/                     # Database layer
│   │   ├── schema.ts           # Drizzle schema definitions with Zod validation
│   │   ├── client.ts           # Lazy-initialized Drizzle client
│   │   ├── users.ts            # User query helpers
│   │   ├── settings.ts         # Settings management
│   │   ├── migrations/         # Drizzle migrations (auto-generated)
│   │   └── index.ts            # Public exports
│   ├── sandbox/                # Vercel Sandbox orchestration
│   │   ├── creation.ts         # Sandbox creation workflow
│   │   ├── agents/             # Agent execution strategies
│   │   │   ├── claude.ts       # Claude agent executor
│   │   │   ├── opencode.ts     # OpenCode agent executor
│   │   │   ├── copilot.ts      # Copilot agent executor
│   │   │   ├── cursor.ts       # Cursor agent executor
│   │   │   ├── codex.ts        # Codex agent executor
│   │   │   ├── gemini.ts       # Gemini agent executor
│   │   │   └── index.ts        # Agent dispatcher
│   │   ├── commands.ts         # Sandbox command execution
│   │   ├── git.ts              # Git operations in sandbox
│   │   ├── package-manager.ts  # Dependency installation
│   │   ├── config.ts           # Sandbox configuration validation
│   │   ├── types.ts            # TypeScript types for sandbox
│   │   ├── port-detection.ts   # Port detection utilities
│   │   ├── sandbox-registry.ts # In-memory sandbox tracking
│   │   └── index.ts            # Public exports
│   ├── session/                # Server-side session management
│   │   ├── get-server-session.ts # Cached session resolver
│   │   ├── server.ts           # Session cookie parsing
│   │   ├── get-oauth-token.ts  # OAuth token helpers
│   │   ├── types.ts            # Session TypeScript types
│   │   ├── constants.ts        # Cookie name, expiry constants
│   │   └── redirect-to-sign-out.ts # Sign-out redirect helper
│   ├── auth/                   # Authentication configuration
│   │   └── providers.ts        # OAuth provider setup (GitHub, Vercel)
│   ├── atoms/                  # Jotai global state
│   │   ├── session.ts          # User session atom
│   │   ├── github-connection.ts # GitHub auth status atom
│   │   └── task.ts             # Task form prompt atom
│   ├── jwe/                    # JWE token encryption
│   │   ├── encrypt.ts          # Token encryption logic
│   │   └── decrypt.ts          # Token decryption logic
│   ├── utils/                  # Utility functions
│   │   ├── task-logger.ts      # Task execution logging
│   │   ├── rate-limit.ts       # Daily message rate limiting
│   │   ├── logging.ts          # Log redaction utilities
│   │   ├── id.ts               # Nano ID generation
│   │   └── is-relative-url.ts  # URL validation
│   ├── crypto.ts               # Cryptographic operations
│   ├── constants.ts            # App-wide constants
│   └── utils.ts                # Utility exports (cn, etc.)
├── public/                     # Static assets
│   └── logos/                  # Agent logo images
├── .env.example                # Environment variables template
├── tsconfig.json               # TypeScript configuration
├── drizzle.config.ts           # Drizzle ORM configuration
├── next.config.ts              # Next.js configuration
├── tailwind.config.ts          # Tailwind CSS configuration
└── package.json                # Dependencies and scripts
```

## Directory Purposes

**app/:**
- Purpose: Next.js App Router pages and API routes
- Contains: Server components, API handlers, layout wrappers
- Key files: `layout.tsx` (root setup), `page.tsx` (home), `api/**/*.ts` (endpoints)

**components/:**
- Purpose: React UI components organized by feature/type
- Contains: Radix UI primitives, custom components, layouts, dialogs
- Key files: `ui/*` (primitives), `auth/*` (session UI), `task-*.tsx` (task workflows)

**lib/db/:**
- Purpose: Database abstraction layer with Drizzle ORM
- Contains: Schema definitions, queries, migrations
- Key files: `schema.ts` (all table definitions with Zod), `client.ts` (DB connection)

**lib/sandbox/:**
- Purpose: Vercel Sandbox integration and multi-agent execution
- Contains: Sandbox lifecycle, agent strategies, git/npm operations
- Key files: `creation.ts` (sandbox setup), `agents/*.ts` (agent executors)

**lib/session/:**
- Purpose: Server-side authentication and session handling
- Contains: Session cookie parsing, OAuth token extraction
- Key files: `get-server-session.ts` (main entry), uses jose for JWE tokens

**lib/atoms/:**
- Purpose: Jotai global state atoms for client-side reactivity
- Contains: Lightweight shared state (no persistence)
- Key files: Session and GitHub connection status atoms

## Key File Locations

**Entry Points:**
- `app/page.tsx`: Home page - lists repos or redirects to tasks
- `app/layout.tsx`: Root layout with ThemeProvider, SessionProvider, JotaiProvider
- `app/api/tasks/route.ts`: Task CRUD (GET all, POST create, DELETE by status)
- `app/api/auth/info/route.ts`: Current user session info

**Configuration:**
- `drizzle.config.ts`: Drizzle database URL, schema path
- `tsconfig.json`: Path aliases (`@/` = root), strict mode
- `next.config.ts`: Runtime API secrets injection
- `.env.example`: Required environment variables

**Core Logic:**
- `lib/sandbox/creation.ts`: Sandbox orchestration and repo setup
- `lib/sandbox/agents/index.ts`: Agent dispatcher routing
- `lib/session/get-server-session.ts`: Session cache and validation
- `lib/utils/task-logger.ts`: Structured logging to database

**Testing:**
- No test files present in codebase

## Naming Conventions

**Files:**
- `[bracket].tsx` - Dynamic route segments (Next.js)
- `-client.tsx` - Client-side components (explicit 'use client')
- `*.route.ts` - API route handlers
- `-provider.tsx` - React context/provider components
- `index.ts` - Barrel export files

**Directories:**
- `camelCase` for feature directories (tasks, repos, auth)
- `kebab-case` for UI component subdirectories (ui, file-browser)
- Single purpose per directory (agents, atoms, utils are separate)

**Functions:**
- camelCase with action prefix: `executeAgent`, `createSandbox`, `fetchSession`
- Hooks start with use: `useTasks`, `useRouter`
- Atoms end with Atom: `sessionAtom`, `githubConnectionAtom`

**Types:**
- PascalCase with descriptive suffix: `TaskDetailsProps`, `SandboxConfig`, `AgentExecutionResult`
- Prefix with I for interfaces (inconsistent - some use interfaces, some use types)

## Where to Add New Code

**New Feature (e.g., new agent type):**
- New agent executor: `lib/sandbox/agents/[agent-name].ts`
- Add case to dispatcher: `lib/sandbox/agents/index.ts`
- Update schema: `lib/db/schema.ts` (add to enum if needed)
- API endpoint: `app/api/[feature]/route.ts` (if needed)
- UI components: `components/[feature]/*.tsx`

**New Component/Module:**
- Implementation: `components/[feature]/[component-name].tsx`
- If complex: Create subdirectory `components/[feature]/[component-name]/`
- Exports: Use barrel file `components/[feature]/index.ts` for easy importing

**New API Endpoint:**
- Location: `app/api/[resource]/[action]/route.ts`
- Pattern: Import db, session, validation, implement GET/POST/PATCH/DELETE
- Response: Always return NextResponse.json with error handling
- Auth: Call `getServerSession()` first, return 401 if missing

**New Database Table:**
- Add schema: `lib/db/schema.ts` (pgTable, Zod schemas)
- Create migration: Run `pnpm db:generate`
- Add queries: `lib/db/[table].ts` if complex queries
- Export from: `lib/db/index.ts`

**Utilities:**
- Shared helpers: `lib/utils/[feature].ts`
- Single responsibility per file
- Export from: `lib/utils.ts` barrel

**Styling:**
- Component-scoped: Use Tailwind inline classes in components
- Global: Add to `app/globals.css`
- Theme: Use Tailwind theming via CSS variables in provider

## Special Directories

**lib/db/migrations/:**
- Purpose: Auto-generated Drizzle migration files
- Generated: Yes (via `pnpm db:generate`)
- Committed: Yes (history of schema changes)

**public/:**
- Purpose: Static assets served by Next.js
- Images, logos for agents
- Committed: Yes

**.next/:**
- Purpose: Build output from Next.js
- Generated: Yes
- Committed: No (.gitignore)

**.env.local:**
- Purpose: Local environment variables (secrets, API keys)
- Generated: No (template in .env.example)
- Committed: No (.gitignore) - never commit secrets

**node_modules/:**
- Purpose: npm dependencies installed via pnpm
- Generated: Yes (from pnpm-lock.yaml)
- Committed: No

---

*Structure analysis: 2026-02-01*
