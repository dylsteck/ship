'use client'

import { useMutation, useQuery } from '@tanstack/react-query'
import {
  getChatBySessionIdEvents,
  getChatBySessionIdGitState,
  getChatBySessionIdMessages,
  getChatBySessionIdTasks,
  postChatBySessionIdGitPrReady,
  postChatBySessionIdPermissionByPermissionId,
  postChatBySessionIdQuestionByQuestionId,
  postChatBySessionIdQuestionByQuestionIdReject,
  postChatBySessionIdRetry,
  postChatBySessionIdStop,
  unwrapSdkData,
  type ChatTask,
  type GitState,
} from '@ship/sdk'
import type { Message, RawEvent } from '../chat-types'
import { normalizeChatEvent, normalizeChatMessage } from '../normalize'
import { queryKeys } from '../query-keys'

/**
 * Hook to fetch chat messages (API returns array directly).
 */
export function useChatMessages(
  sessionId: string | undefined,
  options?: { limit?: number; before?: string },
) {
  const { data, error, isLoading, refetch } = useQuery({
    queryKey: queryKeys.chatMessages(sessionId ?? '', options?.limit, options?.before),
    queryFn: async () => {
      const rows = unwrapSdkData(
        await getChatBySessionIdMessages({
          path: { sessionId: sessionId! },
          query: { limit: options?.limit?.toString(), before: options?.before },
        }),
      )
      return rows.map(normalizeChatMessage)
    },
    enabled: Boolean(sessionId),
  })

  return {
    messages: data ?? [],
    hasMore: false,
    nextCursor: undefined,
    isLoading,
    isError: !!error,
    error,
    mutate: refetch,
  }
}

/** Hook to fetch tasks for a session */
export function useChatTasks(sessionId: string | undefined) {
  const { data, error, isLoading, refetch } = useQuery({
    queryKey: queryKeys.chatTasks(sessionId ?? ''),
    queryFn: async () => unwrapSdkData(await getChatBySessionIdTasks({ path: { sessionId: sessionId! } })),
    enabled: Boolean(sessionId),
    refetchInterval: 10_000,
    refetchOnWindowFocus: false,
  })

  return {
    tasks: data ?? [],
    isLoading,
    isError: !!error,
    error,
    mutate: refetch,
  }
}

/** Hook to fetch git state for a session */
export function useGitState(sessionId: string | undefined) {
  const { data, error, isLoading, refetch } = useQuery({
    queryKey: queryKeys.gitState(sessionId ?? ''),
    queryFn: async () => unwrapSdkData(await getChatBySessionIdGitState({ path: { sessionId: sessionId! } })),
    enabled: Boolean(sessionId),
    refetchInterval: (query) => ((query.state.data as GitState | undefined)?.pr ? 60_000 : 5_000),
    refetchOnWindowFocus: false,
  })

  return {
    gitState: data,
    isLoading,
    isError: !!error,
    error,
    mutate: refetch,
  }
}

/** No API route — kept for compatibility; always empty */
export function useGitDiff(_sessionId: string | undefined) {
  return {
    diff: '',
    isLoading: false,
    isError: false,
    error: undefined,
    mutate: async () => undefined,
  }
}

/** Mutation hook to stop chat streaming */
export function useStopChat(sessionId: string | undefined) {
  const mutation = useMutation({
    mutationFn: async () => {
      if (!sessionId) throw new Error('No session ID')
      unwrapSdkData(await postChatBySessionIdStop({ path: { sessionId } }))
    },
  })

  return {
    stopChat: mutation.mutateAsync,
    isStopping: mutation.isPending,
    error: mutation.error,
  }
}

/** Mutation hook to mark PR as ready for review */
export function useMarkPRReady(sessionId: string | undefined) {
  const mutation = useMutation({
    mutationFn: async () => {
      if (!sessionId) throw new Error('No session ID')
      unwrapSdkData(await postChatBySessionIdGitPrReady({ path: { sessionId } }))
    },
  })

  return {
    markPRReady: mutation.mutateAsync,
    isMarking: mutation.isPending,
    error: mutation.error,
  }
}

/** Mutation hook to retry a failed chat operation */
export function useRetryChat(sessionId: string | undefined) {
  const mutation = useMutation({
    mutationFn: async () => {
      if (!sessionId) throw new Error('No session ID')
      unwrapSdkData(await postChatBySessionIdRetry({ path: { sessionId } }))
    },
  })

  return {
    retryChat: mutation.mutateAsync,
    isRetrying: mutation.isPending,
    error: mutation.error,
  }
}

/** Reply to a permission request */
export async function replyPermission(
  sessionId: string,
  permissionId: string,
  reply: 'once' | 'always' | 'reject',
): Promise<{ success: boolean }> {
  return unwrapSdkData(
    await postChatBySessionIdPermissionByPermissionId({
      path: { sessionId, permissionId },
      body: { reply },
    }),
  )
}

/** Reply to an agent question */
export async function replyQuestion(
  sessionId: string,
  questionId: string,
  response: string,
): Promise<{ success: boolean }> {
  return unwrapSdkData(
    await postChatBySessionIdQuestionByQuestionId({
      path: { sessionId, questionId },
      body: { response },
    }),
  )
}

/** Reject/skip an agent question */
export async function rejectQuestion(sessionId: string, questionId: string): Promise<{ success: boolean }> {
  return unwrapSdkData(
    await postChatBySessionIdQuestionByQuestionIdReject({
      path: { sessionId, questionId },
    }),
  )
}

/** Fetch chat events (Overview inspector) */
export async function fetchChatEvents(sessionId: string): Promise<RawEvent[]> {
  try {
    const rows = unwrapSdkData(await getChatBySessionIdEvents({ path: { sessionId } }))
    return rows.map(normalizeChatEvent)
  } catch {
    return []
  }
}

/** Fetch chat messages for history loader */
export async function fetchChatMessages(
  sessionId: string,
  options?: { limit?: number; before?: string },
): Promise<Message[]> {
  const rows = unwrapSdkData(
    await getChatBySessionIdMessages({
      path: { sessionId },
      query: { limit: options?.limit?.toString(), before: options?.before },
    }),
  )
  return rows.map(normalizeChatMessage)
}
