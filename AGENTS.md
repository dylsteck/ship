# AGENTS.md

This document provides context for AI agents working on this codebase.

## Setup

```bash
pnpm install
pnpm dev
```

## Build

```bash
pnpm build          # Build all packages and apps
pnpm build:web      # Build only web app (or: cd apps/web && pnpm build)
```

## Ports

- Web app: `http://localhost:3001`
- API: `http://localhost:3000`

## Project Structure

```
ship/
├── apps/
│   ├── web/          # Next.js 16 frontend
│   └── api/          # Hono API backend
├── packages/
│   ├── convex/       # Convex schema, auth, queries/mutations
│   ├── ui/           # Shared UI components
│   ├── constants/    # Shared constants
│   └── ...           # Config packages
```

## Code Style

- **TypeScript**: Strict mode enabled across all packages
- **Module system**: ESM (ECMAScript Modules)
- **Formatting**: Prettier (run `pnpm format`)
- **Linting**: ESLint with TypeScript support

## Key Conventions

- Use `pnpm` (not npm or yarn)
- Import from workspace packages using `@repo/` prefix (e.g., `@repo/ui`, `@repo/convex`)
- API routes in `apps/api/src/routes/`
- React components use `.tsx` extension
- Prefer named exports over default exports

## Environment Variables

Required env vars are documented in `.env.example` files in each app.

Key variables:
- `CONVEX_DEPLOYMENT` / `NEXT_PUBLIC_CONVEX_URL` - Convex connection
- `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` - GitHub OAuth
- `MODAL_TOKEN_ID` / `MODAL_TOKEN_SECRET` - Modal sandbox access
- `ANTHROPIC_API_KEY` - For OpenCode agent

## Testing

(To be added)

## PR Guidelines

- Use conventional commits: `feat:`, `fix:`, `docs:`, `chore:`, etc.
- Keep PRs focused on a single concern
- Include description of changes and testing done
