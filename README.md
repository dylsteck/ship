# Ship

Personal background coding agent. Select a repo, spin up a sandboxed VM, and let AI agents work autonomously.

## Stack

- **Framework**: Next.js 16 (App Router)
- **Database**: Neon Postgres + Drizzle ORM
- **Auth**: JWE sessions + GitHub OAuth
- **Sandboxes**: Vercel Sandbox
- **Agents**: Claude, Codex, Copilot, Cursor, Gemini, OpenCode
- **UI**: Tailwind CSS + shadcn/ui

## Structure

```
ship/
├── app/              # Next.js App Router pages & API routes
│   ├── api/          # API routes (auth, tasks, repos, etc.)
│   ├── tasks/        # Task pages
│   ├── repos/        # Repo pages
│   └── page.tsx      # Home page
├── components/       # React components
│   ├── auth/         # Auth components
│   ├── dialogs/      # Dialog components
│   ├── file-browser/ # File browser & editor
│   ├── layout/       # Layout components
│   ├── logos/        # Agent logo SVGs
│   ├── terminal/     # Terminal/logs pane
│   └── ui/           # shadcn/ui components
├── lib/              # Utilities and business logic
│   ├── atoms/        # Jotai atoms for state
│   ├── db/           # Drizzle schema and client
│   ├── sandbox/      # Vercel Sandbox utilities
│   ├── session/      # JWE session management
│   └── utils/        # Helper utilities
└── public/           # Static assets
```

## Setup

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Database Setup (Neon Postgres)

1. Create a Neon project at [neon.tech](https://neon.tech)
2. Copy your connection string
3. Run migrations:

```bash
pnpm db:push
```

### 3. Generate Secrets

```bash
# JWE Secret (32 bytes)
openssl rand -hex 32

# Encryption Key (32 bytes)
openssl rand -hex 32
```

### 4. GitHub OAuth App

1. Go to [github.com/settings/developers](https://github.com/settings/developers)
2. Click **New OAuth App**
3. Fill in:
   - **Application name**: `Ship`
   - **Homepage URL**: `http://localhost:3000`
   - **Authorization callback URL**: `http://localhost:3000/api/auth/github/callback`
4. Copy **Client ID** and **Client Secret**

### 5. Vercel Sandbox

For sandbox functionality, you need:
- A Vercel account with sandbox access
- Create a project for sandbox usage
- Generate an API token

### 6. Environment Variables

Create `.env.local` with:

```env
# Database (required)
POSTGRES_URL=postgresql://user:pass@host/db?sslmode=require

# Auth Secrets (required)
JWE_SECRET=your-32-byte-hex-secret
ENCRYPTION_KEY=your-32-byte-hex-secret

# GitHub OAuth (required)
NEXT_PUBLIC_GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret

# Vercel Sandbox (required for running agents)
SANDBOX_VERCEL_TOKEN=your-vercel-token
SANDBOX_VERCEL_TEAM_ID=your-team-id
SANDBOX_VERCEL_PROJECT_ID=your-project-id

# Agent API Keys (optional - users can provide their own)
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
CURSOR_API_KEY=...
GEMINI_API_KEY=...
AI_GATEWAY_API_KEY=...

# Limits
MAX_SANDBOX_DURATION=300
MAX_MESSAGES_PER_DAY=50
```

### 7. Run Development

```bash
pnpm dev
```

Open http://localhost:3000

## Build

```bash
pnpm build       # Build the app
pnpm start       # Start production server
```

## Database Commands

```bash
pnpm db:generate  # Generate migrations
pnpm db:migrate   # Run migrations
pnpm db:push      # Push schema to database
pnpm db:studio    # Open Drizzle Studio
```

## Deployment (Vercel)

1. Create a new Vercel project
2. Connect your repo
3. Add environment variables
4. Deploy

Note: Vercel Sandbox tokens work automatically when deployed to Vercel.

## Supported Agents

| Agent | CLI | Description |
|-------|-----|-------------|
| Claude | `claude` | Anthropic's Claude Code CLI |
| Codex | `codex` | OpenAI's Codex CLI |
| Copilot | `gh copilot` | GitHub Copilot CLI |
| Cursor | `cursor` | Cursor's AI CLI |
| Gemini | `gemini` | Google's Gemini CLI |
| OpenCode | OpenCode SDK | Vercel's OpenCode SDK |
