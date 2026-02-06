# Ship

A background agent platform for building software. Sign in with GitHub, chat with an AI agent (powered by OpenCode SDK) that works on code in sandboxed environments. Tasks come from Linear issues or chat conversations. Sessions contain conversations with one or many tasks — the agent writes code, runs tests, and deploys while you focus on other things.

**Core Value**: The agent works autonomously in the background on real coding tasks while you do other things — you come back to working code, not just suggestions.

## Tech Stack

- **Monorepo**: Turborepo 2.x with pnpm workspaces
- **Frontend**: Next.js 16 (App Router), React 19, Tailwind CSS v4, Base UI, AI Elements components
- **Backend**: Cloudflare Workers (Hono framework), Durable Objects for session state
- **Database**: Cloudflare D1 (SQLite) for user/auth data
- **Auth**: GitHub OAuth (Arctic) + JWT sessions (jose)
- **Sandboxes**: Vercel Sandbox (OpenCode SDK) for isolated code execution
- **Agents**: OpenCode SDK with support for Claude, GPT-4, and other LLMs
- **MCP Servers**: Vercel (deployment), Grep (GitHub code search), Context7 (documentation search)
- **Real-time**: Server-Sent Events (SSE) for live agent updates and WebSockets for chat

## Project Structure

```
ship/
├── apps/
│   ├── web/                  # Next.js 16 App Router
│   │   ├── app/              # Routes and layouts
│   │   │   ├── (app)/        # Authenticated app routes
│   │   │   │   └── dashboard/# Dashboard with chat UI
│   │   │   │       ├── hooks/     # useDashboardChat, useDashboardSSE
│   │   │   │       └── components/# DashboardHeader, Messages, Composer
│   │   │   ├── api/          # API routes (auth, proxy)
│   │   │   └── page.tsx      # Home → redirects to dashboard
│   │   ├── components/       # React components
│   │   │   ├── chat/         # session-panel.tsx (Context sidebar)
│   │   │   ├── session/      # Session management UI
│   │   │   └── app-sidebar.tsx
│   │   └── lib/              # Utilities and business logic
│   │       ├── ai-elements-adapter.ts  # SSE → UIMessage transforms
│   │       ├── sse-types.ts            # SSE event type definitions
│   │       ├── sse-parser.ts           # SSE stream parser
│   │       ├── api/                    # API client + SWR hooks
│   │       └── dal/                    # Data Access Layer
│   └── api/                  # Cloudflare Worker
│       ├── src/
│       │   ├── index.ts      # Hono app entry point
│       │   └── env.d.ts      # Environment types
│       ├── wrangler.toml     # Worker configuration
│       └── .dev.vars.example # Local secrets template
├── packages/
│   └── ui/                   # Shared UI components (@ship/ui)
│       └── src/
│           ├── ai-elements/  # Chat UI primitives
│           │   ├── code-block.tsx  # Shiki syntax highlighting
│           │   ├── steps.tsx       # Collapsible steps (OpenCode-style)
│           │   ├── tool.tsx        # Tool invocation cards with icons
│           │   ├── reasoning.tsx   # Reasoning display
│           │   └── markdown.tsx    # Markdown renderer
│           └── index.ts
└── .planning/                # GSD planning artifacts
```

## Key Architecture Patterns

### Message Flow

1. **SSE Streaming**: Agent events stream via SSE from the OpenCode API
2. **Adapter Layer** (`ai-elements-adapter.ts`): Transforms SSE events into `UIMessage` objects — the single source of truth for all message state
3. **UIMessage**: Contains text content, tool invocations, reasoning blocks, elapsed time, and prompt data all on one object
4. **Reload Persistence**: The `parts` JSON string from the API is parsed on reload to restore reasoning, tools, and timing data

### Chat Hooks

- `use-dashboard-chat.ts` — State management, WebSocket connection, history loading
- `use-dashboard-sse.ts` — SSE streaming handler, transforms events via adapter

### UI Components (`@ship/ui`)

- **Steps**: Collapsible "Show steps / Hide steps" with step count and elapsed time
- **Tool**: Tool invocation cards with per-tool icons (Read → glasses, Bash → terminal, etc.)
- **CodeBlock**: Syntax-highlighted code blocks using Shiki with `github-dark` theme
- **Session Panel**: OpenCode-style Context sidebar with stats grid, token breakdown bar, and raw messages viewer

## Quick Start

### Prerequisites

- **Node.js** 20+ and **pnpm** 9+
- **Cloudflare Account** (free tier is fine)
- **GitHub Account** (for OAuth)

### 1. Install Dependencies

From the root directory:

```bash
pnpm install
```

This installs dependencies for both the web app (`apps/web`) and API worker (`apps/api`).

### 2. Configure Web App Environment

Copy the environment template and fill in your values:

```bash
cd apps/web
cp .env.example .env.local
```

Edit `apps/web/.env.local`:

```env
# GitHub OAuth - see setup instructions below
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret

# Session Secret - generate with: openssl rand -hex 32
SESSION_SECRET=your-32-char-secret-key-here-min

# API Configuration (defaults work for local development)
API_BASE_URL=http://localhost:8787
NEXT_PUBLIC_API_URL=http://localhost:8787
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Optional: Context7 API key for documentation search MCP
CONTEXT7_API_KEY=your-context7-api-key
```

### 3. Configure API Secrets (Cloudflare Worker)

For local development:

```bash
cd apps/api
cp .dev.vars.example .dev.vars
```

Edit `apps/api/.dev.vars`:

```env
# Anthropic API Key (for OpenCode agent operations)
# Get from: https://console.anthropic.com/settings/keys
ANTHROPIC_API_KEY=sk-ant-...

# OpenAI API Key (optional, for GPT-4 models)
# Get from: https://platform.openai.com/api-keys
OPENAI_API_KEY=sk-...

# Internal API Secret - generate with: openssl rand -hex 32
API_SECRET=your-api-secret-here

# Vercel Sandbox credentials (for sandbox provisioning)
SANDBOX_VERCEL_TOKEN=your-vercel-token
SANDBOX_VERCEL_TEAM_ID=your-team-id
SANDBOX_VERCEL_PROJECT_ID=your-project-id
```

### 4. Create D1 Database

Create a D1 database for local development:

```bash
cd apps/api
npx wrangler d1 create ship-db
```

Copy the `database_id` from the output and update `apps/api/wrangler.toml`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "ship-db"
database_id = "your-database-id-here"  # Replace "local" with actual ID
```

### 5. Run Database Migrations

Apply the schema to your D1 database:

```bash
cd apps/api
npx wrangler d1 execute ship-db --local --file=migrations/0001_create_auth_tables.sql
```

### 6. Start Development Servers

From the root directory:

```bash
pnpm dev
```

This starts:
- **Web app**: http://localhost:3000
- **API Worker**: http://localhost:8787

### GitHub OAuth Setup

1. Go to [github.com/settings/developers](https://github.com/settings/developers)
2. Click **New OAuth App**
3. Fill in:
   - **Application name**: `Ship` (or your preferred name)
   - **Homepage URL**: `http://localhost:3000`
   - **Authorization callback URL**: `http://localhost:3000/api/auth/github/callback`
4. Click **Register application**
5. Copy the **Client ID** to `GITHUB_CLIENT_ID` in `.env.local`
6. Click **Generate a new client secret**
7. Copy the **Client Secret** to `GITHUB_CLIENT_SECRET` in `.env.local`

## Development Commands

From the root directory:

```bash
pnpm dev         # Start all development servers
pnpm build       # Build all apps (uses turbo)
pnpm lint        # Lint all packages
pnpm type-check  # TypeScript checks
```

### API-specific commands (from apps/api):

```bash
npx wrangler dev                    # Start Worker dev server
npx wrangler tail ship-api-production  # View production logs (for debugging)
npx wrangler d1 create <db-name>    # Create D1 database
npx wrangler d1 execute <db-name> --local --file=<sql-file>  # Run migrations
npx wrangler d1 execute <db-name> --local --command="SELECT * FROM users"  # Query database
npx wrangler secret put <secret-name>  # Set production secret
```

### Web-specific commands (from apps/web):

```bash
pnpm dev         # Start Next.js dev server
pnpm build       # Build for production
pnpm start       # Start production server
```

## Deployment

### Cloudflare Worker (API)

1. Create production D1 database:
   ```bash
   cd apps/api
   npx wrangler d1 create ship-db
   ```

2. Update `wrangler.toml` with production `database_id`

3. Run migrations:
   ```bash
   npx wrangler d1 execute ship-db --file=migrations/0001_create_auth_tables.sql
   ```

4. Set secrets:
   ```bash
   npx wrangler secret put ANTHROPIC_API_KEY
   npx wrangler secret put API_SECRET
   ```

5. Deploy:
   ```bash
   npx wrangler deploy
   ```

### Next.js Web App

Deploy to Vercel:

1. Connect your repo to Vercel
2. Set root directory to `apps/web`
3. Add environment variables (see `.env.example`)
4. Deploy

Or deploy to Cloudflare Pages:

```bash
cd apps/web
pnpm build
npx wrangler pages deploy .next
```

## How It Works

1. **Authentication**: Sign in with GitHub OAuth to create a persistent session
2. **Session Creation**: Create a new session linked to a GitHub repository
3. **Agent Interaction**: Chat with the AI agent or connect a Linear issue
4. **Autonomous Execution**: The agent works in a sandboxed environment, writing code, running tests, and making commits
5. **Real-time Updates**: Watch progress via SSE events showing tool calls, reasoning, file changes, and more
6. **Review & Deploy**: Review changes, approve permissions, and deploy via integrated MCP servers

## Architecture Notes

- **Authentication Flow**: GitHub OAuth → API creates session → API returns JWT → Web stores in httpOnly cookie
- **Session State**: Durable Objects manage session state and real-time communication
- **Agent Execution**: OpenCode SDK orchestrates agents in Vercel Sandbox environments
- **Real-time Updates**: Server-Sent Events (SSE) stream agent activity (tool calls, reasoning, file changes)
- **MCP Integration**: Model Context Protocol servers provide external tools (Vercel deployment, GitHub search, documentation)
- **Data Access Layer**: Server Components verify sessions via DAL before accessing data
- **Middleware**: `proxy.ts` optimistically redirects unauthenticated users (not a security boundary)
- **API Communication**: Web app proxies requests to Cloudflare Worker API
- **Database**: D1 (SQLite) with Auth.js-compatible schema (users, accounts, sessions)
- **Timestamps**: All dates stored as Unix timestamps (seconds) for D1 compatibility
