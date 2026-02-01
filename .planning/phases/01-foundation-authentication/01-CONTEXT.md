# Phase 1: Foundation & Authentication - Context

**Gathered:** 2026-02-01
**Status:** Ready for planning

<domain>
## Phase Boundary

User authentication with GitHub OAuth, persistent sessions, and infrastructure setup. This phase delivers: Turborepo monorepo scaffold, Cloudflare Worker with D1 schema, Next.js app with GitHub OAuth, and LLM key configuration via environment variables. Sessions, chat, and sandbox capabilities belong to later phases.

</domain>

<decisions>
## Implementation Decisions

### Monorepo structure
- Turborepo with 2 apps: `apps/web` (Next.js) and `apps/api` (Cloudflare Worker)
- Shared packages for UI components, types/schemas, and tooling config
- pnpm as package manager
- Documentation lives as raw markdown in repo, no separate docs app

### Auth flow & session behavior
- GitHub OAuth with onboarding flow after first login (welcome, brief setup — NOT key collection)
- After onboarding: straight to dashboard/session list
- Multiple devices/tabs all active simultaneously
- Claude's Discretion: session expiry policy (standard rolling expiry)
- Claude's Discretion: GitHub OAuth scopes (whatever's needed for repo access + user info)

### Landing/login experience
- Minimal login page: Ship logo + "Sign in with GitHub" button
- No marketing page — just the login
- Match Ramp Inspect aesthetic exactly but branded as "Ship"
- Light mode default with dark mode toggle (both supported)
- System preference detection + manual toggle

### LLM key configuration
- Environment variables only (CF Worker env vars), not user-facing settings
- Anthropic only for v1 — keys go through OpenCode SDK
- No key collection in onboarding or settings page
- Multi-model support deferred (AGNT-03 is Phase 3)

### Claude's Discretion
- Exact onboarding steps/screens
- D1 schema design for users and sessions
- GitHub OAuth library choice
- Shared package boundaries and naming

</decisions>

<specifics>
## Specific Ideas

- "Match Ramp Inspect exactly" — reference the Ramp Inspect UI screenshots for layout, typography, color palette
- Login page should be dead simple — logo, one button, done
- Light mode is the default (unlike most dev tools which default dark)

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-foundation-authentication*
*Context gathered: 2026-02-01*
