# Ship

Personal background coding agent. Select a repo, spin up a sandboxed VM, and let AI agents work autonomously.

## Stack

- **Monorepo**: Turborepo 2.x with pnpm workspaces
- **Frontend**: Next.js 16 (App Router) + Tailwind v4
- **Backend**: Cloudflare Workers (Hono framework)
- **Database**: Cloudflare D1 (SQLite)
- **Auth**: GitHub OAuth (Arctic) + JWT sessions (jose)
- **Sandboxes**: Vercel Sandbox (OpenCode SDK)
- **Agents**: Claude, Codex, Copilot, Cursor, Gemini, OpenCode

## Project Structure

```
ship/
├── apps/
│   ├── web/              # Next.js 16 App Router
│   │   ├── app/          # Routes and layouts
│   │   │   ├── api/      # API routes (proxy to Cloudflare Worker)
│   │   │   ├── auth/     # Auth pages
│   │   │   └── page.tsx  # Home page
│   │   ├── components/   # React components
│   │   ├── lib/          # Utilities and business logic
│   │   │   ├── dal/      # Data Access Layer (session verification)
│   │   │   └── utils/    # Helpers
│   │   └── .env.example  # Environment template
│   └── api/              # Cloudflare Worker
│       ├── src/
│       │   ├── index.ts  # Hono app entry point
│       │   └── env.d.ts  # Environment types
│       ├── wrangler.toml # Worker configuration
│       └── .dev.vars.example # Local secrets template
├── packages/
│   └── ui/               # Shared UI components
└── .planning/            # GSD planning artifacts

## Quick Start

### Prerequisites

- **Node.js** 20+ and **pnpm** 9+
- **Cloudflare Account** (free tier is fine)
- **GitHub Account** (for OAuth)

### 1. Install Dependencies

```bash
pnpm install
```

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
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 3. Configure API Secrets (Cloudflare Worker)

For local development:

```bash
cd apps/api
cp .dev.vars.example .dev.vars
```

Edit `apps/api/.dev.vars`:

```env
# Anthropic API Key (for agent operations in Phase 3)
# Get from: https://console.anthropic.com/settings/keys
ANTHROPIC_API_KEY=sk-ant-...

# Internal API Secret - generate with: openssl rand -hex 32
API_SECRET=your-api-secret-here
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
pnpm build       # Build all apps
pnpm lint        # Lint all packages
pnpm type-check  # TypeScript checks
```

### API-specific commands (from apps/api):

```bash
npx wrangler dev                    # Start Worker dev server
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

## Architecture Notes

- **Authentication Flow**: GitHub OAuth → API creates session → API returns JWT → Web stores in httpOnly cookie
- **Data Access Layer**: Server Components verify sessions via DAL before accessing data
- **Middleware**: `proxy.ts` optimistically redirects unauthenticated users (not a security boundary)
- **API Communication**: Web app proxies requests to Cloudflare Worker API
- **Database**: D1 (SQLite) with Auth.js-compatible schema (users, accounts, sessions)
- **Timestamps**: All dates stored as Unix timestamps (seconds) for D1 compatibility
