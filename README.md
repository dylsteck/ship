# Ship

Personal background coding agent. Select a repo, spin up a sandboxed VM, and let OpenCode work autonomously.

## Stack

- **Frontend**: Next.js + React + Tailwind CSS + shadcn/ui
- **Backend**: Hono API
- **Database**: Convex (real-time)
- **Auth**: Convex Auth + GitHub OAuth
- **Sandboxes**: Vercel Sandbox
- **Agent**: OpenCode

## Structure

```
ship/
├── apps/
│   ├── web/          # Next.js frontend (port 3001)
│   └── api/          # Hono API (port 3000)
├── packages/
│   ├── convex/       # Convex schema + auth
│   ├── ui/           # Shared components
│   └── ...           # Config packages
```

## Setup

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Convex Setup

```bash
cd packages/convex
npx convex dev
# Creates your project and generates .env.local
```

### 3. GitHub OAuth App (User Login)

1. Go to [github.com/settings/developers](https://github.com/settings/developers)
2. Click **New OAuth App**
3. Fill in:
   - **Application name**: `Ship`
   - **Homepage URL**: `https://ship.yourdomain.com`
   - **Authorization callback URL**: `https://your-project.convex.site/api/auth/callback/github`
4. Copy **Client ID** and **Client Secret**
5. Add to Convex dashboard environment variables:
   - `AUTH_GITHUB_ID` = Client ID
   - `AUTH_GITHUB_SECRET` = Client Secret

### 4. GitHub App (Bot Commits)

This allows commits to appear as "Ship[bot]" instead of the user.

1. Go to [github.com/settings/apps/new](https://github.com/settings/apps/new)
2. Fill in:
   | Field | Value |
   |-------|-------|
   | **GitHub App name** | `Ship` (or `Ship-dev` for testing) |
   | **Homepage URL** | `https://ship.yourdomain.com` |
   | **Webhook** | Uncheck "Active" |

3. Set **Repository Permissions**:
   | Permission | Access |
   |------------|--------|
   | **Contents** | Read and write |
   | **Metadata** | Read-only (auto-selected) |

4. **Where can this app be installed?**: Only on this account
5. Click **Create GitHub App**
6. Note the **App ID** (number at top of settings page)
7. Click **Generate a private key** → downloads a `.pem` file
8. Convert the private key for env var:
   ```bash
   cat ~/Downloads/your-app.private-key.pem | awk 'NF {sub(/\r/, ""); printf "%s\\n", $0}' | pbcopy
   ```
9. Click **Install App** in the left sidebar
10. Install on your account (select repos or all)
11. Note the **Installation ID** from the URL: `github.com/settings/installations/XXXXX`

### 5. Environment Variables

#### Web App (`apps/web/.env.local`)

```env
NEXT_PUBLIC_CONVEX_URL=https://your-project.convex.cloud
NEXT_PUBLIC_API_URL=http://localhost:3000  # For local dev
```

#### API (`apps/api/.env.local`)

```env
# Convex
CONVEX_URL=https://your-project.convex.cloud

# API Key (shared secret with Convex - must match Convex API_KEY)
# Generate with: openssl rand -hex 32
API_KEY=your-api-key-secret

# Anthropic (for Claude)
ANTHROPIC_API_KEY=sk-ant-...

# GitHub App (for bot commits)
GITHUB_APP_ID=your-app-id
GITHUB_APP_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----\n"
GITHUB_APP_INSTALLATION_ID=your-installation-id
```

#### Convex (`packages/convex/.env.local`)

```env
AUTH_GITHUB_ID=your-oauth-client-id
AUTH_GITHUB_SECRET=your-oauth-client-secret

# API Key (shared secret with API server - must match API API_KEY)
API_KEY=your-api-key-secret
```

### 6. Vercel Sandbox Setup

Vercel Sandbox is used to run sandboxed environments with OpenCode.

**For Local Development:**
```bash
cd apps/api
vercel env pull  # Pulls VERCEL_OIDC_TOKEN to .env.local
```

**For Production:**
When deployed to Vercel, the OIDC token is automatically available.

### 7. Run Development

```bash
# From root directory
pnpm dev

# Or run separately:
# Terminal 1: Convex
cd packages/convex && npx convex dev

# Terminal 2: API
cd apps/api && pnpm dev

# Terminal 3: Web
cd apps/web && pnpm dev
```

Open http://localhost:3001

## Build

```bash
pnpm build                    # Build all
pnpm build --filter=web       # Build web only
pnpm build --filter=api       # Build API only
```

## Deployment

### Web App (Vercel)

1. Create new Vercel project, select this repo
2. Set **Root Directory** to `apps/web`
3. Add environment variables:
   - `NEXT_PUBLIC_CONVEX_URL`
   - `NEXT_PUBLIC_API_URL` = `https://api.ship.yourdomain.com`

### API (Vercel)

1. Create new Vercel project, select this repo
2. Set **Root Directory** to `apps/api`
3. Add environment variables:
   - `CONVEX_URL`
   - `ANTHROPIC_API_KEY`
   - `API_KEY`
   - `GITHUB_APP_ID`
   - `GITHUB_APP_PRIVATE_KEY`
   - `GITHUB_APP_INSTALLATION_ID`

Note: Vercel Sandbox uses OIDC tokens which are automatically available when deployed to Vercel.

### Convex

```bash
cd packages/convex && npx convex deploy
```

Or configure automatic deploys via Vercel integration.

## Production URLs

- **Web app**: https://ship.dylansteck.com
- **API**: https://api.ship.dylansteck.com
