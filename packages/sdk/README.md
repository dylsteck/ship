# @ship/sdk

Typed TypeScript client for the Ship REST API, generated from the Worker's OpenAPI spec.

## Install

```json
{ "dependencies": { "@ship/sdk": "workspace:*" } }
```

## Usage

```typescript
import { configureShipClient, getSessions, unwrapSdkData } from '@ship/sdk'

configureShipClient({
  baseUrl: 'http://localhost:8787',
  getAuthToken: () => sessionJwt,
})

const sessions = unwrapSdkData(await getSessions())
```

## Subpath exports

| Import | Purpose |
|--------|---------|
| `@ship/sdk` | Generated REST functions + configure/unwrap helpers |
| `@ship/sdk/streaming` | SSE chat (`sendChatMessage`, `stopChatStream`, …) |
| `@ship/sdk/service` | `API_SECRET` server client (OAuth upsert) |
| `@ship/sdk/ws` | WebSocket URL builder |
| `@ship/sdk/types` | Generated types only |

## Regenerate

```bash
pnpm openapi:export   # repo root
pnpm sdk:generate
```

Full documentation: [docs/README.md](./docs/README.md).
