'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  getConnectors,
  postConnectorsByNameDisable,
  postConnectorsByNameEnable,
  unwrapSdkData,
  type Connector,
} from '@ship/sdk'
import { queryKeys } from '../query-keys'

export function useConnectors(fetchEnabled: boolean | undefined) {
  const { data, error, isLoading, refetch } = useQuery({
    queryKey: queryKeys.connectors,
    queryFn: async () => unwrapSdkData(await getConnectors()),
    enabled: Boolean(fetchEnabled),
    refetchOnWindowFocus: true,
  })

  return {
    connectors: (data?.connectors ?? []) as Connector[],
    isLoading,
    isError: !!error,
    error,
    mutate: refetch,
  }
}

export function useEnableConnector() {
  const queryClient = useQueryClient()
  const mutation = useMutation({
    mutationFn: async (arg: { name: string }) =>
      unwrapSdkData(await postConnectorsByNameEnable({ path: { name: arg.name } })),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.connectors })
    },
  })

  return { enableConnector: mutation.mutateAsync, isEnabling: mutation.isPending, error: mutation.error }
}

export function useDisableConnector() {
  const queryClient = useQueryClient()
  const mutation = useMutation({
    mutationFn: async (arg: { name: string }) =>
      unwrapSdkData(await postConnectorsByNameDisable({ path: { name: arg.name } })),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.connectors })
    },
  })

  return { disableConnector: mutation.mutateAsync, isDisabling: mutation.isPending, error: mutation.error }
}
