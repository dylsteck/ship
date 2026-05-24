'use client'

import useSWR from 'swr'
import useSWRMutation from 'swr/mutation'
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

/**
 * Hook to fetch chat messages (API returns array directly).
 */
export function useChatMessages(
  sessionId: string | undefined,
  options?: { limit?: number; before?: string },
) {
  const { data, error, isLoading, mutate } = useSWR<Message[]>(
    sessionId ? ['chat-messages', sessionId, options?.limit, options?.before] : null,
    async () => {
      const rows = unwrapSdkData(
        await getChatBySessionIdMessages({
          path: { sessionId: sessionId! },
          query: { limit: options?.limit?.toString(), before: options?.before },
        }),
      )
      return rows.map(normalizeChatMessage)
    },
  )

  return {
    messages: data ?? [],
    hasMore: false,
    nextCursor: undefined,
    isLoading,
    isError: !!error,
    error,
    mutate,
  }
}

/** Hook to fetch tasks for a session */
export function useChatTasks(sessionId: string | undefined) {
  const { data, error, isLoading, mutate } = useSWR<ChatTask[]>(
    sessionId ? ['chat-tasks', sessionId] : null,
    async () => unwrapSdkData(await getChatBySessionIdTasks({ path: { sessionId: sessionId! } })),
    { refreshInterval: 10000 },
  )

  return {
    tasks: data ?? [],
    isLoading,
    isError: !!error,
    error,
    mutate,
  }
}

/** Hook to fetch git state for a session */
export function useGitState(sessionId: string | undefined) {
  const { data, error, isLoading, mutate } = useSWR<GitState>(
    sessionId ? ['git-state', sessionId] : null,
    async () => unwrapSdkData(await getChatBySessionIdGitState({ path: { sessionId: sessionId! } })),
    { refreshInterval: 15000 },
  )

  return {
    gitState: data,
    isLoading,
    isError: !!error,
    error,
    mutate,
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
  const { trigger, isMutating, error } = useSWRMutation(
    sessionId ? `stop-chat-${sessionId}` : null,
    async () => {
      if (!sessionId) throw new Error('No session ID')
      unwrapSdkData(await postChatBySessionIdStop({ path: { sessionId } }))
    },
  )

  return {
    stopChat: trigger,
    isStopping: isMutating,
    error,
  }
}

/** Mutation hook to mark PR as ready for review */
export function useMarkPRReady(sessionId: string | undefined) {
  const { trigger, isMutating, error } = useSWRMutation(
    sessionId ? `mark-pr-ready-${sessionId}` : null,
    async () => {
      if (!sessionId) throw new Error('No session ID')
      unwrapSdkData(await postChatBySessionIdGitPrReady({ path: { sessionId } }))
    },
  )

  return {
    markPRReady: trigger,
    isMarking: isMutating,
    error,
  }
}

/** Mutation hook to retry a failed chat operation */
export function useRetryChat(sessionId: string | undefined) {
  const { trigger, isMutating, error } = useSWRMutation(
    sessionId ? `retry-chat-${sessionId}` : null,
    async () => {
      if (!sessionId) throw new Error('No session ID')
      unwrapSdkData(await postChatBySessionIdRetry({ path: { sessionId } }))
    },
  )

  return {
    retryChat: trigger,
    isRetrying: isMutating,
    error,
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
