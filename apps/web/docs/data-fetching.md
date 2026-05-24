# Data fetching without SWR

Ship is moving from **SWR** to **TanStack Query (React Query)** for client-side REST caching, while keeping **push-driven updates** for anything that must feel instant (sessions, streaming, cross-tab sync).

## Why not SWR alone?

SWR covers polling and focus revalidation well, but Ship already has stronger realtime paths:

| Source | What it updates | Latency |
|--------|------------------|---------|
| **Session DO WebSocket** | `session.summary.updated` → sidebar title, status, activity | Push (~ms) |
| **BroadcastChannel** | Cross-tab session create/delete/streaming | Push |
| **POST SSE** | Chat messages, tools, permissions | Push (per turn) |
| **REST polling** | Session list fallback, git state, tasks | Pull (seconds) |

The goal after removing SWR: **push first, poll as backup** — not poll everything.

## Recommended stack: TanStack Query + existing push

### 1. Replace SWR hooks with `useQuery` / `useMutation`

| SWR today | TanStack Query |
|-----------|----------------|
| `useSWR(key, fetcher)` | `useQuery({ queryKey, queryFn })` |
| `useSWRMutation` | `useMutation({ mutationFn, onSuccess })` |
| `useSWRInfinite` | `useInfiniteQuery` |
| `mutate()` | `queryClient.invalidateQueries({ queryKey })` |
| `mutate(data)` | `queryClient.setQueryData(queryKey, data)` |
| `useSWRConfig().mutate(filter)` | `queryClient.invalidateQueries({ predicate })` |
| `SWRProvider` defaults | `QueryClientProvider` + `defaultOptions` |

Example session list (replaces `useSessions` polling):

```typescript
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getSessions, unwrapSdkData } from '@ship/sdk'

export function useSessions() {
  return useQuery({
    queryKey: ['sessions'],
    queryFn: async () => unwrapSdkData(await getSessions()),
    staleTime: 2_000,
    refetchInterval: 3_000,        // backup poll (same as dashboard today)
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  })
}
```

Global defaults (replaces `swr-provider.tsx`):

```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 2_000,
      retry: 3,
      retryDelay: 5_000,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
    },
  },
})
```

### 2. Invalidate from WebSocket (instant sidebar)

When `session.summary.updated` arrives, invalidate instead of waiting for poll:

```typescript
// In route-ws-event.ts or a small hook
queryClient.invalidateQueries({ queryKey: ['sessions'] })
queryClient.invalidateQueries({ queryKey: ['session', sessionId] })
```

Optional optimistic patch with `setQueryData` if the WS payload already has the new title/status.

### 3. Invalidate from BroadcastChannel (cross-tab)

`lib/session-sync-channel.ts` already posts `sessions-invalidate`, `session-created`, etc. Subscribe once at app shell:

```typescript
useEffect(() => {
  return subscribeSessionSync((msg) => {
    if (msg.type === 'sessions-invalidate' || msg.type === 'session-created' || msg.type === 'session-deleted') {
      queryClient.invalidateQueries({ queryKey: ['sessions'] })
    }
  })
}, [queryClient])
```

### 4. Mutations invalidate related queries

```typescript
const queryClient = useQueryClient()

const createSession = useMutation({
  mutationFn: (body: CreateSessionBody) => unwrapSdkData(await postSessions({ body })),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['sessions'] })
    postSessionSync({ type: 'session-created' })
  },
})
```

### 5. What stays out of the query cache

| Data | Mechanism |
|------|-----------|
| Streaming chat tokens / tools | Zustand + SSE refs (`chat-store`) — too chatty for query cache |
| SSE event inspector | `eventsStore` singleton |
| Composer prompt / mode | Local React state |

## SWR → Query key map (migration checklist)

| Hook file | SWR key pattern | Query key |
|-----------|-----------------|-----------|
| `use-sessions.ts` | `['sessions']` | `['sessions']` |
| `use-session.ts` | `['session', id]` | `['session', id]` |
| `use-chat.ts` messages | `['chat-messages', id, …]` | `['chat-messages', id, { limit, before }]` |
| `use-chat.ts` tasks | `['chat-tasks', id]` | `['chat-tasks', id]` |
| `use-chat.ts` git | `['git-state', id]` | `['git-state', id]` |
| `use-models.ts` | `['models']`, `['models-default-*']` | same shape |
| `use-agents.ts` | `['models-agents']` | `['models-agents']` |
| `use-connectors.ts` | `['connectors']` | `['connectors']` |
| `use-repos.ts` | infinite pages | `['github-repos', { page }]` |
| `use-user.ts` | `['users-me']` | `['users-me']` |

## Realtime behavior summary

```
User action / server event
        │
        ├─ SSE / WS push ──► update Zustand or invalidate Query cache
        │
        ├─ BroadcastChannel ──► invalidate Query cache (other tabs)
        │
        └─ refetchInterval ──► safety net if push missed
```

This keeps the dashboard session list responsive (WS + 3s poll), settings connectors fresh on focus, and chat streaming on the existing SSE pipeline — without SWR.

## Migration steps

1. Add `@tanstack/react-query` to `apps/web`.
2. Replace `SWRProvider` with `QueryClientProvider` in `app/layout.tsx`.
3. Migrate hooks one file at a time (`use-sessions` first — highest traffic).
4. Wire WS + BroadcastChannel invalidation in dashboard shell.
5. Remove `swr` dependency and delete `swr-provider.tsx`.
6. Update settings cards that use `useSWRConfig().mutate` → `useQueryClient()`.
