'use client'

import useSWR from 'swr'
import useSWRMutation from 'swr/mutation'
import { fetcher, apiUrl, post } from '../client'
import type { ConnectorStatus } from '../types'

/**
 * Hook to fetch connector status for the JWT user.
 */
export function useConnectors(fetchEnabled: boolean | undefined) {
  const { data, error, isLoading, mutate } = useSWR<ConnectorStatus>(
    fetchEnabled ? apiUrl('/connectors') : null,
    fetcher,
    {
      revalidateOnFocus: true,
    }
  )

  return {
    connectors: data?.connectors ?? [],
    isLoading,
    isError: !!error,
    error,
    mutate,
  }
}

/**
 * Mutation hook to enable a connector
 */
export function useEnableConnector() {
  const { trigger, isMutating, error } = useSWRMutation(
    'enable-connector',
    async (_key: string, { arg }: { arg: { name: string } }) => {
      return post<Record<string, never>, { success: boolean; enabled?: boolean }>(
        apiUrl(`/connectors/${arg.name}/enable`),
        {},
      )
    }
  )

  return {
    enableConnector: trigger,
    isEnabling: isMutating,
    error,
  }
}

/**
 * Mutation hook to disable a connector
 */
export function useDisableConnector() {
  const { trigger, isMutating, error } = useSWRMutation(
    'disable-connector',
    async (_key: string, { arg }: { arg: { name: string } }) => {
      return post<Record<string, never>, { success: boolean; enabled?: boolean }>(
        apiUrl(`/connectors/${arg.name}/disable`),
        {},
      )
    }
  )

  return {
    disableConnector: trigger,
    isDisabling: isMutating,
    error,
  }
}
