# Ship Web (Next.js)

Dashboard, chat UI, settings, and OAuth — talks to the Worker via **`@ship/sdk`**.

## Dev

```bash
pnpm dev   # from repo root, or cd apps/web && pnpm dev
```

- App: http://localhost:3000
- API: http://localhost:8787 (default)

Requires `.env.local` (see root `AGENTS.md`).

## Data fetching

Client REST hooks live in `lib/api/hooks/`. Migration from SWR → TanStack Query is documented in [docs/data-fetching.md](./docs/data-fetching.md).

Realtime paths:

- **SSE** — chat turns (`@ship/sdk/streaming`)
- **WebSocket** — session summaries (Session DO)
- **BroadcastChannel** — cross-tab session sync

## Build / deploy

Primary host is [Cloudflare Workers](https://developers.cloudflare.com/workers/) via [`@opennextjs/cloudflare`](https://opennext.js.org/cloudflare):

```bash
pnpm deploy          # from apps/web — OpenNext build + wrangler deploy
pnpm preview         # build and run locally in workerd
pnpm cf-typegen      # wrangler types
```

Optional Docker image: `apps/web/Dockerfile` (build context = repo root). Standalone Next.js output (`DEPLOY_TARGET=node`) on port 3000.

```bash
pnpm build
pnpm typecheck
pnpm lint
pnpm test
```
