'use client'

import useSWR from 'swr'
import useSWRMutation from 'swr/mutation'
import { fetcher, apiUrl, post } from '../client'

interface DesktopStreamStatus {
  streamUrl: string | null
  active: boolean
}

interface StartDesktopResponse {
  streamUrl: string
}

/**
 * Hook to get current desktop stream status for a session
 */
export function useDesktopStream(sessionId: string | undefined) {
  const { data, error, isLoading, mutate } = useSWR<DesktopStreamStatus>(
    sessionId ? apiUrl(`/desktop/${sessionId}/stream`) : null,
    fetcher,
    {
      revalidateOnFocus: false,
    },
  )

  return {
    streamUrl: data?.streamUrl ?? null,
    isActive: data?.active ?? false,
    isLoading,
    isError: !!error,
    error,
    mutate,
  }
}

/**
 * Mutation hook to start desktop stream
 */
export function useStartDesktopStream() {
  const { trigger, isMutating, error } = useSWRMutation(
    'start-desktop-stream',
    async (_key: string, { arg }: { arg: { sessionId: string } }) => {
      return post<Record<string, never>, StartDesktopResponse>(
        apiUrl(`/desktop/${arg.sessionId}/start`),
        {},
      )
    },
  )

  return {
    startStream: trigger,
    isStarting: isMutating,
    error,
  }
}

/**
 * Mutation hook to stop desktop stream
 */
export function useStopDesktopStream() {
  const { trigger, isMutating, error } = useSWRMutation(
    'stop-desktop-stream',
    async (_key: string, { arg }: { arg: { sessionId: string } }) => {
      return post<Record<string, never>, { success: boolean }>(
        apiUrl(`/desktop/${arg.sessionId}/stop`),
        {},
      )
    },
  )

  return {
    stopStream: trigger,
    isStopping: isMutating,
    error,
  }
}
