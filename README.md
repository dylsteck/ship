# Ship

Personal background coding agent. Select a repo, spin up a sandboxed VM, and let OpenCode work autonomously.

## Stack

- **Frontend**: Next.js + React + Tailwind CSS
- **Backend**: Hono API
- **Database**: Convex (real-time)
- **Auth**: Convex Auth + GitHub OAuth
- **Sandboxes**: Modal
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

```bash
# 1. Install dependencies
pnpm install

# 2. Set up Convex
cd packages/convex
npx convex dev
# Creates your project and generates .env.local

# 3. Copy Convex URL to web app
cp packages/convex/.env.local apps/web/.env.local
# Edit to rename CONVEX_URL → NEXT_PUBLIC_CONVEX_URL

# 4. Configure GitHub OAuth in Convex dashboard
# Add AUTH_GITHUB_ID and AUTH_GITHUB_SECRET

# 5. Set up API env (apps/api/.env)
CONVEX_URL=https://your-deployment.convex.cloud
MODAL_TOKEN_ID=your-modal-token
MODAL_TOKEN_SECRET=your-modal-secret
ANTHROPIC_API_KEY=your-anthropic-key

# 6. Run dev servers
pnpm dev
```

Open http://localhost:3001
