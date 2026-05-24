# @ship/sdk

Typed TypeScript client for the Ship REST API, generated from `apps/api/openapi/ship-api.openapi.json` via [Hey API](https://heyapi.dev/).

## Install (monorepo)

```json
{
  "dependencies": {
    "@ship/sdk": "workspace:*"
  }
}
```

## Quick start

### Browser / Next.js client

Configure once at bootstrap, then call generated functions:

```typescript
import { configureShipClient, getSessions, unwrapSdkData } from '@ship/sdk'

configureShipClient({
  baseUrl: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8787',
  getAuthToken: () => sessionJwt,
})

const sessions = unwrapSdkData(await getSessions())
```

The web app wraps this in `@/lib/api/configure` (`setApiToken`, `configureWebShipClient`).

### Server Components (Next.js)

```typescript
import { cookies } from 'next/headers'
import { configureShipClient, getSessions, unwrapSdkData } from '@ship/sdk'

const jwt = (await cookies()).get('session')?.value ?? null
configureShipClient({
  baseUrl: API_URL,
  getAuthToken: () => jwt,
})
const sessions = unwrapSdkData(await getSessions())
```

See `apps/web/lib/api/server.ts` for the full SSR helper set.

### Service token (server-only)

For OAuth and account storage from the Next.js app:

```typescript
import { createShipServiceClient } from '@ship/sdk/service'

const client = createShipServiceClient({
  baseUrl: API_URL,
  apiSecret: process.env.API_SECRET!,
})

await client.upsertUser({ githubId, username, email, avatarUrl })
await client.storeGitHubAccount({ userId, providerAccountId, accessToken, refreshToken, expiresAt, tokenType, scope })
```

**Never** use `API_SECRET` in browser code.

## Subpath exports

| Import | Purpose |
|--------|---------|
| `@ship/sdk` | Generated REST functions, types, `configureShipClient`, `unwrapSdkData` |
| `@ship/sdk/streaming` | SSE helpers: `sendChatMessage`, `stopChatStream`, `subscribeToChatStream`, `retryChatSession` |
| `@ship/sdk/service` | `createShipServiceClient` for `API_SECRET` routes |
| `@ship/sdk/ws` | `buildWsUrl` for Session DO WebSocket URLs |
| `@ship/sdk/types` | Generated types only |

## Streaming chat

JSON codegen does not handle SSE bodies. Use `@ship/sdk/streaming`:

```typescript
import { sendChatMessage } from '@ship/sdk/streaming'

const response = await sendChatMessage({
  sessionId,
  content: 'Fix the login bug',
  mode: 'build',
  model: 'ship-acp-opencode:opencode/gpt-5.4',
})

if (!response.ok || !response.body) throw new Error('Stream failed')
// Parse SSE from response.body (see apps/web SSE handlers)
```

Event **payload shapes** come from `@ship/contracts`, not from this SDK.

## Error handling

Hey API returns `{ data, error, response }`. Use `unwrapSdkData` in SWR fetchers:

```typescript
const data = unwrapSdkData(await getSessionsBySessionId({ path: { sessionId } }))
```

On failure, `unwrapSdkData` throws a `ShipApiError` with optional `status` and `info` (legacy-compatible with the old web `fetcher`).

## Regenerating the client

When the API OpenAPI spec changes:

```bash
pnpm openapi:export   # from repo root — updates apps/api/openapi/ship-api.openapi.json
pnpm sdk:generate     # regenerates src/generated/
pnpm typecheck        # verify apps/web and apps/api still compile
```

CI can enforce freshness with `pnpm openapi:check` and `pnpm sdk:generate:check`.

## Web app migration notes

- **Hooks** (`apps/web/lib/api/hooks/*`) call `@ship/sdk` directly.
- **Legacy `fetcher` / `client.ts`** — deprecated; throws if used.
- **Web-only types** — `Message`, `RawEvent` in `apps/web/lib/api/chat-types.ts` normalize SDK `string | number` timestamps and optional error fields. Use `normalizeChatMessage` / `normalizeChatEvent` when bridging SDK → UI.
- **SSE / WS** — unchanged wire format via `@ship/contracts`; only the HTTP transport moved to the SDK.

## Future consumers (mobile, CLI, external)

1. Add `@ship/sdk` as a dependency (publish or git submodule).
2. Call `configureShipClient` with your auth token getter.
3. Import generated functions by name (`getSessions`, `postSessions`, …).
4. Use `@ship/sdk/streaming` for chat turns and `@ship/contracts` for event parsing.

No dependency on Next.js or `apps/web`.
