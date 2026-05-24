import type { QueryClient } from '@tanstack/react-query'
import { queryKeys } from './query-keys'

/** Invalidate session list queries (sidebar, settings). */
export function invalidateSessions(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: queryKeys.sessions })
}

/** Invalidate a single session and list after mutations. */
export function invalidateSession(queryClient: QueryClient, sessionId: string): void {
  invalidateSessions(queryClient)
  void queryClient.invalidateQueries({ queryKey: queryKeys.session(sessionId) })
}
