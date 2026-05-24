'use client'

import useSWR from 'swr'
import useSWRMutation from 'swr/mutation'
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

/**
 * Hook to fetch all sessions for the logged-in user (JWT in `Authorization`).
 */
export function useSessions(
  fetchEnabled: boolean | undefined,
  options?: { refreshInterval?: number; revalidateOnFocus?: boolean },
) {
  const { data, error, isLoading, mutate } = useSWR<Session[]>(
    fetchEnabled ? ['sessions'] : null,
    async () => unwrapSdkData(await getSessions()),
    {
      refreshInterval: options?.refreshInterval,
      revalidateOnFocus: options?.revalidateOnFocus ?? true,
    },
  )

  return {
    sessions: data ?? [],
    isLoading,
    isError: !!error,
    error,
    mutate,
  }
}

/** Hook to fetch a single session by ID */
export function useSession(sessionId: string | undefined) {
  const { data, error, isLoading, mutate } = useSWR<Session>(
    sessionId ? ['session', sessionId] : null,
    async () => unwrapSdkData(await getSessionsBySessionId({ path: { sessionId: sessionId! } })),
  )

  return {
    session: data,
    isLoading,
    isError: !!error,
    error,
    mutate,
  }
}

/** Hook to fetch sandbox status for a session */
export function useSandboxStatus(sessionId: string | undefined) {
  const { data, error, isLoading, mutate } = useSWR(
    sessionId ? ['sandbox', sessionId] : null,
    async () => unwrapSdkData(await getSessionsBySessionIdSandbox({ path: { sessionId: sessionId! } })),
    {
      refreshInterval: 5000,
      revalidateOnFocus: false,
    },
  )

  return {
    sandbox: data,
    isReady: data?.ready ?? false,
    isLoading,
    isError: !!error,
    error,
    mutate,
  }
}

/** Mutation hook to create a new session */
export function useCreateSession() {
  const { trigger, isMutating, error } = useSWRMutation(
    'create-session',
    async (_key: string, { arg }: { arg: CreateSessionBody }) =>
      unwrapSdkData(await postSessions({ body: arg })),
  )

  return {
    createSession: trigger,
    isCreating: isMutating,
    error,
  }
}

/** Mutation hook to delete a session */
export function useDeleteSession() {
  const { trigger, isMutating, error } = useSWRMutation(
    'delete-session',
    async (_key: string, { arg }: { arg: { sessionId: string } }) => {
      unwrapSdkData(await deleteSessionsBySessionId({ path: { sessionId: arg.sessionId } }))
    },
  )

  return {
    deleteSession: trigger,
    isDeleting: isMutating,
    error,
  }
}

/** Mutation hook to delete all sessions for the authenticated user */
export function useDeleteAllSessions() {
  const { trigger, isMutating, error } = useSWRMutation('delete-all-sessions', async () =>
    unwrapSdkData(await deleteSessions()),
  )

  return {
    deleteAllSessions: trigger,
    isDeleting: isMutating,
    error,
  }
}

/** Provision sandbox for a session */
export function useProvisionSandbox() {
  const { trigger, isMutating, error } = useSWRMutation(
    'provision-sandbox',
    async (_key: string, { arg }: { arg: { sessionId: string } }) =>
      unwrapSdkData(await postSandbox({ body: { sessionId: arg.sessionId } })),
  )

  return {
    provisionSandbox: trigger,
    isProvisioning: isMutating,
    error,
  }
}

/** Mutation hook to retry a failed session operation */
export function useRetrySession() {
  const { trigger, isMutating, error } = useSWRMutation(
    'retry-session',
    async (_key: string, { arg }: { arg: { sessionId: string } }) =>
      unwrapSdkData(await postChatBySessionIdRetry({ path: { sessionId: arg.sessionId } })),
  )

  return {
    retrySession: trigger,
    isRetrying: isMutating,
    error,
  }
}

/** Re-export session type for consumers */
export type ChatSession = Omit<Session, 'archivedAt'> & {
  archivedAt: number | null
  messageCount?: number
  branch?: string
}
