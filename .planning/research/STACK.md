# Stack Research

**Domain:** Background Agent Platform with Sandboxed Execution
**Researched:** 2026-02-01
**Confidence:** HIGH

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| **Next.js** | 15.1+ (stable with React 19) | Frontend framework with App Router | Production-ready with React 19 stable support (Dec 2024), best-in-class Server Components, native streaming, and first-class TypeScript support. Next.js 16.0.10 is bleeding edge but 15.1+ is recommended for stability. |
| **React** | 19.2+ | UI library | Stable release with improved Server Components, async components, and Actions. Full ecosystem support as of Jan 2026. |
| **TypeScript** | 5.9.3+ | Type safety | Latest stable version with enhanced performance. TypeScript 7 (native Go-based) coming soon with 10x speedup but still in preview. Use 5.9.x for production. |
| **Turborepo** | Latest | Monorepo orchestration | Industry-standard for monorepo builds with intelligent caching, parallel execution, and pnpm workspace integration. Critical for multi-app architectures. |
| **pnpm** | 9.0+ | Package manager | 3x faster than npm, better disk efficiency with content-addressable storage, and native monorepo support. Official recommendation over npm/yarn for Turborepo. |

### Backend Infrastructure (Cloudflare)

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| **Cloudflare Workers** | Latest runtime | Serverless compute | Zero cold starts, 330+ edge locations, native TypeScript support, and tight integration with Durable Objects. Perfect for low-latency API responses. |
| **Durable Objects** | SQLite-backed (GA) | Stateful coordination | Strongly consistent state management at the edge. SQLite storage is now GA (Jan 2026) and recommended over key-value storage. 10GB per object limit. |
| **Cloudflare D1** | GA | Relational metadata storage | Managed SQLite database with automatic replication. Use for global metadata (users, projects, sessions). Complementary to Durable Objects. |
| **Cloudflare R2** | GA | Object storage (files/screenshots) | S3-compatible storage with **zero egress fees**. Perfect for agent artifacts, screenshots, and large files. Native Workers integration. |
| **Wrangler** | 3.x+ | CLI and local dev | Official Cloudflare CLI for development, deployment, and testing. Essential for Workers/Durable Objects workflow. |

### AI Agent Infrastructure

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| **E2B Sandboxes** | `e2b@2.10.2` | Secure code execution | Firecracker microVMs with ~90-150ms cold starts, TypeScript-native SDK, and production-grade security. Note: Package renamed from `@e2b/sdk` to `e2b` - use the new package. |
| **OpenCode SDK** | `@opencode-ai/sdk@1.1.23` | AI coding agent framework | Official SDK for programmatic control of OpenCode agents. Actively maintained (published hours ago as of search), supports 75+ AI providers, and provides type-safe client for agent orchestration. |
| **Vercel AI SDK** | `ai@5.0.51` | AI model orchestration | Unified interface for multiple LLM providers (Anthropic, OpenAI, etc.), streaming support, and React Server Components integration. Industry standard for AI-powered Next.js apps. |

### Sandbox Environment Tools

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| **code-server** | Latest (Coder org) | VS Code in browser | Open-source VS Code in the browser for sandbox IDE access. Prefer code-server (Coder) over official VS Code Server for flexibility and marketplace compatibility workarounds. |
| **Playwright** | Latest | Headless browser automation | Microsoft-built framework with 200ms headless start times, multi-browser support (Chromium, Firefox, WebKit), and WebSocket-based architecture for reliability. 45% of QA teams use it. |
| **xterm.js** | `xterm@5.3.0` | Terminal emulator | Industry-standard web terminal. Already in use - continue with current version. Pair with `xterm-addon-fit@0.8.0` for responsive sizing. |

### Database & ORM

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| **Drizzle ORM** | `drizzle-orm@0.36.4` | TypeScript-first ORM | Lightweight (~7.4kb), serverless-ready, and supports PostgreSQL, SQLite, and D1. Embraces modern PostgreSQL identity columns over serial types. Better DX than Prisma for edge runtimes. |
| **PostgreSQL (Neon)** | Latest serverless | Primary database | Serverless PostgreSQL with auto-scaling, branching, and edge-optimized connection pooling. Already in use with `@neondatabase/serverless@0.10.4`. |
| **Drizzle Kit** | `drizzle-kit@0.30.6` | Schema migrations | Official migration tool for Drizzle. Simple, type-safe migrations without code generation overhead. |

### API Layer

| Technology | Version | Purpose | When to Use |
|------------|---------|---------|-------------|
| **Hono** | 4.8+ | Lightweight web framework | Use for Cloudflare Workers API routes. Ultra-fast, 0-dependency, works on all runtimes. Officially used by Cloudflare for internal APIs (KV, Queues, Workers Logs). |
| **tRPC** | `@trpc/server@next` | End-to-end type-safe RPC | Use for Next.js App Router to Workers communication if you need automatic type inference. Pairs with `@tanstack/react-query` for client-side data fetching. Skip if Hono REST + Zod validation suffices. |

### UI & Styling

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| **shadcn/ui** | Latest (React 19 compatible) | Component library | Fully compatible with React 19 and Next.js 15 as of Nov 2024. Copy-paste components built on Radix UI primitives. Already extensively used in project. |
| **Radix UI** | Latest | Headless UI primitives | Foundation for shadcn/ui. Provides accessible, unstyled components. Already in use - continue with current versions. |
| **Tailwind CSS** | v4.1.18+ | Utility-first CSS | v4.0 stable (Jan 2025) with 5x faster builds, 100x faster incremental builds, CSS-first configuration. Project already using v4. Excellent choice. |
| **Lucide Icons** | `lucide-react@0.544.0` | Icon library | Modern, consistent icon set with React components. Already in use. |

### Data Fetching & State Management

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| **TanStack Query** | `@tanstack/react-query@latest` | Server state management | The 2026 standard for React Server Components + client-side caching. Handles background refetching, optimistic updates, and works seamlessly with Next.js App Router streaming. |
| **Jotai** | `jotai@2.16.2` | Atomic state management | Already in use. Lightweight alternative to Recoil/Zustand for client-side state. Keep for UI state that doesn't belong in React Query. |

### Authentication & Authorization

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| **Clerk** | `@clerk/nextjs@latest` | User authentication | Production-ready in ~30 minutes, first-class Next.js 15 support, handles OAuth (GitHub included), session management, and webhooks. Note: CVE-2025-29927 patched in Next.js 15.2.3+ - ensure updated. |
| **Arctic** | `arctic@3.7.0` | OAuth client (alternative) | Already in use. Lightweight OAuth library supporting 50+ providers. Good for custom OAuth flows. Clerk handles GitHub OAuth by default. |

### Integrations

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| **Octokit** | `@octokit/rest@22.0.1` | GitHub API client | Official GitHub REST API client. Already in use. Essential for GitHub integration features. |
| **Linear SDK** | `@linear/sdk@latest` | Linear API client | Official TypeScript SDK for Linear's GraphQL API. Strongly typed, actively maintained (updated Feb 1, 2026). |
| **Vercel SDK** | `@vercel/sdk@1.18.7` | Vercel API integration | Already in use. Enables deployment automation, project management, and environment variables control. |

### Background Jobs & Events

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| **Inngest** | `inngest@latest` | Background job orchestration | Zero-infrastructure background jobs with automatic retries, type-safe event payloads, and real-time updates (2025 feature). Works with Next.js, Cloudflare Workers, and all serverless platforms. |

### Validation & Utilities

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| **Zod** | `zod@4.3.6` | Schema validation | TypeScript-first runtime validation. Tested against TS 5.5+. Essential for API input validation and type inference. Already in use at v4 (latest major version). |
| **nanoid** | `nanoid@5.1.6` | ID generation | Secure, URL-friendly unique IDs. Already in use. Smaller and faster than uuid. |
| **jose** | `jose@6.1.3` | JWT operations | Modern, secure JWT library. Already in use. Recommended over jsonwebtoken for edge runtimes. |

## Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `class-variance-authority` | 0.7.1 | Component variants | Already in use. Pairs with Tailwind for dynamic component styling. |
| `clsx` / `tailwind-merge` | Latest | Conditional classes | Already in use. `clsx` for conditional logic, `tailwind-merge` to prevent class conflicts. |
| `sonner` | 2.0.7 | Toast notifications | Already in use. Opinionated toast library with great DX. |
| `next-themes` | 0.4.6 | Dark mode | Already in use. Standard for theme switching in Next.js. |
| `vaul` | 1.1.2 | Mobile drawer | Already in use. Accessible drawer component for mobile. |
| `@monaco-editor/react` | 4.7.0 | Code editor | Already in use. React wrapper for Monaco (VS Code's editor). Good for in-browser code viewing/editing. |
| `@vercel/analytics` | 1.6.1 | Analytics | Already in use. Privacy-friendly analytics for Vercel deployments. |
| `@vercel/speed-insights` | 1.3.1 | Performance monitoring | Already in use. Real User Monitoring for Core Web Vitals. |

## Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| **ESLint** | Linting | v9.39+ with flat config format. Next.js 15 added ESLint 9 support (v8 EOL Oct 2024). Use `eslint-config-next` for Next.js rules. |
| **Prettier** | Code formatting | v3.8.1 already configured. Keep for code formatting. |
| **Biome** (optional) | Unified linter/formatter | 10-100x faster than ESLint+Prettier. Rust-based. v2.3+ has 423 lint rules and type-aware linting. Consider for new projects or gradual migration. |
| **tsx** | TypeScript execution | Already in use (4.21.0). Fast TypeScript runner for scripts. |
| **Vitest** (recommended) | Unit testing | Modern Jest alternative with native ESM/TypeScript support. 1.5M weekly downloads. Faster than Jest, works with Vite/Next.js. |

## Installation

```bash
# Core dependencies (already installed)
pnpm install next@latest react@latest react-dom@latest
pnpm install typescript@5.9.3 @types/react @types/react-dom @types/node

# Cloudflare Workers
pnpm install -D wrangler@latest

# AI Agent Infrastructure
pnpm install e2b@latest @opencode-ai/sdk@latest ai@latest

# Database & ORM
pnpm install drizzle-orm@latest drizzle-kit@latest
pnpm install @neondatabase/serverless postgres

# API Layer (choose one)
pnpm install hono@latest  # For Workers
# OR
pnpm install @trpc/server@next @trpc/client@next @trpc/react-query@next

# UI & Styling (already installed)
pnpm install tailwindcss@latest @tailwindcss/postcss@latest
pnpm install lucide-react class-variance-authority clsx tailwind-merge

# Data Fetching
pnpm install @tanstack/react-query@latest jotai

# Authentication
pnpm install @clerk/nextjs@latest
# OR
pnpm install arctic

# Integrations
pnpm install @octokit/rest @linear/sdk @vercel/sdk

# Background Jobs
pnpm install inngest

# Validation & Utilities
pnpm install zod nanoid jose

# Dev dependencies
pnpm install -D eslint@latest eslint-config-next@latest prettier@latest
pnpm install -D vitest @vitest/ui  # Testing
pnpm install -D @biomejs/biome@latest  # Optional: ESLint/Prettier alternative
```

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| **Turborepo** | Nx | Choose Nx if you need advanced code generation, integrated testing, or built-in deployment scripts. Turborepo is simpler and faster for most monorepos. |
| **pnpm** | npm / yarn | Use npm if you're on a legacy project or team with strict npm requirements. pnpm is objectively faster and more efficient. |
| **Cloudflare Workers** | Vercel Edge Functions / AWS Lambda | Use Vercel Edge if you're all-in on Vercel. Use Lambda if you need longer execution times (15min vs 30s) or complex VPC networking. Workers has better cold starts and global distribution. |
| **Durable Objects** | Redis / Upstash | Use Redis/Upstash if you need traditional pub/sub, caching, or multi-region replication with eventual consistency. Durable Objects provide strong consistency and stateful coordination. |
| **Drizzle ORM** | Prisma | Use Prisma if you need a mature ecosystem with DataGrip-like Studio, extensive migrations tooling, or GraphQL integration. Drizzle is lighter and better for edge runtimes. |
| **Hono** | Express / Fastify | Use Express for maximum ecosystem compatibility (middleware, plugins). Use Fastify for Node.js-specific performance. Hono is built for edge runtimes and multi-platform support. |
| **Clerk** | NextAuth.js / Better Auth | Use NextAuth v5 (Auth.js) if you need full control and zero vendor lock-in. Use Better Auth (2026 successor) for modern architecture. Clerk offers fastest time-to-production. |
| **Vitest** | Jest | Use Jest if you have existing test suites or need maximum ecosystem compatibility. Vitest is faster and has better native TypeScript/ESM support. |
| **Biome** | ESLint + Prettier | Keep ESLint+Prettier if you have extensive custom plugins or existing configurations. Biome is 10-100x faster but has a smaller ecosystem (80%+ rule compatibility). |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| **`@e2b/sdk`** | Package renamed - deprecated | Use `e2b` package instead (v2.10.2+) |
| **ESLint 8** | End-of-life Oct 2024 | Upgrade to ESLint 9 with flat config format |
| **Node.js < 22.x** | Project specifies Node 22.x in engines | Use Node 22.x LTS for best compatibility |
| **Serial types in PostgreSQL** | Deprecated in favor of identity columns | Use `GENERATED ALWAYS AS IDENTITY` (Drizzle supports this) |
| **REST APIs without validation** | Runtime type safety is critical for agents | Always use Zod schemas for input validation |
| **Monolithic Workers** | Single Worker handling all requests becomes bottleneck | Use Durable Objects for coordination, Workers for routing |
| **Global Durable Objects** | Single object handling all state is an anti-pattern | Create one Durable Object per coordination unit (session, project, etc.) |
| **Key-value storage in Durable Objects** | SQLite storage is now GA and recommended | Migrate to SQLite-backed Durable Objects for structured data |
| **Long-running processes in Workers** | 30s CPU time limit, 15min wall-clock limit | Use E2B sandboxes for long-running agent tasks |
| **Bundling node_modules in Workers** | Increases bundle size and cold start times | Use external modules via wrangler config |

## Stack Patterns by Use Case

### Pattern 1: Real-time Agent Session Management
**Use:**
- Cloudflare Workers (entry point, authentication)
- Durable Objects with SQLite storage (session state, coordination)
- E2B sandbox (agent execution environment)
- WebSockets (real-time updates to client)

**Why:** Durable Objects provide strongly consistent state for coordinating agent actions, Workers handle authentication and routing, E2B provides secure isolated execution, and WebSockets (via Hibernatable WebSockets) minimize active duration costs.

### Pattern 2: Background Task Processing
**Use:**
- Inngest (event orchestration, retries)
- Cloudflare Workers (event handlers)
- Durable Objects (long-running state)
- R2 (artifact storage)

**Why:** Inngest handles scheduling, retries, and observability. Workers execute the tasks. Durable Objects maintain state across retries. R2 stores results.

### Pattern 3: Multi-tenant Project Management
**Use:**
- Hierarchical Durable Objects (tenant → project → session)
- D1 (tenant metadata, users, permissions)
- R2 (project files, screenshots)

**Why:** Each tenant gets a parent Durable Object that coordinates child project objects. This enables parallelism (different projects can operate independently). D1 stores queryable metadata. R2 stores large files.

### Pattern 4: Agent Code Execution
**Use:**
- E2B sandbox (isolated execution)
- OpenCode SDK (agent framework)
- code-server (browser-based IDE)
- Playwright (browser automation)
- xterm.js (terminal access)

**Why:** E2B provides the secure VM. OpenCode provides the agent framework. code-server gives users IDE access to the sandbox. Playwright enables browser-based testing. xterm.js provides terminal access.

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| Next.js 15.1+ | React 19.2+ | Next.js 16.x is bleeding edge - use 15.1+ for stability |
| React 19.2+ | TypeScript 5.5+ | React 19 stable since Dec 2024 |
| Tailwind CSS v4 | PostCSS plugin format | v4 uses `@tailwindcss/postcss` instead of separate plugins |
| Drizzle ORM | PostgreSQL 14+ | Supports identity columns (modern approach) |
| Cloudflare Workers | Wrangler 3.x+ | Wrangler 3.x required for Durable Objects SQLite storage |
| E2B `e2b` package | OpenCode SDK | Both work together for sandbox-based agent execution |
| TanStack Query v5 | Next.js 15 App Router | Use `dehydrate` and `HydrationBoundary` for RSC prefetching |
| Clerk | Next.js 15.2.3+ | CVE-2025-29927 patched in 15.2.3+ - critical security update |

## Critical Security Notes

1. **Next.js CVE-2025-29927**: Upgrade to Next.js 15.2.3+, 14.2.25+, 13.5.9+, or 12.3.5+ to patch critical middleware bypass vulnerability (CVSS 9.1). Disclosed Mar 21, 2025.

2. **Cloudflare Workers Secrets**: Never bundle secrets in Workers. Use environment variables via wrangler.toml bindings.

3. **E2B Sandboxes**: While E2B provides VM-level isolation, always validate agent-generated code before execution. Implement timeout limits and resource quotas.

4. **GitHub OAuth**: Use Clerk or Arctic for OAuth flows. Never store tokens in localStorage - use httpOnly cookies or Clerk's session management.

5. **Database Credentials**: Use Neon's connection pooling and never expose direct PostgreSQL connection strings to the client.

## Sources

### High Confidence (Official Documentation & Verified)
- [E2B GitHub Repository](https://github.com/e2b-dev/E2B) — Active development, Jan 29, 2026 updates
- [OpenCode SDK](https://opencode.ai/docs/sdk/) — Latest version 1.1.23, published hours before search
- [Cloudflare Durable Objects Best Practices](https://developers.cloudflare.com/durable-objects/best-practices/rules-of-durable-objects/) — Dec 2025 guidance
- [Cloudflare R2 Documentation](https://developers.cloudflare.com/r2/) — 2026 current
- [Next.js 15 Documentation](https://nextjs.org/blog/next-15) — React 19 stable support confirmed
- [Tailwind CSS v4 Release](https://tailwindcss.com/blog/tailwindcss-v4) — Stable Jan 22, 2025
- [shadcn/ui React 19 Support](https://ui.shadcn.com/docs/react-19) — Full compatibility announced
- [Drizzle ORM Documentation](https://orm.drizzle.team/) — Identity columns over serial types (2025 update)
- [TypeScript Releases](https://github.com/microsoft/typescript/releases) — Version 5.9.3 latest stable
- [Vitest Documentation](https://vitest.dev/) — 1.5M weekly downloads, 2026 status
- [Biome Migration Guide](https://biomejs.dev/guides/migrate-eslint-prettier/) — v2.3 with 423 rules
- [Clerk Next.js 15 Guide](https://clerk.com/articles/complete-authentication-guide-for-nextjs-app-router) — Jan 2026 updated
- [Inngest Documentation](https://www.inngest.com/docs) — Real-time updates feature (July 2025)
- [TanStack Query RSC Guide](https://tanstack.com/query/latest/docs/framework/react/guides/advanced-ssr) — 2026 patterns
- [Hono Cloudflare Workers Guide](https://developers.cloudflare.com/workers/framework-guides/web-apps/more-web-frameworks/hono/) — 2026 official guidance

### Medium Confidence (Community & Comparison Articles)
- [E2B Sandbox Benchmark 2026](https://www.superagent.sh/blog/ai-code-sandbox-benchmark-2026) — Cold start times ~90-150ms
- [Turborepo Monorepo Guide 2026](https://medium.com/@sanjaytomar717/the-ultimate-guide-to-building-a-monorepo-in-2025-sharing-code-like-the-pros-ee4d6d56abaa) — Best practices
- [Playwright vs Selenium 2026](https://dev.to/deepak_mishra_35863517037/playwright-vs-selenium-a-2026-architecture-review-347d) — Architecture comparison
- [Vitest vs Jest 30 (2026)](https://dev.to/dataformathub/vitest-vs-jest-30-why-2026-is-the-year-of-browser-native-testing-2fgb) — Testing framework comparison
- [Biome vs ESLint 2026](https://dev.to/pockit_tools/biome-the-eslint-and-prettier-killer-complete-migration-guide-for-2026-27m) — Migration guide

---
*Stack research for: Background Agent Platform with Sandboxed Execution*
*Researched: 2026-02-01*
*Next update recommended: When adopting TypeScript 7 (native Go-based) or when Next.js 16 reaches stable*
