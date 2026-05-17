'use client'

import useSWR from 'swr'
import useSWRMutation from 'swr/mutation'
import { fetcher, apiUrl, post } from '../client'
import type { AgentInfo, DefaultAgentResponse } from '../types'

/**
 * Hook to fetch available agents with their models and modes
 */
export function useAgents() {
  const { data, error, isLoading } = useSWR<AgentInfo[]>(apiUrl('/models/agents'), fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60000,
  })

  return {
    agents: data ?? [],
    isLoading,
    isError: !!error,
    error,
  }
}

/**
 * Hook to fetch the JWT user's default agent preference.
 */
export function useDefaultAgent(fetchEnabled: boolean | undefined) {
  const { data, error, isLoading, mutate } = useSWR<DefaultAgentResponse | null>(
    fetchEnabled ? apiUrl('/models/default-agent') : null,
    async (url: string) => {
      try {
        return await fetcher<DefaultAgentResponse>(url)
      } catch (err: unknown) {
        if ((err as { status?: number })?.status === 404) return null
        throw err
      }
    },
  )

  return {
    defaultAgentId: data?.agentId ?? null,
    isLoading,
    isError: !!error,
    error,
    mutate,
  }
}

/**
 * Mutation hook to set user's default agent
 */
export function useSetDefaultAgent() {
  const { trigger, isMutating, error } = useSWRMutation(
    'set-default-agent',
    async (_key: string, { arg }: { arg: { agentId: string } }) => {
      return post<{ agentId: string }, DefaultAgentResponse>(apiUrl('/models/default-agent'), {
        agentId: arg.agentId,
      })
    },
  )

  return {
    setDefaultAgent: trigger,
    isSetting: isMutating,
    error,
  }
}
