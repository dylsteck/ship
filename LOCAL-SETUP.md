# Local Development Setup Guide

Complete walkthrough for running Ship locally.

## Prerequisites

- **Node.js** 20+ and **pnpm** 9+
- **Cloudflare Account** (free tier) - for D1 database
- **GitHub Account** - for OAuth
- **Anthropic API Key** (optional, for agent operations)
- **E2B API Key** (optional, for sandbox provisioning)
- **Linear OAuth App** (optional, for Linear integration)

## Step-by-Step Setup

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Set Up Web App Environment Variables

```bash
cd apps/web
cp .env.example .env.local
```

Edit `apps/web/.env.local`:

```env
# GitHub OAuth (required)
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret

# Session Secret (required)
# Generate with: openssl rand -hex 32
SESSION_SECRET=your-32-char-secret-key-here-minimum

# API Configuration (defaults work for local dev)
API_BASE_URL=http://localhost:8787
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Linear OAuth (optional - for Linear integration)
LINEAR_CLIENT_ID=your-linear-client-id
LINEAR_CLIENT_SECRET=your-linear-client-secret
```

### 3. Set Up API (Cloudflare Worker) Environment Variables

```bash
cd apps/api
cp .dev.vars.example .dev.vars
```

Edit `apps/api/.dev.vars`:

```env
# Anthropic API Key (optional - for agent operations)
# Get from: https://console.anthropic.com/settings/keys
ANTHROPIC_API_KEY=sk-ant-...

# E2B API Key (optional - for sandbox provisioning)
# Get from: https://e2b.dev/dashboard -> Settings -> API Keys
E2B_API_KEY=e2b_...

# Internal API Secret (required)
# Generate with: openssl rand -hex 32
API_SECRET=your-api-secret-here
```

### 4. Create D1 Database

```bash
cd apps/api
npx wrangler d1 create ship-db
```

**Important:** Copy the `database_id` from the output (looks like `a1b2c3d4e5f6...`)

Update `apps/api/wrangler.toml`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "ship-db"
database_id = "your-actual-database-id-here"  # Replace "local" with the ID from above
```

### 5. Run Database Migrations

```bash
cd apps/api
npx wrangler d1 execute ship-db --local --file=src/db/schema.sql
```

Or if you have individual migration files:

```bash
npx wrangler d1 execute ship-db --local --file=migrations/0001_create_auth_tables.sql
```

### 6. Set Up GitHub OAuth App

1. Go to [github.com/settings/developers](https://github.com/settings/developers)
2. Click **"New OAuth App"**
3. Fill in:
   - **Application name**: `Ship` (or your preferred name)
   - **Homepage URL**: `http://localhost:3000`
   - **Authorization callback URL**: `http://localhost:3000/api/auth/github/callback`
4. Click **"Register application"**
5. Copy the **Client ID** → paste into `apps/web/.env.local` as `GITHUB_CLIENT_ID`
6. Click **"Generate a new client secret"**
7. Copy the **Client Secret** → paste into `apps/web/.env.local` as `GITHUB_CLIENT_SECRET`

### 7. (Optional) Set Up Linear OAuth App

1. Go to [linear.app/settings/api](https://linear.app/settings/api)
2. Click **"Create API key"** or **"Create OAuth app"**
3. Fill in:
   - **Name**: `Ship`
   - **Redirect URL**: `http://localhost:3000/api/auth/linear/callback`
4. Copy the **Client ID** → paste into `apps/web/.env.local` as `LINEAR_CLIENT_ID`
5. Copy the **Client Secret** → paste into `apps/web/.env.local` as `LINEAR_CLIENT_SECRET`

### 8. Generate Secrets

Generate the required secrets:

```bash
# Session Secret (for web app)
openssl rand -hex 32
# Copy output to apps/web/.env.local as SESSION_SECRET

# API Secret (for API worker)
openssl rand -hex 32
# Copy output to apps/api/.dev.vars as API_SECRET
```

### 9. Start Development Servers

From the **root directory**:

```bash
pnpm dev
```

This starts:
- **Web app**: http://localhost:3000
- **API Worker**: http://localhost:8787

The `pnpm dev` command uses Turborepo to run both apps concurrently.

## Verifying Setup

### Check Web App
1. Open http://localhost:3000
2. Click "Sign in with GitHub"
3. You should be redirected to GitHub for authorization
4. After authorizing, you should be redirected back and logged in

### Check API Worker
1. Open http://localhost:8787/health
2. Should return: `{ "status": "ok" }`

### Check Database
```bash
cd apps/api
npx wrangler d1 execute ship-db --local --command="SELECT COUNT(*) FROM users"
```

## OpenCode Setup (for Agent Operations)

OpenCode is configured automatically when you run `pnpm dev`. The OpenCode server auto-starts in development mode.

### MCP Server Configuration

The Vercel MCP server is configured in `opencode.json` at the project root. It points to:
- `http://localhost:8787/mcp/vercel`

**Note:** For MCP to work fully, you may need to configure userId extraction (see `MCP-SETUP.md`).

## Troubleshooting

### Port Already in Use

If port 3000 or 8787 is already in use:

**Web app (port 3000):**
```bash
cd apps/web
PORT=3001 pnpm dev
```

**API Worker (port 8787):**
Update `apps/api/wrangler.toml`:
```toml
[dev]
port = 8788
```

### Database Connection Issues

If you see database errors:
1. Verify `database_id` in `wrangler.toml` matches the one from `wrangler d1 create`
2. Run migrations again: `npx wrangler d1 execute ship-db --local --file=src/db/schema.sql`
3. Check database exists: `npx wrangler d1 list`

### GitHub OAuth Not Working

1. Verify callback URL matches exactly: `http://localhost:3000/api/auth/github/callback`
2. Check `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` in `.env.local`
3. Clear browser cookies and try again

### OpenCode Not Starting

1. Check Node.js version: `node --version` (should be 20+)
2. Verify OpenCode SDK is installed: `cd apps/api && pnpm list @opencode-ai/sdk`
3. Check for port conflicts (OpenCode uses port 4096 by default)

### Debugging Production Issues

If you need to debug production issues:

```bash
# View real-time production logs
npx wrangler tail ship-api-production

# Look for specific log prefixes:
# - [chat:...] - Chat request handling
# - [opencode:...] - OpenCode event processing
# - [opencode:prompt] - Prompt sending to OpenCode
```

This is especially useful when debugging agent execution, sandbox provisioning, or event streaming issues.

## Environment Variables Reference

### Web App (`apps/web/.env.local`)

| Variable | Required | Description |
|----------|----------|-------------|
| `GITHUB_CLIENT_ID` | ✅ Yes | GitHub OAuth Client ID |
| `GITHUB_CLIENT_SECRET` | ✅ Yes | GitHub OAuth Client Secret |
| `SESSION_SECRET` | ✅ Yes | 32+ char secret for session encryption |
| `API_BASE_URL` | No | API URL (default: `http://localhost:8787`) |
| `NEXT_PUBLIC_APP_URL` | No | App URL (default: `http://localhost:3000`) |
| `LINEAR_CLIENT_ID` | No | Linear OAuth Client ID |
| `LINEAR_CLIENT_SECRET` | No | Linear OAuth Client Secret |

### API Worker (`apps/api/.dev.vars`)

| Variable | Required | Description |
|----------|----------|-------------|
| `ANTHROPIC_API_KEY` | No | Anthropic API key for agent operations |
| `E2B_API_KEY` | No | E2B API key for sandbox provisioning |
| `API_SECRET` | ✅ Yes | Internal API authentication secret |

## Development Commands

### Root Directory

```bash
pnpm dev         # Start all development servers
pnpm build       # Build all apps
pnpm lint        # Lint all packages
pnpm type-check  # TypeScript type checking
```

### API-Specific Commands

```bash
cd apps/api

# Start Worker dev server
npx wrangler dev

# View production logs (for debugging production issues)
npx wrangler tail ship-api-production

# Database operations
npx wrangler d1 list                                    # List databases
npx wrangler d1 execute ship-db --local --command="..." # Run SQL query
npx wrangler d1 execute ship-db --local --file=...      # Run migration

# View database in browser
npx wrangler d1 execute ship-db --local --command="SELECT * FROM users"
```

### Web-Specific Commands

```bash
cd apps/web

pnpm dev         # Start Next.js dev server
pnpm build       # Build for production
pnpm start       # Start production server
```

## Next Steps

1. ✅ Set up environment variables
2. ✅ Create D1 database
3. ✅ Run migrations
4. ✅ Configure GitHub OAuth
5. ✅ Start development servers
6. 🎉 Start building!

For more details, see:
- `README.md` - Project overview
- `AGENTS.md` - Agent configuration
- `.planning/phases/05-external-integrations/MCP-SETUP.md` - MCP server details
