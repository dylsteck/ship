# Ship API (Cloudflare Worker)

Hono router on Cloudflare Workers — sessions, chat SSE, sandbox provisioning, models, git, connectors.

## Dev

```bash
cd apps/api
pnpm dev          # wrangler dev on :8787
```

Requires `.dev.vars` (see root `AGENTS.md`).

## OpenAPI

- Spec: `openapi/ship-api.openapi.json` (committed)
- Live: `GET /openapi.json`
- Docs: [docs/openapi.md](./docs/openapi.md)

```bash
pnpm openapi:export
pnpm openapi:check
```

## Deploy

```bash
pnpm deploy:prod   # production env
```

Secrets via `wrangler secret put` (see `AGENTS.md`).

## Tests

```bash
pnpm test
pnpm typecheck
pnpm lint
```
