'use client'

import useSWR from 'swr'
import useSWRMutation from 'swr/mutation'
import { fetcher, apiUrl, post } from '../client'
import type { Message as ChatMessage } from '../server'
import type { ChatTask, GitState, SendMessageParams } from '../types'

interface MessagesResponse {
  messages: ChatMessage[]
  hasMore: boolean
  nextCursor?: string
}

/**
 * Hook to fetch chat messages with pagination
 */
export function useChatMessages(
  sessionId: string | undefined,
  options?: { limit?: number; before?: string }
) {
  const { data, error, isLoading, mutate } = useSWR<MessagesResponse>(
    sessionId
      ? apiUrl(`/chat/${sessionId}/messages`, {
          limit: options?.limit,
          before: options?.before,
        })
      : null,
    fetcher
  )

  return {
    messages: data?.messages ?? [],
    hasMore: data?.hasMore ?? false,
    nextCursor: data?.nextCursor,
    isLoading,
    isError: !!error,
    error,
    mutate,
  }
}

/**
 * Hook to fetch tasks for a session
 */
export function useChatTasks(sessionId: string | undefined) {
  const { data, error, isLoading, mutate } = useSWR<ChatTask[]>(
    sessionId ? apiUrl(`/chat/${sessionId}/tasks`) : null,
    fetcher,
    {
      refreshInterval: 10000, // Poll every 10 seconds for task updates
    }
  )

  return {
    tasks: data ?? [],
    isLoading,
    isError: !!error,
    error,
    mutate,
  }
}

/**
 * Hook to fetch git state for a session
 */
export function useGitState(sessionId: string | undefined) {
  const { data, error, isLoading, mutate } = useSWR<GitState>(
    sessionId ? apiUrl(`/chat/${sessionId}/git/state`) : null,
    fetcher,
    {
      refreshInterval: 15000, // Poll every 15 seconds
    }
  )

  return {
    gitState: data,
    isLoading,
    isError: !!error,
    error,
    mutate,
  }
}

/**
 * Hook to fetch git diff for a session
 */
export function useGitDiff(sessionId: string | undefined) {
  const { data, error, isLoading, mutate } = useSWR<{ diff: string }>(
    sessionId ? apiUrl(`/chat/${sessionId}/git/diff`) : null,
    fetcher
  )

  return {
    diff: data?.diff ?? '',
    isLoading,
    isError: !!error,
    error,
    mutate,
  }
}

/**
 * Mutation hook to send a chat message (non-streaming)
 * Note: For streaming, use the streaming utilities directly
 */
export function useSendMessage(sessionId: string | undefined) {
  const { trigger, isMutating, error } = useSWRMutation(
    sessionId ? `send-message-${sessionId}` : null,
    async (_key: string, { arg }: { arg: SendMessageParams }) => {
      if (!sessionId) throw new Error('No session ID')
      return post<SendMessageParams, ChatMessage>(
        apiUrl(`/chat/${sessionId}`),
        arg
      )
    }
  )

  return {
    sendMessage: trigger,
    isSending: isMutating,
    error,
  }
}

/**
 * Mutation hook to stop chat streaming
 */
export function useStopChat(sessionId: string | undefined) {
  const { trigger, isMutating, error } = useSWRMutation(
    sessionId ? `stop-chat-${sessionId}` : null,
    async () => {
      if (!sessionId) throw new Error('No session ID')
      return post<{}, { stopped: boolean }>(apiUrl(`/chat/${sessionId}/stop`), {})
    }
  )

  return {
    stopChat: trigger,
    isStopping: isMutating,
    error,
  }
}

/**
 * Mutation hook to mark PR as ready for review
 */
export function useMarkPRReady(sessionId: string | undefined) {
  const { trigger, isMutating, error } = useSWRMutation(
    sessionId ? `mark-pr-ready-${sessionId}` : null,
    async () => {
      if (!sessionId) throw new Error('No session ID')
      return post<{}, GitState>(apiUrl(`/chat/${sessionId}/git/pr/ready`), {})
    }
  )

  return {
    markPRReady: trigger,
    isMarking: isMutating,
    error,
  }
}

/**
 * Mutation hook to retry a failed chat operation
 */
export function useRetryChat(sessionId: string | undefined) {
  const { trigger, isMutating, error } = useSWRMutation(
    sessionId ? `retry-chat-${sessionId}` : null,
    async () => {
      if (!sessionId) throw new Error('No session ID')
      return post<{}, { success: boolean }>(apiUrl(`/chat/${sessionId}/retry`), {})
    }
  )

  return {
    retryChat: trigger,
    isRetrying: isMutating,
    error,
  }
}
