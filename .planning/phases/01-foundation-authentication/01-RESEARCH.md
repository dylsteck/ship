# Phase 1: Foundation & Authentication - Research

**Researched:** 2026-02-01
**Domain:** Monorepo architecture, Next.js authentication, Cloudflare Workers infrastructure
**Confidence:** HIGH

## Summary

Phase 1 establishes the foundational architecture for Ship, a GitHub-integrated AI coding agent platform. The research reveals a mature ecosystem with well-established patterns for the chosen stack (Turborepo + pnpm, Next.js 15 + React 19, Cloudflare Workers + D1).

Key findings confirm that the user's stack decisions align with current 2026 best practices. However, critical security considerations emerged: CVE-2025-29927 demonstrates that Next.js middleware alone cannot secure authentication, requiring a defense-in-depth Data Access Layer pattern. For password hashing, Argon2id has superseded bcrypt as the 2026 standard. The Auth.js D1 adapter provides a battle-tested schema, eliminating the need for custom authentication infrastructure.

The project currently uses a single Next.js app with Drizzle ORM connected to Neon/Postgres. Phase 1 will transition to the planned Turborepo monorepo structure with Cloudflare Workers backend and D1 database, establishing the foundation for the multi-phase architecture.

**Primary recommendation:** Use Arctic (from Lucia Auth) for GitHub OAuth with Auth.js D1 adapter schema, implement Data Access Layer pattern with React.cache() for session verification, and use next-themes for theme management. Deploy Next.js via OpenNext Cloudflare adapter for seamless Workers integration.

## Standard Stack

The established libraries/tools for this domain:

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Turborepo | Latest | Monorepo orchestration | Official Vercel tool, optimized for Next.js, intelligent caching, parallel task execution |
| pnpm | 9.0+ | Package manager | Fastest installs, disk-efficient, workspace-native, pairs perfectly with Turborepo |
| Next.js | 15.2.3+ | Frontend framework | Latest stable with React 19 support, CRITICAL: 15.2.3+ required for CVE-2025-29927 security patch |
| React | 19.2.1 | UI library | Current stable with Server Actions, useActionState, and improved form handling |
| Cloudflare Workers | Latest | Backend runtime | Serverless edge compute, global distribution, tight D1 integration |
| D1 | Latest | Database | Cloudflare's managed SQLite, built-in replication, Worker-native access |
| shadcn/ui | Latest | Component library | Tailwind v4 compatible, React 19 ready, copy-paste components, flexible styling |
| Tailwind CSS | 4.1.18+ | Styling | CSS-first configuration (no tailwind.config.js), OKLCH colors, @theme directive |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Arctic | 3.7.0+ | OAuth client | GitHub OAuth flow - lightweight, 50+ providers, Next.js App Router optimized |
| @auth/d1-adapter | Latest | Auth database adapter | Automatic schema setup (users, sessions, accounts, verification_tokens) |
| jose | 6.1.3+ | JWT encryption | Stateless session cookies - lightweight, edge-compatible, secure token handling |
| Zod | 4.3.6+ | Schema validation | Form validation - type-safe, server action integration, error formatting |
| Drizzle ORM | 0.36.4+ | Database ORM | D1 schema management and type-safe queries |
| next-themes | 0.4.6+ | Theme management | Dark/light mode with system preference detection, zero-flash solution |
| Argon2 | Latest | Password hashing | Modern memory-hard hashing (if storing passwords) - 2026 standard over bcrypt |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Arctic | NextAuth.js v5 | NextAuth provides full-featured auth but Arctic is lighter for OAuth-only use cases |
| D1 | Neon Postgres | Postgres offers more features but D1 is Workers-native and zero-config replication |
| Turborepo | Nx | Nx has more features (generators, graph viz) but Turborepo is simpler and faster for basic monorepos |
| OpenNext | Next on Pages | OpenNext Cloudflare adapter is now the official recommended approach as of late 2025 |
| Argon2 | bcrypt | bcrypt is battle-tested but vulnerable to GPU attacks; Argon2 is memory-hard and 2026 standard |

**Installation:**

```bash
# Root workspace
pnpm init
pnpm add -Dw turbo prettier eslint typescript

# Apps (created separately)
pnpm create next-app@latest apps/web
npm create cloudflare@latest apps/api -- --framework=hono

# Shared packages
pnpm add arctic zod @auth/d1-adapter jose
pnpm add -D drizzle-kit
```

## Architecture Patterns

### Recommended Project Structure

```
ship/
├── apps/
│   ├── web/                    # Next.js 15 frontend
│   │   ├── app/                # App Router pages
│   │   │   ├── (auth)/        # Auth route group
│   │   │   │   ├── login/
│   │   │   │   └── onboarding/
│   │   │   ├── (app)/         # Protected routes group
│   │   │   │   ├── dashboard/
│   │   │   │   └── settings/
│   │   │   ├── api/           # Route handlers
│   │   │   │   └── auth/
│   │   │   │       ├── github/
│   │   │   │       │   ├── route.ts      # Initiate OAuth
│   │   │   │       │   └── callback/
│   │   │   │       │       └── route.ts  # OAuth callback
│   │   │   │       └── logout/
│   │   │   │           └── route.ts
│   │   │   └── actions/       # Server Actions
│   │   │       └── auth.ts
│   │   ├── lib/               # Client/server utilities
│   │   │   ├── dal.ts         # Data Access Layer (session verification)
│   │   │   ├── session.ts     # Session management (cookie CRUD)
│   │   │   └── github.ts      # Arctic GitHub client
│   │   ├── components/
│   │   │   └── providers/
│   │   │       └── theme-provider.tsx
│   │   └── middleware.ts      # Optimistic auth checks only
│   │
│   └── api/                   # Cloudflare Worker
│       ├── src/
│       │   ├── index.ts       # Hono app entry
│       │   ├── routes/
│       │   │   └── health.ts
│       │   └── db/
│       │       ├── schema.ts   # D1 schema
│       │       └── migrations/
│       └── wrangler.toml      # Cloudflare config
│
├── packages/
│   ├── ui/                    # Shared UI components (shadcn/ui)
│   │   ├── src/
│   │   │   ├── button.tsx
│   │   │   └── dialog.tsx
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── types/                 # Shared TypeScript types
│   │   ├── src/
│   │   │   ├── auth.ts
│   │   │   └── session.ts
│   │   └── package.json
│   │
│   └── config/                # Shared tooling config
│       ├── eslint/
│       ├── typescript/
│       │   ├── base.json      # Shared tsconfig
│       │   ├── nextjs.json
│       │   └── worker.json
│       └── tailwind/
│
├── turbo.json                 # Task pipeline
├── pnpm-workspace.yaml        # Workspace definition
├── package.json               # Root workspace
└── tsconfig.base.json         # Base TypeScript config
```

### Pattern 1: Data Access Layer (DAL) - Critical Security Pattern

**What:** Centralized authentication verification layer using React's `cache()` API
**When to use:** Every data access in Server Components, Route Handlers, and Server Actions
**Why critical:** CVE-2025-29927 proved middleware alone is insufficient - authentication must be verified at every data access point

**Example:**

```typescript
// Source: https://nextjs.org/docs/app/guides/authentication
// lib/dal.ts
import { cache } from 'react'
import { cookies } from 'next/headers'
import { decrypt } from '@/lib/session'
import { redirect } from 'next/navigation'

export const verifySession = cache(async () => {
  const cookie = (await cookies()).get('session')?.value
  const session = await decrypt(cookie)

  if (!session?.userId) {
    redirect('/login')
  }

  return { isAuth: true, userId: session.userId }
})

export const getUser = cache(async () => {
  const session = await verifySession()

  // Query D1 via Cloudflare API or fetch from api worker
  const response = await fetch(`${process.env.API_BASE_URL}/users/${session.userId}`)
  const user = await response.json()

  return user
})
```

**Usage in Server Components:**

```typescript
// app/(app)/dashboard/page.tsx
import { verifySession, getUser } from '@/lib/dal'

export default async function DashboardPage() {
  const session = await verifySession() // Blocks if unauthorized
  const user = await getUser()

  return <div>Welcome, {user.name}</div>
}
```

**Usage in Server Actions:**

```typescript
// app/actions/session.ts
'use server'
import { verifySession } from '@/lib/dal'

export async function createSession(formData: FormData) {
  await verifySession() // Verify auth before mutation

  // Create session logic
}
```

### Pattern 2: GitHub OAuth with Arctic

**What:** OAuth 2.0 flow using Arctic's GitHub provider
**When to use:** User authentication with GitHub identity
**Why Arctic:** Lightweight (vs NextAuth), supports Next.js App Router, handles PKCE automatically

**Example:**

```typescript
// Source: https://lucia-auth.com/tutorials/github-oauth/nextjs
// lib/github.ts
import { GitHub } from 'arctic'

export const github = new GitHub(
  process.env.GITHUB_CLIENT_ID!,
  process.env.GITHUB_CLIENT_SECRET!,
  `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/github/callback`
)

// app/api/auth/github/route.ts
import { github } from '@/lib/github'
import { generateState } from 'arctic'
import { cookies } from 'next/headers'

export async function GET() {
  const state = generateState()
  const url = github.createAuthorizationURL(state, ['user:email', 'read:user'])

  const cookieStore = await cookies()
  cookieStore.set('github_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 10, // 10 minutes
    path: '/',
    sameSite: 'lax'
  })

  return Response.redirect(url)
}

// app/api/auth/github/callback/route.ts
import { github } from '@/lib/github'
import { cookies } from 'next/headers'
import { createSession } from '@/lib/session'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')

  const cookieStore = await cookies()
  const storedState = cookieStore.get('github_oauth_state')?.value

  if (!code || !state || !storedState || state !== storedState) {
    return new Response('Invalid state', { status: 400 })
  }

  try {
    const tokens = await github.validateAuthorizationCode(code)
    const githubUser = await fetch('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${tokens.accessToken()}` }
    }).then(res => res.json())

    // Store user in D1 (via API worker or direct)
    const response = await fetch(`${process.env.API_BASE_URL}/auth/github`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        githubId: githubUser.id,
        username: githubUser.login,
        email: githubUser.email,
        avatarUrl: githubUser.avatar_url
      })
    })

    const { userId } = await response.json()

    // Create session cookie
    await createSession(userId)

    return Response.redirect('/onboarding')
  } catch (e) {
    return new Response('Failed to authenticate', { status: 500 })
  }
}
```

### Pattern 3: Stateless Session Management with jose

**What:** Encrypted JWT cookies for session data
**When to use:** Simple session needs without database lookups on every request
**Why jose:** Edge-compatible, lightweight, standard JWT operations

**Example:**

```typescript
// Source: https://nextjs.org/docs/app/guides/authentication
// lib/session.ts
import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'

const secretKey = process.env.SESSION_SECRET!
const encodedKey = new TextEncoder().encode(secretKey)

export async function encrypt(payload: { userId: string; expiresAt: Date }) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(encodedKey)
}

export async function decrypt(session: string | undefined = '') {
  try {
    const { payload } = await jwtVerify(session, encodedKey, {
      algorithms: ['HS256'],
    })
    return payload
  } catch (error) {
    return null
  }
}

export async function createSession(userId: string) {
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
  const session = await encrypt({ userId, expiresAt })

  const cookieStore = await cookies()
  cookieStore.set('session', session, {
    httpOnly: true,
    secure: true,
    expires: expiresAt,
    sameSite: 'lax',
    path: '/',
  })
}

export async function deleteSession() {
  const cookieStore = await cookies()
  cookieStore.delete('session')
}
```

### Pattern 4: Middleware for Optimistic Checks Only

**What:** Route protection at the edge using middleware
**When to use:** Fast route redirects before page render
**Why limited:** CVE-2025-29927 showed middleware can be bypassed - use only for UX, not security

**Example:**

```typescript
// Source: https://nextjs.org/docs/app/guides/authentication
// middleware.ts
import { NextRequest, NextResponse } from 'next/server'
import { decrypt } from '@/lib/session'

const protectedRoutes = ['/dashboard', '/settings', '/sessions']
const publicRoutes = ['/login', '/']

export default async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname
  const isProtectedRoute = protectedRoutes.some(route => path.startsWith(route))
  const isPublicRoute = publicRoutes.includes(path)

  const cookie = req.cookies.get('session')?.value
  const session = await decrypt(cookie)

  // Redirect unauthorized users from protected routes
  if (isProtectedRoute && !session?.userId) {
    return NextResponse.redirect(new URL('/login', req.nextUrl))
  }

  // Redirect authenticated users from login page
  if (isPublicRoute && path === '/login' && session?.userId) {
    return NextResponse.redirect(new URL('/dashboard', req.nextUrl))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}
```

**CRITICAL NOTE:** This middleware performs optimistic checks for UX. Security verification MUST happen in the DAL layer for every data access.

### Pattern 5: Theme Management with next-themes

**What:** Dark/light mode with system preference detection
**When to use:** Always - provides seamless theme switching with no flash
**Why next-themes:** Zero-flash solution, localStorage persistence, system preference detection

**Example:**

```typescript
// Source: https://github.com/pacocoursey/next-themes
// components/providers/theme-provider.tsx
'use client'

import { ThemeProvider as NextThemesProvider } from 'next-themes'

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  )
}

// app/layout.tsx
import { ThemeProvider } from '@/components/providers/theme-provider'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}

// components/theme-toggle.tsx
'use client'

import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'

export function ThemeToggle() {
  const [mounted, setMounted] = useState(false)
  const { theme, setTheme } = useTheme()

  useEffect(() => setMounted(true), [])

  if (!mounted) return null

  return (
    <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
      Toggle theme
    </button>
  )
}
```

### Pattern 6: D1 Database Schema with Auth.js Adapter

**What:** Standard authentication schema using Auth.js D1 adapter
**When to use:** Always - provides battle-tested schema for users, sessions, accounts
**Why Auth.js schema:** Proven design, handles OAuth accounts, built-in session management

**Example:**

```typescript
// Source: https://authjs.dev/getting-started/adapters/d1
// apps/api/src/db/schema.ts
export const up = (db: D1Database) => {
  // Auth.js standard schema
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT,
      email TEXT UNIQUE,
      emailVerified INTEGER,
      image TEXT,
      createdAt INTEGER NOT NULL DEFAULT (unixepoch()),
      updatedAt INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      expires INTEGER NOT NULL,
      sessionToken TEXT UNIQUE NOT NULL,
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      type TEXT NOT NULL,
      provider TEXT NOT NULL,
      providerAccountId TEXT NOT NULL,
      refresh_token TEXT,
      access_token TEXT,
      expires_at INTEGER,
      token_type TEXT,
      scope TEXT,
      id_token TEXT,
      session_state TEXT,
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS verification_tokens (
      identifier TEXT NOT NULL,
      token TEXT NOT NULL,
      expires INTEGER NOT NULL,
      PRIMARY KEY (identifier, token)
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_userId ON sessions(userId);
    CREATE INDEX IF NOT EXISTS idx_accounts_userId ON accounts(userId);
  `)
}
```

### Pattern 7: Turborepo Shared Packages

**What:** Internal packages for shared code using workspace protocol
**When to use:** Code used by multiple apps (UI components, types, configs)
**Why this approach:** Zero-config builds, TypeScript project references, hot reload in dev

**Example:**

```json
// Source: https://turbo.build/repo/docs/handbook/linting/typescript
// packages/ui/package.json
{
  "name": "@ship/ui",
  "version": "0.0.0",
  "private": true,
  "exports": {
    "./button": "./src/button.tsx",
    "./dialog": "./src/dialog.tsx"
  },
  "scripts": {
    "lint": "eslint ."
  },
  "peerDependencies": {
    "react": "^19.0.0"
  },
  "devDependencies": {
    "@types/react": "^19.2.9",
    "typescript": "^5.9.3"
  }
}

// apps/web/package.json
{
  "name": "web",
  "dependencies": {
    "@ship/ui": "workspace:*",
    "@ship/types": "workspace:*"
  }
}

// Usage in apps/web
import { Button } from '@ship/ui/button'
import { User } from '@ship/types/auth'
```

### Pattern 8: Form Validation with Zod and Server Actions

**What:** Type-safe form validation with Zod schemas shared between client and server
**When to use:** All forms with server-side mutations
**Why Zod:** Type inference, runtime validation, excellent DX with Server Actions

**Example:**

```typescript
// Source: https://www.freecodecamp.org/news/handling-forms-nextjs-server-actions-zod/
// lib/schemas.ts (shared between client/server)
import { z } from 'zod'

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

export type LoginInput = z.infer<typeof loginSchema>

// app/actions/auth.ts
'use server'
import { loginSchema } from '@/lib/schemas'
import { verifySession } from '@/lib/dal'

export async function login(prevState: any, formData: FormData) {
  const parsed = loginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  })

  if (!parsed.success) {
    return {
      errors: parsed.error.flatten().fieldErrors,
      message: 'Invalid input'
    }
  }

  // Authenticate user
  // ...

  return { success: true }
}

// app/(auth)/login/form.tsx
'use client'
import { useActionState } from 'react'
import { login } from '@/app/actions/auth'

export function LoginForm() {
  const [state, formAction] = useActionState(login, null)

  return (
    <form action={formAction}>
      <input name="email" type="email" required />
      {state?.errors?.email && <p>{state.errors.email[0]}</p>}

      <input name="password" type="password" required />
      {state?.errors?.password && <p>{state.errors.password[0]}</p>}

      <button type="submit">Sign in</button>
    </form>
  )
}
```

### Anti-Patterns to Avoid

- **Middleware-only authentication:** CVE-2025-29927 proved this is bypassable. Always use DAL pattern with verification at every data access.
- **Client-side session validation:** Never rely on client checks for security. Server Components and Server Actions must verify sessions.
- **Storing secrets in vars:** Use Cloudflare secrets (wrangler secret put) or Secrets Store, never environment variables in wrangler.toml
- **TypeScript project references in Turborepo:** Adds complexity and duplicate caching. Use flat tsconfig extends instead.
- **Global Radix UI imports:** Import components individually from @radix-ui/react-* for better tree-shaking
- **Returning full user objects:** Use DTOs (Data Transfer Objects) to avoid leaking sensitive fields like hashed passwords
- **Using bcrypt for new projects:** Argon2id is the 2026 standard - memory-hard and GPU-resistant

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| OAuth 2.0 flow | Custom GitHub OAuth implementation | Arctic | Handles PKCE, state validation, token refresh, 50+ providers, edge-compatible |
| Session encryption | Custom JWT signing | jose | Standard-compliant, edge-compatible, battle-tested cryptography |
| Auth database schema | Custom users/sessions tables | Auth.js D1 adapter schema | Handles OAuth accounts, email verification, session expiry, proven design |
| Password hashing | bcrypt or custom solution | Argon2id | Memory-hard (GPU-resistant), configurable work factors, 2026 standard |
| Form validation | Manual validation logic | Zod with Server Actions | Type-safe, shared schemas, excellent DX, runtime safety |
| Dark mode | Custom localStorage + CSS | next-themes | Zero-flash, system preference, SSR-safe, localStorage sync |
| Theme system | Custom CSS variables | Tailwind v4 @theme | CSS-first config, OKLCH colors, design tokens, utility generation |
| Monorepo tasks | Custom scripts | Turborepo | Intelligent caching, parallel execution, incremental builds, simple config |
| Session management | Manual cookie handling | Cookie abstraction with jose + Next.js cookies() API | Secure defaults, HttpOnly/Secure/SameSite flags, expiry handling |
| Database migrations | Manual SQL scripts | Drizzle Kit | Type-safe migrations, automatic generation, rollback support |

**Key insight:** Authentication and session management are security-critical with countless edge cases (CSRF, session fixation, timing attacks, cookie security). Use battle-tested libraries that handle these correctly rather than implementing custom solutions that may have vulnerabilities.

## Common Pitfalls

### Pitfall 1: Trusting Middleware for Security

**What goes wrong:** Developers protect routes with middleware only, assuming it's sufficient for security. CVE-2025-29927 demonstrated complete bypass via x-middleware-subrequest header manipulation.

**Why it happens:** Middleware appears to work correctly during development and testing. The vulnerability only manifests when attackers craft specific headers.

**How to avoid:** Implement the Data Access Layer (DAL) pattern with verification at every data access point:
- Server Components: Call `verifySession()` before rendering data
- Server Actions: Call `verifySession()` before mutations
- Route Handlers: Call `verifySession()` before API operations
- Middleware: Use only for optimistic UX redirects, never for security

**Warning signs:**
- Protected pages render without calling `verifySession()`
- Server Actions perform mutations without auth checks
- Route handlers trust the request without session validation
- No DAL layer in codebase

**Code smell:**
```typescript
// BAD: Only middleware protection
export default async function DashboardPage() {
  const data = await fetchData() // No auth check!
  return <Dashboard data={data} />
}

// GOOD: DAL verification
export default async function DashboardPage() {
  await verifySession() // Blocks if unauthorized
  const data = await fetchData()
  return <Dashboard data={data} />
}
```

### Pitfall 2: GitHub OAuth Scope Confusion

**What goes wrong:** Requesting `repo` scope for "read access" to repositories, which actually grants full write access. Users see excessive permissions and abandon signup.

**Why it happens:** GitHub has no read-only scope for private repositories. The `repo` scope grants both read AND write access to all repos.

**How to avoid:**
- For public repos only: Use no scope or `public_repo`
- For private repo access: Must use `repo` scope (explain to users why)
- For user info only: Use `read:user` and `user:email`
- Consider GitHub Apps for fine-grained permissions (longer setup)

**Recommendation for Ship:**
```typescript
// Minimal scopes for Phase 1 (authentication only)
const scopes = ['read:user', 'user:email']

// Phase 3 scopes (when Git operations needed)
const scopes = ['read:user', 'user:email', 'repo']
// Document why 'repo' is required in UI
```

**Warning signs:**
- Users complain about excessive permissions
- OAuth scope includes `admin:*` permissions unnecessarily
- Requesting scopes not currently used by the app

### Pitfall 3: Cloudflare Environment Variable Confusion

**What goes wrong:** Storing secrets in `wrangler.toml` under `[vars]`, which exposes them in git and dashboard. Or using `.env` in production instead of Cloudflare secrets.

**Why it happens:** Documentation mentions "environment variables" without clearly distinguishing vars (public config) from secrets (encrypted values).

**How to avoid:**
- **Public config** → `[vars]` in wrangler.toml (API URLs, feature flags)
- **Secrets** → `wrangler secret put <KEY>` (API keys, encryption keys)
- **Local dev** → `.dev.vars` file (gitignored)
- **Account-level secrets** → Cloudflare Secrets Store (shared across Workers)

**Setup:**
```bash
# Add secret (production)
wrangler secret put GITHUB_CLIENT_SECRET

# Add secret to specific environment
wrangler secret put ANTHROPIC_API_KEY --env production

# Local development
echo "GITHUB_CLIENT_SECRET=dev_secret" >> .dev.vars
```

**Warning signs:**
- Secrets visible in wrangler.toml
- Secrets committed to git repository
- Local development breaks without .dev.vars
- Production uses environment variables instead of secrets

### Pitfall 4: Session Expiry Strategy Confusion

**What goes wrong:** Using absolute expiry (session dies after 7 days) instead of rolling expiry (extends on activity), forcing active users to re-login.

**Why it happens:** Simpler to implement absolute expiry. Rolling expiry requires updating session on each request.

**How to avoid:**
- **Idle timeout:** Session expires after inactivity (e.g., 15 minutes)
- **Absolute timeout:** Session force-expires after max duration (e.g., 7 days)
- **Rolling window:** Extend expiry on each request (update cookie)
- **Hybrid approach:** Roll expiry but respect absolute maximum

**Implementation:**
```typescript
// Rolling expiry with absolute maximum
export async function extendSession() {
  const cookie = (await cookies()).get('session')?.value
  const session = await decrypt(cookie)

  if (!session?.userId) return

  const now = new Date()
  const createdAt = new Date(session.createdAt)
  const absoluteMaxAge = 7 * 24 * 60 * 60 * 1000 // 7 days

  // Check absolute maximum
  if (now.getTime() - createdAt.getTime() > absoluteMaxAge) {
    await deleteSession()
    return
  }

  // Roll expiry for 7 more days
  const expiresAt = new Date(now.getTime() + absoluteMaxAge)
  await createSession(session.userId, createdAt)
}
```

**Recommendation:**
- Idle timeout: 30 minutes (balance security and UX)
- Absolute timeout: 7 days (standard for web apps)
- Extend expiry on each request in middleware

**Warning signs:**
- Users complain about frequent re-logins
- Session expires during active use
- No mechanism to extend session expiry
- Security-sensitive app uses 30-day sessions

### Pitfall 5: Turborepo Nested Workspace Confusion

**What goes wrong:** Creating nested workspaces like `packages/auth/**` in pnpm-workspace.yaml, which Turborepo doesn't support well.

**Why it happens:** Developers familiar with other monorepo tools assume nested globs work everywhere.

**How to avoid:**
- Use flat globs: `packages/*` not `packages/**`
- Group packages in subdirectories: `packages/shared/ui`, `packages/shared/types`
- Update workspace config: `["apps/*", "packages/shared/*"]`
- Avoid nested package.json files without workspaces

**Setup:**
```yaml
# pnpm-workspace.yaml
packages:
  - 'apps/*'
  - 'packages/*'
  - 'packages/shared/*'  # If grouping packages
```

**Warning signs:**
- Turborepo not detecting packages
- pnpm install errors about workspace packages
- Nested package.json files outside workspaces
- Symlinks not created for workspace dependencies

### Pitfall 6: Tailwind v4 Migration Breaking Changes

**What goes wrong:** Upgrading to Tailwind v4 without understanding CSS-first configuration, causing builds to fail or styles to break.

**Why it happens:** Tailwind v4 removed `tailwind.config.js` in favor of `@theme` directive in CSS. Old patterns no longer work.

**How to avoid:**
- Use `@tailwindcss/postcss` instead of `tailwindcss` package
- Define theme in CSS using `@theme` directive
- Convert HSL colors to OKLCH format
- Remove `tailwind.config.js` completely
- Use `@tailwindcss/upgrade@next` codemod for migration

**New approach:**
```css
/* app/globals.css */
@import "tailwindcss";

@theme {
  --color-primary: oklch(0.5 0.2 250);
  --color-secondary: oklch(0.7 0.1 200);
}
```

**Warning signs:**
- Build errors about missing tailwind.config.js
- Utilities not generated correctly
- Color system broken after v4 upgrade
- PostCSS config references old tailwindcss package

### Pitfall 7: Next.js 16 on Cloudflare Premature Adoption

**What goes wrong:** Using Next.js 16 with Cloudflare Workers when OpenNext adapter only supports Next.js 14 and 15 (16 support coming Q1 2026).

**Why it happens:** Next.js 16 is released but ecosystem adapters lag behind framework releases.

**How to avoid:**
- Check [OpenNext Cloudflare compatibility](https://opennext.js.org/cloudflare) before upgrading
- Current support (Feb 2026): Next.js 14.x (dropping Q1 2026) and 15.x
- Next.js 16 support: Coming Q1 2026
- Pin Next.js version in package.json: `"next": "^15.2.3"`

**For Ship:** Use Next.js 15.2.3+ (security patch) for Phase 1. Evaluate Next.js 16 upgrade after OpenNext adapter support lands.

**Warning signs:**
- Build failures with OpenNext adapter after Next.js upgrade
- Missing features in Cloudflare deployment
- Edge runtime errors in production
- Documentation references features not in your Next.js version

## Code Examples

Verified patterns from official sources:

### GitHub OAuth Complete Flow

```typescript
// Source: https://lucia-auth.com/tutorials/github-oauth/nextjs + Arctic docs
// lib/github.ts
import { GitHub } from 'arctic'

export const github = new GitHub(
  process.env.GITHUB_CLIENT_ID!,
  process.env.GITHUB_CLIENT_SECRET!,
  `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/github/callback`
)

// app/api/auth/github/route.ts
import { github } from '@/lib/github'
import { generateState } from 'arctic'
import { cookies } from 'next/headers'

export async function GET() {
  const state = generateState()

  // Minimal scopes for Phase 1 (user info only)
  const scopes = ['read:user', 'user:email']
  const url = github.createAuthorizationURL(state, scopes)

  const cookieStore = await cookies()
  cookieStore.set('github_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 10, // 10 minutes
    path: '/',
    sameSite: 'lax'
  })

  return Response.redirect(url)
}

// app/api/auth/github/callback/route.ts
import { github } from '@/lib/github'
import { cookies } from 'next/headers'
import { createSession } from '@/lib/session'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')

  const cookieStore = await cookies()
  const storedState = cookieStore.get('github_oauth_state')?.value

  // Validate OAuth state
  if (!code || !state || !storedState || state !== storedState) {
    return new Response('Invalid state', { status: 400 })
  }

  try {
    // Exchange code for access token
    const tokens = await github.validateAuthorizationCode(code)

    // Fetch GitHub user
    const githubUser = await fetch('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${tokens.accessToken()}` }
    }).then(res => res.json())

    // Fetch primary email (if not public)
    let email = githubUser.email
    if (!email) {
      const emails = await fetch('https://api.github.com/user/emails', {
        headers: { Authorization: `Bearer ${tokens.accessToken()}` }
      }).then(res => res.json())
      email = emails.find((e: any) => e.primary)?.email
    }

    // Store/update user in database
    const response = await fetch(`${process.env.API_BASE_URL}/users/upsert`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        githubId: String(githubUser.id),
        username: githubUser.login,
        email,
        name: githubUser.name,
        avatarUrl: githubUser.avatar_url,
      })
    })

    if (!response.ok) {
      throw new Error('Failed to create user')
    }

    const { userId, isNewUser } = await response.json()

    // Create encrypted session
    await createSession(userId)

    // Redirect to onboarding for new users, dashboard for returning
    const redirectUrl = isNewUser ? '/onboarding' : '/dashboard'
    return Response.redirect(new URL(redirectUrl, request.url))

  } catch (e) {
    console.error('GitHub OAuth error:', e)
    return Response.redirect(new URL('/login?error=auth_failed', request.url))
  }
}
```

### Data Access Layer with React.cache()

```typescript
// Source: https://nextjs.org/docs/app/guides/authentication
// lib/dal.ts
import { cache } from 'react'
import { cookies } from 'next/headers'
import { decrypt } from '@/lib/session'
import { redirect } from 'next/navigation'

// Cached session verification (deduped per request)
export const verifySession = cache(async () => {
  const cookie = (await cookies()).get('session')?.value
  const session = await decrypt(cookie)

  if (!session?.userId) {
    redirect('/login')
  }

  return { isAuth: true, userId: session.userId as string }
})

// Cached user fetch (deduped per request)
export const getUser = cache(async () => {
  const session = await verifySession()

  try {
    // Fetch from Cloudflare Worker API
    const response = await fetch(`${process.env.API_BASE_URL}/users/${session.userId}`, {
      headers: {
        'Authorization': `Bearer ${process.env.API_SECRET}` // Worker-to-Worker auth
      }
    })

    if (!response.ok) {
      throw new Error('Failed to fetch user')
    }

    const user = await response.json()

    // Return DTO (Data Transfer Object) - no sensitive fields
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      avatarUrl: user.avatarUrl,
      username: user.username,
    }
  } catch (error) {
    console.error('Failed to fetch user:', error)
    redirect('/login')
  }
})
```

### D1 Database Queries with Sessions

```typescript
// Source: https://developers.cloudflare.com/d1/worker-api/d1-database/
// apps/api/src/routes/users.ts
import { Hono } from 'hono'

const app = new Hono<{ Bindings: Env }>()

// Upsert user after GitHub OAuth
app.post('/upsert', async (c) => {
  const { githubId, username, email, name, avatarUrl } = await c.req.json()

  // Use withSession for sequential consistency
  const session = c.env.DB.withSession({ strategy: 'first-primary' })

  try {
    // Check if user exists
    const existing = await session
      .prepare('SELECT id FROM users WHERE githubId = ?')
      .bind(githubId)
      .first()

    if (existing) {
      // Update existing user
      await session
        .prepare(`
          UPDATE users
          SET username = ?, email = ?, name = ?, avatarUrl = ?, updatedAt = unixepoch()
          WHERE githubId = ?
        `)
        .bind(username, email, name, avatarUrl, githubId)
        .run()

      return c.json({ userId: existing.id, isNewUser: false })
    } else {
      // Create new user
      const userId = crypto.randomUUID()
      await session
        .prepare(`
          INSERT INTO users (id, githubId, username, email, name, avatarUrl)
          VALUES (?, ?, ?, ?, ?, ?)
        `)
        .bind(userId, githubId, username, email, name, avatarUrl)
        .run()

      return c.json({ userId, isNewUser: true })
    }
  } catch (error) {
    console.error('Database error:', error)
    return c.json({ error: 'Failed to create user' }, 500)
  }
})

// Get user by ID
app.get('/:id', async (c) => {
  const userId = c.req.param('id')

  const user = await c.env.DB
    .prepare('SELECT id, username, email, name, avatarUrl FROM users WHERE id = ?')
    .bind(userId)
    .first()

  if (!user) {
    return c.json({ error: 'User not found' }, 404)
  }

  return c.json(user)
})

export default app
```

### Turborepo Configuration

```json
// Source: https://turbo.build/repo/docs
// turbo.json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "!.next/cache/**", "dist/**"]
    },
    "lint": {
      "dependsOn": ["^build"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "type-check": {
      "dependsOn": ["^build"]
    }
  }
}
```

```yaml
# Source: https://pnpm.io/workspaces
# pnpm-workspace.yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

```json
// Source: Turborepo best practices
// package.json (root)
{
  "name": "ship",
  "version": "2.0.0",
  "private": true,
  "packageManager": "pnpm@9.0.0",
  "scripts": {
    "dev": "turbo dev",
    "build": "turbo build",
    "lint": "turbo lint",
    "type-check": "turbo type-check"
  },
  "devDependencies": {
    "turbo": "^2.3.0",
    "prettier": "^3.8.1",
    "typescript": "^5.9.3"
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| NextAuth.js v4 | Auth.js v5 / Arctic | Late 2024 | Lighter OAuth libs for simple use cases, Auth.js for complex flows |
| Tailwind config.js | CSS @theme directive | Tailwind v4 (2024) | CSS-first configuration, OKLCH colors, no config file |
| bcrypt | Argon2id | 2023-2025 | Memory-hard hashing resistant to GPU attacks |
| Middleware-only auth | DAL pattern | Post CVE-2025-29927 | Defense-in-depth: middleware + verification at every data access |
| Next on Pages | OpenNext Cloudflare adapter | Late 2025 | Official recommended approach, better feature support |
| React 18 | React 19 | 2025 | Server Actions, useActionState, form enhancements |
| useFormState | useActionState | React 19 | Cleaner API for server action state |
| HSL colors | OKLCH colors | Tailwind v4 | Better perceptual uniformity, wider color gamut |
| TypeScript project references | Flat tsconfig extends | Turborepo best practices | Simpler config, single caching layer |
| Environment variables for secrets | Cloudflare Secrets / Secrets Store | Ongoing | Encrypted at rest, not visible in dashboard |

**Deprecated/outdated:**
- **Next.js Pages Router:** App Router is the standard for new projects (2023+)
- **NextAuth.js v4:** v5 (Auth.js) is the current version with App Router support
- **Tailwind v3 config.js:** v4 uses CSS @theme directive
- **bcrypt for new projects:** Argon2id is 2026 standard for memory-hard hashing
- **Middleware as sole auth layer:** CVE-2025-29927 proved this insufficient
- **`repo` scope for read-only:** GitHub has no read-only private repo scope (use GitHub Apps for fine-grained)

## Open Questions

Things that couldn't be fully resolved:

1. **Next.js to Cloudflare Worker Communication Pattern**
   - What we know: OpenNext adapter handles Next.js → Workers deployment
   - What's unclear: Best pattern for Next.js DAL → Cloudflare Worker API calls (service bindings vs HTTP)
   - Recommendation: Start with HTTP fetch to Worker API (simpler), evaluate service bindings in Phase 2 if latency is an issue

2. **D1 Connection from Next.js Server Components**
   - What we know: D1 is Workers-native, requires Cloudflare context
   - What's unclear: Can Next.js (via OpenNext) access D1 bindings directly, or must proxy through Worker API?
   - Recommendation: Proxy through Worker API for Phase 1 (clear separation), investigate direct bindings in Phase 2

3. **Session Storage Strategy: D1 vs KV**
   - What we know: Auth.js uses D1 for sessions, Workers KV is optimized for sessions
   - What's unclear: Performance implications of D1 vs KV for high-frequency session reads
   - Recommendation: Start with D1 (Auth.js standard), monitor performance, consider KV migration if latency issues

4. **GitHub OAuth Token Storage**
   - What we know: Arctic returns tokens, need to store for future API calls
   - What's unclear: Best practice for token refresh and revocation in D1 schema
   - Recommendation: Store in `accounts` table (Auth.js schema), implement token refresh in Phase 3 when Git operations needed

5. **Onboarding Flow Complexity**
   - What we know: User wants "brief onboarding" after first login
   - What's unclear: Exact steps and data to collect (name? preferences? skip option?)
   - Recommendation: Minimal onboarding (welcome message + username confirmation), Claude's discretion for exact flow

6. **Ramp Inspect Aesthetic Details**
   - What we know: Match Ramp Inspect design, minimal login page
   - What's unclear: Specific component patterns, spacing, typography details
   - Recommendation: Research Ramp Inspect screenshots/demo, use shadcn/ui base with clean layout, Phase 4 will refine visual polish

## Sources

### Primary (HIGH confidence)

- [Turborepo Structuring Documentation](https://turborepo.dev/docs/crafting-your-repository/structuring-a-repository) - Repository organization
- [Next.js Authentication Guide](https://nextjs.org/docs/app/guides/authentication) - Official patterns, DAL, middleware
- [Cloudflare D1 Worker API](https://developers.cloudflare.com/d1/worker-api/d1-database/) - D1 sessions, queries, transactions
- [Auth.js D1 Adapter](https://authjs.dev/getting-started/adapters/d1) - Database schema
- [GitHub OAuth Scopes Documentation](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/scopes-for-oauth-apps) - OAuth permissions
- [Cloudflare Workers Secrets Documentation](https://developers.cloudflare.com/workers/configuration/secrets/) - Secrets management
- [Arctic Documentation](https://lucia-auth.com/tutorials/github-oauth/nextjs) - OAuth implementation
- [next-themes GitHub](https://github.com/pacocoursey/next-themes) - Theme management
- [shadcn/ui Tailwind v4 Docs](https://ui.shadcn.com/docs/tailwind-v4) - Component setup

### Secondary (MEDIUM confidence)

- [Clerk Authentication Guide for Next.js App Router](https://clerk.com/articles/complete-authentication-guide-for-nextjs-app-router) - CVE-2025-29927 analysis, DAL pattern
- [WorkOS Authentication Solutions for Next.js 2026](https://workos.com/blog/top-authentication-solutions-nextjs-2026) - Auth library comparison
- [OpenNext Cloudflare Documentation](https://opennext.js.org/cloudflare) - Deployment patterns
- [Complete Guide to Password Hashing 2025](https://guptadeepak.com/the-complete-guide-to-password-hashing-argon2-vs-bcrypt-vs-scrypt-vs-pbkdf2-2026/) - Argon2 vs bcrypt
- [Nx TypeScript Monorepo Management](https://nx.dev/blog/managing-ts-packages-in-monorepos) - tsconfig patterns
- [Session Management Best Practices - OWASP](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html) - Rolling expiry, timeouts
- [FreeCodeCamp Next.js Forms Guide](https://www.freecodecamp.org/news/handling-forms-nextjs-server-actions-zod/) - Zod validation patterns
- [DEV Community Turborepo Setup Guide](https://dev.to/hexshift/setting-up-a-scalable-monorepo-with-turborepo-and-pnpm-4doh) - Project structure

### Tertiary (LOW confidence - requires validation)

- [Ramp Engineering Blog on Component Libraries](https://engineering.ramp.com/bootstrapping-a-ui-component-library) - Design system patterns
- [Medium: Turborepo with Next.js and shadcn/ui Setup](https://medium.com/@amirjld/how-to-set-up-a-turborepo-with-next-js-typescript-tailwind-css-v4-and-shadcn-ui-1d0535ea160f) - Integration patterns
- [Medium: Using Claude Code with OpenRouter](https://medium.com/@joe.njenga/how-im-using-claude-code-like-cline-with-openrouter-to-go-beast-mode-at-low-cost-8c78e0bdcb67) - OpenRouter integration (Phase 3)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries verified through official documentation, current versions confirmed
- Architecture: HIGH - Patterns from Next.js official docs, Turborepo docs, Auth.js examples
- Pitfalls: HIGH - CVE-2025-29927 is documented vulnerability, other pitfalls from official warnings and community reports
- Code examples: HIGH - All examples sourced from official documentation with URLs provided
- Ramp Inspect aesthetic: LOW - Limited public information available, requires additional research in Phase 4

**Research date:** 2026-02-01
**Valid until:** ~2026-03-01 (30 days for stable stack, CVE patches urgent)

**Critical action items before planning:**
1. Ensure Next.js 15.2.3+ for security patch (CVE-2025-29927)
2. Confirm OpenNext Cloudflare adapter supports target Next.js version
3. Decide D1 access pattern (proxy through Worker API recommended)
4. Define minimal onboarding flow steps (Claude's discretion)
5. Research Ramp Inspect UI patterns for Phase 4 (can defer)
