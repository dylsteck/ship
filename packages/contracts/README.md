# @ship/contracts

Shared Zod schemas and TypeScript types for **streaming wire format** between `apps/api` and `apps/web`.

## Scope

- Branded IDs (`SessionId`, `MessageId`, `TurnId`, …)
- SSE event schemas (`message.part.updated`, `session.summary.updated`, …)
- Session summary, turn metadata, approval policies, error classification

REST JSON types live in **`@ship/sdk`** (OpenAPI-generated). Do not duplicate REST shapes here.

## Usage

```typescript
import { SessionSummarySchema, classifyErrorFromMessage } from '@ship/contracts'
```

## Scripts

```bash
pnpm --filter @ship/contracts typecheck
```
