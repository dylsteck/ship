---
phase: 01-foundation-authentication
plan: 01
subsystem: infra
tags: [turborepo, nextjs, cloudflare-workers, hono, tailwind, monorepo, pnpm]

# Dependency graph
requires: []
provides:
  - Turborepo monorepo with pnpm workspaces
  - Next.js 15.2.3+ web app with Tailwind v4
  - Cloudflare Worker API with Hono framework
  - Shared packages (@ship/ui, @ship/types, @ship/config)
  - TypeScript configurations for Next.js and Workers
affects: [all-future-phases, authentication, database, ui]

# Tech tracking
tech-stack:
  added: [turborepo@2.8.1, next@15.5.11, react@19.2.1, tailwindcss@4.1.18, hono@4.6.18, wrangler@3.99.1]
  patterns: [monorepo-workspace, css-first-tailwind, worker-api]

key-files:
  created:
    - turbo.json
    - pnpm-workspace.yaml
    - apps/web/app/layout.tsx
    - apps/web/app/globals.css
    - apps/api/src/index.ts
    - apps/api/wrangler.toml
    - packages/config/typescript/*.json
  modified:
    - package.json
    - .gitignore

key-decisions:
  - "Turborepo 2.x for monorepo orchestration instead of Nx or Lerna"
  - "Tailwind v4 CSS-first configuration using @theme directive instead of JS config"
  - "Cloudflare Workers with Hono instead of Express for Edge-native API"
  - "Relative path imports for TypeScript config extends (not package names)"

patterns-established:
  - "Workspace packages use workspace:* protocol for dependencies"
  - "Each workspace has its own tsconfig extending shared base"
  - "Apps use @ship/* namespace for shared packages"
  - "Turbo tasks use ^dependency pattern for build orchestration"

# Metrics
duration: 5min
completed: 2026-02-01
---

# Phase 01 Plan 01: Turborepo Monorepo Scaffold Summary

**Turborepo monorepo with Next.js 15 web app (Tailwind v4 CSS-first), Cloudflare Worker API (Hono), and shared TypeScript packages**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-01T22:52:34Z
- **Completed:** 2026-02-01T22:57:23Z
- **Tasks:** 3
- **Files modified:** 26

## Accomplishments
- Established Turborepo monorepo structure replacing single Next.js app
- Next.js 15.5.11 with React 19.2.1 and Tailwind v4 CSS-first configuration
- Cloudflare Worker API with Hono framework and health endpoint
- Shared workspace packages for UI components, types, and TypeScript configs
- Both apps running simultaneously via `pnpm dev` from root

## Task Commits

Each task was committed atomically:

1. **Task 1: Create root workspace and Turborepo configuration** - `0c71127` (chore)
2. **Task 2: Create Next.js web app with Tailwind v4** - `d3610c0` (feat)
3. **Task 3: Create Cloudflare Worker API with Hono and shared packages** - `4aaa444` (feat)

## Files Created/Modified
- `turbo.json` - Turborepo task pipeline with build, lint, dev, type-check tasks
- `pnpm-workspace.yaml` - Workspace definition for apps/* and packages/*
- `packages/config/typescript/` - Shared TypeScript configs (base, nextjs, worker)
- `apps/web/app/layout.tsx` - Next.js root layout with metadata
- `apps/web/app/globals.css` - Tailwind v4 CSS with @theme brand colors
- `apps/web/tailwind.config.ts` - Tailwind v4 minimal configuration
- `apps/web/postcss.config.mjs` - PostCSS with @tailwindcss/postcss plugin
- `apps/api/src/index.ts` - Hono app with CORS middleware
- `apps/api/src/routes/health.ts` - Health check endpoint
- `apps/api/wrangler.toml` - Cloudflare Worker config with D1 binding
- `packages/ui/` - Shared UI components package (placeholder)
- `packages/types/` - Shared TypeScript types package (placeholder)

## Decisions Made

1. **Archived old single-app structure**: Moved existing app/, components/, lib/ to _old_v1/ to preserve v1 code while building v2 monorepo structure.

2. **TypeScript config extends via relative paths**: Used relative paths (../../packages/config/typescript/base.json) instead of package names (@ship/config/typescript/base.json) because TypeScript's extends doesn't resolve through pnpm workspace packages.

3. **Tailwind v4 CSS-first approach**: Used @theme directive in globals.css instead of tailwind.config.js for brand colors, following Tailwind v4's new CSS-first paradigm.

4. **Shared packages created upfront**: Created @ship/ui and @ship/types packages during Task 2 (instead of Task 3) to resolve workspace dependency resolution, even though they're placeholder packages.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Created shared packages earlier than planned**
- **Found during:** Task 2 (Next.js web app creation)
- **Issue:** pnpm install failed with "package not found in workspace" when apps/web referenced @ship/ui and @ship/types before they existed
- **Fix:** Created packages/ui and packages/types with placeholder package.json and src/index.ts files
- **Files modified:** packages/ui/package.json, packages/ui/tsconfig.json, packages/ui/src/index.ts, packages/types/package.json, packages/types/tsconfig.json, packages/types/src/index.ts
- **Verification:** pnpm install succeeded, workspace dependencies resolved
- **Committed in:** d3610c0 (Task 2 commit)

**2. [Rule 1 - Bug] Fixed TypeScript config resolution**
- **Found during:** Task 2 (Next.js type-check)
- **Issue:** TypeScript couldn't resolve @ship/config/typescript/nextjs.json extends because package name resolution doesn't work for extends field
- **Fix:** Changed all tsconfig.json files to use relative paths for extends (../../packages/config/typescript/base.json)
- **Files modified:** apps/web/tsconfig.json, packages/ui/tsconfig.json, packages/types/tsconfig.json
- **Verification:** pnpm type-check succeeded with no TypeScript errors
- **Committed in:** d3610c0 (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug)
**Impact on plan:** Both fixes necessary for correct operation. Package creation sequencing doesn't affect end result. TypeScript config resolution fix is standard practice for monorepos.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness

**Ready for next phase:**
- Monorepo structure established and verified working
- Both web and API apps running locally
- Shared package infrastructure in place for UI components and types
- TypeScript strict mode enabled across all packages
- Tailwind v4 brand colors configured

**No blockers or concerns** - foundation is solid for authentication implementation.

---
*Phase: 01-foundation-authentication*
*Completed: 2026-02-01*
