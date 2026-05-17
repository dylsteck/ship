'use client'

import useSWR from 'swr'
import useSWRMutation from 'swr/mutation'
import { fetcher, apiUrl, post, del } from '../client'
import type { ChatSession } from '../server'
import type { CreateSessionParams, SandboxStatus } from '../types'

/**
 * Hook to fetch all sessions for the logged-in user (JWT in `Authorization`).
 *
 * @param fetchEnabled - When `true`, runs the request. Identity always comes from the JWT, not the URL.
 */
export function useSessions(
  fetchEnabled: boolean | undefined,
  options?: { refreshInterval?: number; revalidateOnFocus?: boolean },
) {
  const { data, error, isLoading, mutate } = useSWR<ChatSession[]>(
    fetchEnabled ? apiUrl('/sessions') : null,
    fetcher,
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

/**
 * Hook to fetch a single session by ID
 */
export function useSession(sessionId: string | undefined) {
  const { data, error, isLoading, mutate } = useSWR<ChatSession>(
    sessionId ? apiUrl(`/sessions/${sessionId}`) : null,
    fetcher,
  )

  return {
    session: data,
    isLoading,
    isError: !!error,
    error,
    mutate,
  }
}

/**
 * Hook to fetch sandbox status for a session
 */
export function useSandboxStatus(sessionId: string | undefined) {
  const { data, error, isLoading, mutate } = useSWR<SandboxStatus>(
    sessionId ? apiUrl(`/sessions/${sessionId}/sandbox`) : null,
    fetcher,
    {
      refreshInterval: 5000, // Poll every 5 seconds until ready
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

/**
 * Mutation hook to create a new session
 */
export function useCreateSession() {
  const { trigger, isMutating, error } = useSWRMutation(
    'create-session',
    async (_key: string, { arg }: { arg: CreateSessionParams }) => {
      return post<CreateSessionParams, ChatSession>(apiUrl('/sessions'), arg)
    },
  )

  return {
    createSession: trigger,
    isCreating: isMutating,
    error,
  }
}

/**
 * Mutation hook to delete a session
 */
export function useDeleteSession() {
  const { trigger, isMutating, error } = useSWRMutation(
    'delete-session',
    async (_key: string, { arg }: { arg: { sessionId: string } }) => {
      return del(apiUrl(`/sessions/${arg.sessionId}`))
    },
  )

  return {
    deleteSession: trigger,
    isDeleting: isMutating,
    error,
  }
}

/**
 * Mutation hook to delete all sessions for the authenticated user
 */
export function useDeleteAllSessions() {
  const { trigger, isMutating, error } = useSWRMutation(
    'delete-all-sessions',
    async () => {
      return del<{ success: boolean; deletedCount: number }>(apiUrl('/sessions'))
    },
  )

  return {
    deleteAllSessions: trigger,
    isDeleting: isMutating,
    error,
  }
}

/**
 * Provision sandbox for a session (e.g. when opening one that has no sandbox)
 */
export function useProvisionSandbox() {
  const { trigger, isMutating, error } = useSWRMutation(
    'provision-sandbox',
    async (_key: string, { arg }: { arg: { sessionId: string } }) => {
      return post<{ sessionId: string }, unknown>(apiUrl('/sandbox'), { sessionId: arg.sessionId })
    },
  )

  return {
    provisionSandbox: trigger,
    isProvisioning: isMutating,
    error,
  }
}

/**
 * Mutation hook to retry a failed session operation (unpause agent in DO)
 */
export function useRetrySession() {
  const { trigger, isMutating, error } = useSWRMutation(
    'retry-session',
    async (_key: string, { arg }: { arg: { sessionId: string } }) => {
      return post<{}, ChatSession>(apiUrl(`/chat/${arg.sessionId}/retry`), {})
    },
  )

  return {
    retrySession: trigger,
    isRetrying: isMutating,
    error,
  }
}
