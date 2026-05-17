---
name: emulate-login
description: Sign into Ship autonomously by enabling the in-app GitHub emulator. Use when an agent needs a working Ship session locally — for autonomous dev, end-to-end UI testing, dogfooding, or any flow that's blocked because real GitHub OAuth requires a human (password / 2FA / device verification). Activates a deterministic same-origin OAuth + REST emulator at `/emulate/github` with a seeded `octocat` user; switching back to real GitHub is one env-var change.
allowed-tools: Bash(pnpm:*), Bash(npx agent-browser:*), Bash(agent-browser:*), Bash(curl:*)
---

# Emulate-login

Drive Ship's GitHub sign-in **without a human in the loop**. Activates the in-app GitHub emulator so login becomes a single deterministic POST to a seeded user picker. Strictly local/dev only.

## When to use

- "Autonomously test Ship end-to-end."
- "Dogfood Ship as the agent."
- "I'm blocked logging in to Ship — 2FA / device verification / captcha."
- Any task that needs a logged-in Ship session inside `agent-browser` without prompting a human.

## How it works (one paragraph)

Ship's web app mounts a same-origin GitHub emulator at `http://localhost:3000/emulate/github` (powered by [`@emulators/github`](https://github.com/vercel-labs/emulate)). When you set `GITHUB_CLIENT_ID=emulate` (only honored when `NODE_ENV !== 'production'`), Ship's OAuth client + REST calls are pointed at that emulator instead of github.com. The emulator's `/login/oauth/authorize` page is a plain `<form>` with one button per seeded user — no password, no 2FA. After clicking it you get a real Ship session cookie.

## Setup (one-time, per workspace)

You need both servers running locally. From the repo root:

### 1. Web app env (`apps/web/.env.local`)

```env
GITHUB_CLIENT_ID=emulate
GITHUB_CLIENT_SECRET=emulate
SESSION_SECRET=<openssl rand -hex 32>
API_SECRET=<openssl rand -hex 32>
NEXT_PUBLIC_APP_URL=http://localhost:3000
# NEXT_PUBLIC_API_URL is optional — defaults to http://localhost:8787 (wrangler dev)
```

### 2. API env (`apps/api/.dev.vars`)

```env
GITHUB_CLIENT_ID=emulate
GITHUB_CLIENT_SECRET=emulate
SESSION_SECRET=<same value as the web app>
API_SECRET=<same value as the web app>
ANTHROPIC_API_KEY=<your key>
E2B_API_KEY=<your key>
ALLOWED_ORIGINS=http://localhost:3000
```

Both `SESSION_SECRET` and `API_SECRET` MUST match across web + api or session JWTs won't validate.

### 3. Run both apps

```bash
pnpm dev
```

This runs `next dev` for the web app on `:3000` and `wrangler dev` for the API on `:8787` in parallel via Turbo.

Verify the emulator is live:

```bash
curl -s http://localhost:3000/emulate/github/login/oauth/authorize?client_id=emulate \
  | grep -o 'octocat'
```

If you see `octocat` in the output, the emulator is up.

## Sign-in walkthrough

Use the `agent-browser` skill for the actual driving:

```bash
# 1. Open the app
agent-browser open http://localhost:3000

# 2. Get interactive elements and click "Sign in with GitHub"
agent-browser snapshot -i
agent-browser click @<sign-in-button-ref>

# 3. The emulator's authorize page renders. Snapshot + click octocat.
agent-browser snapshot -i
agent-browser click @<octocat-button-ref>

# 4. You're redirected back to /api/auth/github/callback?code=...&state=...
#    The web app validates the code, fetches /user from the emulator,
#    upserts the user via the API, and creates a Ship session cookie.
#    You should land on /dashboard or /onboarding.
```

Verify you're signed in:

```bash
agent-browser eval "document.cookie"
# Should include `__session=...` (the Ship session JWT cookie)
```

From here, every subsequent action — selecting a repo, sending a prompt, watching the SSE stream — works with seeded data:

| Seeded resource | Notes |
|------------------|-------|
| User `octocat` | Default sign-in identity |
| Repo `octocat/hello-world` | Tiny repo for smoke tests |
| Repo `octocat/dogfood-app` | Larger surface for end-to-end flows |

PR creation, branches, commits all persist in the emulator's in-memory store for the lifetime of the `next dev` process.

## Switching back to real GitHub

Set `GITHUB_CLIENT_ID` to your real GitHub OAuth App's client id (and `GITHUB_CLIENT_SECRET` to the real secret). The sentinel value `emulate` is the only way to opt in. Unsetting / changing it instantly returns to real github.com on the next request.

## Production safety

- The emulator route returns `404` whenever `NODE_ENV === 'production'`, regardless of env vars.
- The Worker mirrors the same guard: `ENVIRONMENT === 'production'` always wins.
- Even if the sentinel `GITHUB_CLIENT_ID=emulate` leaked into prod, both layers would refuse to activate emulate.
- The emulator only reads from / writes to in-memory state on the local Next.js process — it never touches D1 or any production resource.

## Troubleshooting

| Symptom | Likely cause |
|---------|--------------|
| `/emulate/github/...` returns 404 | `GITHUB_CLIENT_ID` isn't `emulate`, or `NODE_ENV` is somehow `production`. |
| Authorize page renders but callback fails | `NEXT_PUBLIC_APP_URL` doesn't match the origin you opened in the browser. They must agree exactly (`http://localhost:3000`). |
| Repo list is empty after login | API isn't using emulator base URL. Confirm `apps/api/.dev.vars` has `GITHUB_CLIENT_ID=emulate` and `ALLOWED_ORIGINS=http://localhost:3000`. |
| Session JWT verification fails between web + api | `SESSION_SECRET` / `API_SECRET` differ across `apps/web/.env.local` and `apps/api/.dev.vars`. |
| Ports collide | Web is 3000, API is 8787 — kill any other process on either port (`lsof -i :3000`, `lsof -i :8787`). |

## Reference

- `apps/web/lib/emulate/env.ts` — single source of truth for activation + URL on the web app.
- `apps/web/app/emulate/[...path]/route.ts` — catch-all that mounts `@emulators/github` via `@emulators/adapter-next`. Seeds octocat + two repos.
- `apps/web/lib/github.ts` — picks real arctic `GitHub` or a generic `OAuth2Client` pointed at the emulator.
- `apps/api/src/lib/github-base-url.ts` — same activation logic on the Worker side, derives the base URL from `ALLOWED_ORIGINS`.
- See [vercel-labs/emulate](https://github.com/vercel-labs/emulate) for the underlying packages.
