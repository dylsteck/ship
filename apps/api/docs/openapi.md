# Ship API — OpenAPI & REST schemas

The Worker exposes a machine-readable OpenAPI 3.1 document for all JSON REST endpoints. Streaming chat (SSE) and WebSocket session events are documented in the spec for discoverability but are consumed through `@ship/sdk/streaming` and `@ship/sdk/ws` on clients.

## Architecture

```
Zod schemas (src/openapi/schemas.ts)
        │
        ▼
buildOpenApiDocument() (src/openapi/build-spec.ts)
        │
        ├── scripts/export-openapi.ts → openapi/ship-api.openapi.json (committed)
        └── GET /openapi.json (src/routes/openapi.ts, public)
                │
                ▼
        @hey-api/openapi-ts → packages/sdk/src/generated/
```

| Layer | Package / path | Role |
|-------|----------------|------|
| Request validation | `src/lib/api-schemas.ts` | Re-exports Zod schemas + `parseJsonBody` for Hono routes |
| OpenAPI source | `src/openapi/schemas.ts` | Single source of truth for REST shapes |
| Spec artifact | `openapi/ship-api.openapi.json` | Committed; CI checks drift |
| Live spec | `GET /openapi.json` | Serves the committed JSON |
| Generated client | `@ship/sdk` | Hey API TypeScript client + types |
| Streaming wire | `@ship/contracts` | SSE / WS event schemas (not in OpenAPI) |

## Adding or changing an endpoint

1. **Define schemas** in `src/openapi/schemas.ts` using `.openapi('Name')` on Zod objects.
2. **Register the route** in `src/openapi/build-spec.ts` with path, method, request/response schemas, and tags.
3. **Use the same schema** in the Hono handler via `parseJsonBody` from `src/lib/api-schemas.ts`.
4. **Export and regenerate:**
   ```bash
   pnpm openapi:export      # writes openapi/ship-api.openapi.json
   pnpm sdk:generate        # regenerates packages/sdk/src/generated/
   ```
5. **Commit** both `ship-api.openapi.json` and `packages/sdk/src/generated/` changes.

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm openapi:export` | Regenerate `openapi/ship-api.openapi.json` from Zod |
| `pnpm openapi:check` | Fail if the committed spec is stale |
| `pnpm sdk:generate` | Regenerate `@ship/sdk` from the spec |
| `pnpm sdk:generate:check` | Fail if generated SDK is stale |

Run from the repo root or from `apps/api` (`openapi:*`) / `packages/sdk` (`generate`).

## Auth in the spec

- **User routes** — `Authorization: Bearer <session JWT>`. The JWT subject is the user id; do not pass `userId` in URLs for self-scoped operations.
- **Service routes** — `Authorization: Bearer <API_SECRET>` for trusted server-to-server calls (OAuth user upsert, GitHub account storage). Never expose `API_SECRET` to browsers.

## What is not in OpenAPI

- **SSE event payloads** — defined in `@ship/contracts` (`MessagePart`, session summary, permission/question events). Clients parse these with the existing SSE adapter.
- **WebSocket frames** — Session DO broadcasts; URL builder is `@ship/sdk/ws`.
- **ACP bridge protocol** — internal to the Worker ↔ sandbox; not a public REST surface.

## Local verification

```bash
cd apps/api
pnpm openapi:export
pnpm openapi:check
curl -s http://localhost:8787/openapi.json | head
```

After changing schemas, always run `pnpm sdk:generate` and `pnpm typecheck` at the repo root before opening a PR.
