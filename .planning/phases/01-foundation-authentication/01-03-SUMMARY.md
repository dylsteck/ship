---
phase: 01-foundation-authentication
plan: 03
subsystem: auth
tags: [github-oauth, arctic, jose, jwt, session-management, middleware]

# Dependency graph
requires:
  - phase: 01-01
    provides: Next.js web app with TypeScript configuration
  - phase: 01-02
    provides: User types and API upsert endpoint
provides:
  - GitHub OAuth flow with Arctic library
  - JWT session management with jose (encrypt/decrypt)
  - Data Access Layer (DAL) for secure session verification
  - proxy.ts for route protection (Next.js 16)
  - OAuth routes: /api/auth/github, /api/auth/github/callback, /api/auth/logout
affects: [ui, dashboard, settings, all-protected-routes]

# Tech tracking
tech-stack:
  added: [arctic@3.7.0, jose@6.1.3]
  patterns: [oauth-flow, jwt-session, dal-pattern, proxy-middleware]

key-files:
  created:
    - apps/web/lib/session.ts
    - apps/web/lib/dal.ts
    - apps/web/lib/github.ts
    - apps/web/app/api/auth/github/route.ts
    - apps/web/app/api/auth/github/callback/route.ts
    - apps/web/app/api/auth/logout/route.ts
    - apps/web/proxy.ts
    - apps/web/.env.example
  modified:
    - apps/web/package.json

key-decisions:
  - "Arctic for OAuth instead of manually handling OAuth flow"
  - "jose for JWT encryption instead of jsonwebtoken (Edge-compatible)"
  - "Data Access Layer pattern for security-critical session verification"
  - "proxy.ts (Next.js 16) instead of middleware.ts for route protection"
  - "7-day session expiry with httpOnly cookies"

patterns-established:
  - "DAL pattern: verifySession() must be called in Server Components for security"
  - "proxy.ts provides optimistic UX checks only - NOT security enforcement"
  - "OAuth state validation with httpOnly cookies"
  - "Session encryption with HS256 algorithm"
  - "Redirect to /onboarding for new users, /dashboard for returning users"

# Metrics
duration: 2min
completed: 2026-02-01
---

# Phase 01 Plan 03: GitHub OAuth with Arctic and JWT Sessions Summary

**GitHub OAuth flow with Arctic, jose JWT session encryption, Data Access Layer for security, and Next.js 16 proxy.ts route protection**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-01T23:01:10Z
- **Completed:** 2026-02-01T23:03:37Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments
- GitHub OAuth flow using Arctic library for edge-compatible auth
- JWT session management with jose (encrypt/decrypt, 7-day expiry)
- Data Access Layer (DAL) pattern for secure session verification in Server Components
- Next.js 16 proxy.ts for optimistic route protection (replaced middleware.ts)
- Complete OAuth flow: initiation, callback with state validation, and logout

## Task Commits

Each task was committed atomically:

1. **Task 1: Create session management with jose** - `57e854f` (feat)
2. **Task 2: Create GitHub OAuth routes and proxy** - `bf93ff5` (feat)

## Files Created/Modified
- `apps/web/lib/session.ts` - JWT session utilities (encrypt, decrypt, createSession, deleteSession, getSession)
- `apps/web/lib/dal.ts` - Data Access Layer with verifySession and getUser (security-critical)
- `apps/web/lib/github.ts` - Arctic GitHub OAuth client configuration
- `apps/web/app/api/auth/github/route.ts` - OAuth initiation with state generation
- `apps/web/app/api/auth/github/callback/route.ts` - OAuth callback handler with token exchange and user upsert
- `apps/web/app/api/auth/logout/route.ts` - Logout endpoint with session deletion
- `apps/web/proxy.ts` - Next.js 16 route protection (optimistic checks only)
- `apps/web/.env.example` - Environment variable template for OAuth and session config
- `apps/web/package.json` - Added arctic and jose dependencies

## Decisions Made

1. **Arctic for OAuth**: Lightweight, edge-compatible OAuth library instead of manually handling OAuth flow with state management and token exchange.

2. **jose for JWT**: Edge Runtime-compatible JWT library using Web Crypto API, avoiding Node.js-specific jsonwebtoken.

3. **Data Access Layer pattern**: Implemented DAL with React cache() and verifySession() for security-critical session checks in Server Components. This is the real security boundary, not proxy.ts.

4. **Next.js 16 proxy.ts**: Used proxy.ts instead of middleware.ts following Next.js 16 changes. Emphasizes optimistic UX checks only - DAL provides actual security.

5. **7-day session expiry**: Balanced security (not indefinite) with UX (doesn't require frequent re-auth).

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

**External services require manual configuration.**

Before GitHub OAuth can be used, the following setup is needed:

### GitHub OAuth App Configuration

1. Navigate to GitHub Settings → Developer settings → OAuth Apps
2. Click "New OAuth App"
3. Configure:
   - Application name: Ship (or your preferred name)
   - Homepage URL: http://localhost:3000 (for development)
   - Authorization callback URL: http://localhost:3000/api/auth/github/callback
4. After creation, copy Client ID and generate a Client secret

### Environment Variables

Create `apps/web/.env` from `apps/web/.env.example`:

```bash
GITHUB_CLIENT_ID=your_client_id_here
GITHUB_CLIENT_SECRET=your_client_secret_here
SESSION_SECRET=generate-a-random-32-character-string
API_BASE_URL=http://localhost:8787
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Verification

1. Start the dev server: `pnpm dev`
2. Navigate to http://localhost:3000/api/auth/github
3. Should redirect to GitHub OAuth authorization page
4. After authorization, redirects back to application with session cookie set

## Next Phase Readiness

**Ready for next phase:**
- Complete OAuth flow implemented and tested (TypeScript compilation passed)
- Session management with encryption established
- Route protection configured for protected pages
- DAL pattern ready for use in Server Components
- Authentication foundation complete

**Considerations for next phase:**
- Login/dashboard UI pages needed to complete user flow
- Session verification should be called via verifySession() in protected Server Components
- proxy.ts is optimistic only - DAL is security boundary

---
*Phase: 01-foundation-authentication*
*Completed: 2026-02-01*
