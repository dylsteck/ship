'use client'

import useSWR from 'swr'
import useSWRMutation from 'swr/mutation'
import { fetcher, apiUrl, post, del } from '../client'
import type { ChatSession } from '../server'
import type { CreateSessionParams, SandboxStatus } from '../types'

/**
 * Hook to fetch all sessions for a user
 * @param userId - User ID (undefined to disable fetch)
 * @param options - Optional SWR config (e.g. refreshInterval when on homepage)
 */
export function useSessions(
  userId: string | undefined,
  options?: { refreshInterval?: number; revalidateOnFocus?: boolean },
) {
  const { data, error, isLoading, mutate } = useSWR<ChatSession[]>(
    userId ? apiUrl('/sessions', { userId }) : null,
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
    fetcher
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
    }
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
    }
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
    }
  )

  return {
    deleteSession: trigger,
    isDeleting: isMutating,
    error,
  }
}

/**
 * Mutation hook to delete all sessions for a user
 */
export function useDeleteAllSessions() {
  const { trigger, isMutating, error } = useSWRMutation(
    'delete-all-sessions',
    async (_key: string, { arg }: { arg: { userId: string } }) => {
      return del<{ success: boolean; deletedCount: number }>(apiUrl('/sessions', { userId: arg.userId }))
    }
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
    }
  )

  return {
    provisionSandbox: trigger,
    isProvisioning: isMutating,
    error,
  }
}

/**
 * Mutation hook to retry a failed session operation
 */
export function useRetrySession() {
  const { trigger, isMutating, error } = useSWRMutation(
    'retry-session',
    async (_key: string, { arg }: { arg: { sessionId: string } }) => {
      return post<{}, ChatSession>(apiUrl(`/sessions/${arg.sessionId}/retry`), {})
    }
  )

  return {
    retrySession: trigger,
    isRetrying: isMutating,
    error,
  }
}
