'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  deleteSessions,
  deleteSessionsBySessionId,
  getSessions,
  getSessionsBySessionId,
  getSessionsBySessionIdSandbox,
  postChatBySessionIdRetry,
  postSandbox,
  postSessions,
  unwrapSdkData,
  type CreateSessionBody,
  type Session,
} from '@ship/sdk'
import { invalidateSession, invalidateSessions } from '../query-invalidation'
import { queryKeys } from '../query-keys'

/**
 * Hook to fetch all sessions for the logged-in user (JWT in `Authorization`).
 */
export function useSessions(
  fetchEnabled: boolean | undefined,
  options?: { refreshInterval?: number; refetchOnFocus?: boolean },
) {
  const { data, error, isLoading, refetch } = useQuery({
    queryKey: queryKeys.sessions,
    queryFn: async () => unwrapSdkData(await getSessions()),
    enabled: Boolean(fetchEnabled),
    refetchInterval: options?.refreshInterval,
    refetchOnWindowFocus: options?.refetchOnFocus ?? true,
  })

  return {
    sessions: data ?? [],
    isLoading,
    isError: !!error,
    error,
    mutate: refetch,
  }
}

/** Hook to fetch a single session by ID */
export function useSession(sessionId: string | undefined) {
  const { data, error, isLoading, refetch } = useQuery({
    queryKey: queryKeys.session(sessionId ?? ''),
    queryFn: async () => unwrapSdkData(await getSessionsBySessionId({ path: { sessionId: sessionId! } })),
    enabled: Boolean(sessionId),
  })

  return {
    session: data,
    isLoading,
    isError: !!error,
    error,
    mutate: refetch,
  }
}

/** Hook to fetch sandbox status for a session */
export function useSandboxStatus(sessionId: string | undefined) {
  const { data, error, isLoading, refetch } = useQuery({
    queryKey: queryKeys.sandbox(sessionId ?? ''),
    queryFn: async () => unwrapSdkData(await getSessionsBySessionIdSandbox({ path: { sessionId: sessionId! } })),
    enabled: Boolean(sessionId),
    refetchInterval: 5000,
    refetchOnWindowFocus: false,
  })

  return {
    sandbox: data,
    isReady: data?.ready ?? false,
    isLoading,
    isError: !!error,
    error,
    mutate: refetch,
  }
}

/** Mutation hook to create a new session */
export function useCreateSession() {
  const queryClient = useQueryClient()
  const mutation = useMutation({
    mutationFn: async (arg: CreateSessionBody) => unwrapSdkData(await postSessions({ body: arg })),
    onSuccess: () => invalidateSessions(queryClient),
  })

  return {
    createSession: mutation.mutateAsync,
    isCreating: mutation.isPending,
    error: mutation.error,
  }
}

/** Mutation hook to delete a session */
export function useDeleteSession() {
  const queryClient = useQueryClient()
  const mutation = useMutation({
    mutationFn: async (arg: { sessionId: string }) => {
      unwrapSdkData(await deleteSessionsBySessionId({ path: { sessionId: arg.sessionId } }))
    },
    onSuccess: (_data, arg) => invalidateSession(queryClient, arg.sessionId),
  })

  return {
    deleteSession: mutation.mutateAsync,
    isDeleting: mutation.isPending,
    error: mutation.error,
  }
}

/** Mutation hook to delete all sessions for the authenticated user */
export function useDeleteAllSessions() {
  const queryClient = useQueryClient()
  const mutation = useMutation({
    mutationFn: async () => unwrapSdkData(await deleteSessions()),
    onSuccess: () => invalidateSessions(queryClient),
  })

  return {
    deleteAllSessions: mutation.mutateAsync,
    isDeleting: mutation.isPending,
    error: mutation.error,
  }
}

/** Provision sandbox for a session */
export function useProvisionSandbox() {
  const queryClient = useQueryClient()
  const mutation = useMutation({
    mutationFn: async (arg: { sessionId: string }) =>
      unwrapSdkData(await postSandbox({ body: { sessionId: arg.sessionId } })),
    onSuccess: (_data, arg) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.sandbox(arg.sessionId) })
    },
  })

  return {
    provisionSandbox: mutation.mutateAsync,
    isProvisioning: mutation.isPending,
    error: mutation.error,
  }
}

/** Mutation hook to retry a failed session operation */
export function useRetrySession() {
  const mutation = useMutation({
    mutationFn: async (arg: { sessionId: string }) =>
      unwrapSdkData(await postChatBySessionIdRetry({ path: { sessionId: arg.sessionId } })),
  })

  return {
    retrySession: mutation.mutateAsync,
    isRetrying: mutation.isPending,
    error: mutation.error,
  }
}

/** Re-export session type for consumers */
export type ChatSession = Omit<Session, 'archivedAt'> & {
  archivedAt: number | null
  messageCount?: number
  branch?: string
}
