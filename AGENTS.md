# AGENTS.md

This document provides context for AI agents working on this codebase.

## Setup

```bash
pnpm install
pnpm dev
```

## Build

```bash
pnpm build        # Build the app
pnpm type-check   # Type check only
```

## Port

- App: `http://localhost:3000`

## Project Structure

```
ship/
├── app/                  # Next.js App Router
│   ├── api/              # API routes
│   │   ├── auth/         # Auth endpoints
│   │   ├── tasks/        # Task CRUD
│   │   ├── repos/        # GitHub repos
│   │   ├── connectors/   # MCP connectors
│   │   └── user/         # User settings/keys
│   ├── tasks/            # Task pages
│   └── page.tsx          # Home page
├── components/           # React components
│   ├── auth/             # Auth components
│   ├── layout/           # Layout (AppLayout, Sidebar, Header)
│   ├── logos/            # Agent logo SVGs
│   └── ui/               # shadcn/ui primitives
├── lib/                  # Business logic
│   ├── atoms/            # Jotai state atoms
│   ├── db/               # Drizzle ORM (schema, client)
│   ├── sandbox/          # Vercel Sandbox utilities
│   │   ├── agents/       # Agent implementations
│   │   ├── creation.ts   # Sandbox creation
│   │   ├── commands.ts   # Command execution
│   │   └── git.ts        # Git operations
│   ├── session/          # JWE session management
│   └── utils/            # Helpers (id, logging, rate-limit)
└── public/               # Static assets
```

## Code Style

- **TypeScript**: Strict mode enabled
- **Module system**: ESM
- **Formatting**: Prettier (`pnpm format`)
- **Linting**: ESLint with Next.js config
- **File size**: Keep files and functions small and focused
  - Components should be under ~300 lines
  - Hooks should be under ~300 lines
  - Functions should be under ~100 lines
  - If a file exceeds these limits, break it into smaller, focused components/hooks

## Key Conventions

- Use `pnpm` (not npm or yarn)
- Import with `@/` path alias (e.g., `@/lib/db/client`)
- API routes in `app/api/`
- React components use `.tsx` extension
- Prefer named exports over default exports

## Environment Variables

See `.env.example` for all variables. Key ones:

```env
# Database
POSTGRES_URL=postgresql://...

# Auth
JWE_SECRET=...
ENCRYPTION_KEY=...
NEXT_PUBLIC_GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...

# Vercel Sandbox
SANDBOX_VERCEL_TOKEN=...
SANDBOX_VERCEL_TEAM_ID=...
SANDBOX_VERCEL_PROJECT_ID=...

# Agent API Keys (optional)
ANTHROPIC_API_KEY=...
OPENAI_API_KEY=...
```

## Database

Using Drizzle ORM with Neon Postgres.

```bash
pnpm db:push      # Push schema to database
pnpm db:studio    # Open Drizzle Studio
pnpm db:generate  # Generate migrations
pnpm db:migrate   # Run migrations
```

## Testing

(To be added)

## PR Guidelines

- Use conventional commits: `feat:`, `fix:`, `docs:`, `chore:`, etc.
- Keep PRs focused on a single concern
- Include description of changes and testing done
