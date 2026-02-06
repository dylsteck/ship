'use client'

import useSWR from 'swr'
import useSWRMutation from 'swr/mutation'
import { fetcher, apiUrl, post } from '../client'
import type { Connector, ConnectorStatus } from '../types'

/**
 * Hook to fetch connector status for a user
 */
export function useConnectors(userId: string | undefined) {
  const { data, error, isLoading, mutate } = useSWR<ConnectorStatus>(
    userId ? apiUrl('/connectors', { userId }) : null,
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
    async (_key: string, { arg }: { arg: { name: string; userId: string } }) => {
      return post<{ userId: string }, Connector>(
        apiUrl(`/connectors/${arg.name}/enable`),
        { userId: arg.userId }
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
    async (_key: string, { arg }: { arg: { name: string; userId: string } }) => {
      return post<{ userId: string }, Connector>(
        apiUrl(`/connectors/${arg.name}/disable`),
        { userId: arg.userId }
      )
    }
  )

  return {
    disableConnector: trigger,
    isDisabling: isMutating,
    error,
  }
}
