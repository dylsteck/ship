# Technology Stack

**Analysis Date:** 2026-02-01

## Languages

**Primary:**
- TypeScript 5.9.3 - All application code (frontend, backend, API routes)
- JavaScript (ES2017 target) - Configuration files and build-time code

**Secondary:**
- Shell/Bash - Used in sandbox command execution for agent CLI invocation
- SQL - Generated via Drizzle ORM migrations

## Runtime

**Environment:**
- Node.js 22.x - Required version specified in package.json engines

**Package Manager:**
- pnpm 9.0.0 - Lockfile-based dependency management
- Lockfile: `pnpm-lock.yaml` (present)

## Frameworks

**Core:**
- Next.js 16.0.10 - Full-stack React framework with App Router, API routes, server components
- React 19.2.1 - UI library and component framework
- React DOM 19.2.1 - DOM rendering for React

**Database & ORM:**
- Drizzle ORM 0.36.4 - Type-safe SQL ORM for PostgreSQL
- Drizzle Kit 0.30.6 - CLI for migrations and schema management
- postgres 3.4.8 - PostgreSQL driver (compatible with Neon)
- @neondatabase/serverless 0.10.4 - Neon-optimized serverless PostgreSQL adapter

**UI & Styling:**
- Tailwind CSS 4.1.18 - Utility-first CSS framework
- @tailwindcss/postcss 4.1.18 - PostCSS integration for Tailwind
- Radix UI - Component library with primitives (@radix-ui/*) for accessible UI
- Lucide React 0.544.0 - Icon component library

**State Management:**
- Jotai 2.16.2 - Primitive and flexible state management library

**Testing:**
- None detected in package.json (no jest, vitest, etc.)

**Build/Dev:**
- Next.js with Turbopack (--turbopack flag in dev script)
- tsx 4.21.0 - TypeScript execution and compilation
- TypeScript Compiler (tsc) - For type checking via `type-check` script

## Key Dependencies

**Critical:**
- ai 5.0.51 - Vercel AI SDK (SDK abstraction, may not actively used in analyzed code)
- @vercel/sdk 1.18.7 - Vercel API client for platform integrations
- @vercel/sandbox 0.0.21 - Vercel Sandbox runtime for executing agents and code in isolated environments
- drizzle-orm 0.36.4 - Type-safe ORM for database operations

**GitHub Integration:**
- @octokit/rest 22.0.1 - GitHub API client for repository management, OAuth, and PR operations
- arctic 3.7.0 - OAuth library for authentication flows

**Authentication & Security:**
- jose 6.1.3 - JSON Web Token (JWT) signing and verification
- js-cookie 3.0.5 - Client-side cookie management

**UI & UX:**
- sonner 2.0.7 - Toast notification component library
- vaul 1.1.2 - Drawer/sheet component library
- @monaco-editor/react 4.7.0 - Monaco code editor React wrapper
- class-variance-authority 0.7.1 - CSS class variant utility
- clsx 2.1.1 - Conditional className utility

**Terminal UI:**
- xterm 5.3.0 - Terminal emulator library
- xterm-addon-fit 0.8.0 - Xterm addon for terminal fitting
- ws 8.19.0 - WebSocket library for real-time communication

**Analytics:**
- @vercel/analytics 1.6.1 - Vercel Analytics integration
- @vercel/speed-insights 1.3.1 - Vercel Speed Insights integration

**Data & Utilities:**
- zod 4.3.6 - Runtime schema validation library
- nanoid 5.1.6 - URL-friendly unique ID generator
- ms 2.1.3 - Time conversion utility
- streamdown 1.6.11 - Markdown stream parser
- next-themes 0.4.6 - Theme management for dark/light modes
- @git-diff-view/file 0.0.32 - Git diff file visualization
- @git-diff-view/react 0.0.32 - Git diff React component

## Configuration

**Environment:**
- Configuration via `.env.local` (development) and environment variables
- Required environment variables:
  - `POSTGRES_URL` - Database connection string (Neon PostgreSQL format)
  - `NEXT_PUBLIC_GITHUB_CLIENT_ID` - GitHub OAuth client ID (public)
  - `GITHUB_CLIENT_SECRET` - GitHub OAuth client secret
  - `JWE_SECRET` - Secret for JWT encryption
  - `ENCRYPTION_KEY` - Key for encrypting sensitive data (tokens)
  - `SANDBOX_VERCEL_TOKEN` - Vercel API token for sandbox access
  - `SANDBOX_VERCEL_TEAM_ID` - Vercel team ID
  - `SANDBOX_VERCEL_PROJECT_ID` - Vercel project ID
  - `ANTHROPIC_API_KEY` - Claude/Anthropic API key (optional, user-provided)
  - `OPENAI_API_KEY` - OpenAI API key (optional, user-provided)
  - `CURSOR_API_KEY` - Cursor IDE API key (optional, user-provided)
  - `GEMINI_API_KEY` - Google Gemini API key (optional, user-provided)
  - `AI_GATEWAY_API_KEY` - Anthropic AI Gateway key (optional, fallback for ANTHROPIC_API_KEY)

**Build:**
- `next.config.ts` - Next.js configuration with image optimization rules
- `tsconfig.json` - TypeScript compiler options with strict mode enabled
- `eslint.config.mjs` - ESLint configuration (Next.js core web vitals + TypeScript)
- `postcss.config.mjs` - PostCSS configuration with Tailwind CSS plugin
- `drizzle.config.ts` - Drizzle ORM configuration for PostgreSQL migrations
- `.prettierrc` (embedded in package.json) - Prettier formatting rules:
  - No semicolons, single quotes, 120 char line width, trailing commas

## Platform Requirements

**Development:**
- Node.js 22.x
- pnpm 9.0.0
- GitHub OAuth application credentials
- Vercel account with sandbox project credentials

**Production:**
- Node.js 22.x runtime
- PostgreSQL database (Neon or compatible)
- Vercel platform (for Sandbox runtime)
- GitHub OAuth application registration
- API keys for AI providers (Claude/Anthropic, OpenAI, Cursor, Gemini, AI Gateway)

---

*Stack analysis: 2026-02-01*
