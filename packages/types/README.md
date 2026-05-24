# @ship/types

Legacy shared TypeScript types for the monorepo (user, auth session shapes).

## Usage

```typescript
import type { User, Session, Account } from '@ship/types'
```

Prefer **`@ship/sdk`** for API wire types and **`@ship/contracts`** for streaming events in new code. This package remains for web auth/DTO types not yet moved to OpenAPI.

## Scripts

```bash
pnpm --filter @ship/types lint
```
