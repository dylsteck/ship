'use client'

import useSWR from 'swr'
import useSWRMutation from 'swr/mutation'
import {
  getConnectors,
  postConnectorsByNameDisable,
  postConnectorsByNameEnable,
  unwrapSdkData,
  type Connector,
} from '@ship/sdk'

export function useConnectors(fetchEnabled: boolean | undefined) {
  const { data, error, isLoading, mutate } = useSWR(
    fetchEnabled ? ['connectors'] : null,
    async () => unwrapSdkData(await getConnectors()),
    { revalidateOnFocus: true },
  )

  return {
    connectors: (data?.connectors ?? []) as Connector[],
    isLoading,
    isError: !!error,
    error,
    mutate,
  }
}

export function useEnableConnector() {
  const { trigger, isMutating, error } = useSWRMutation(
    'enable-connector',
    async (_key: string, { arg }: { arg: { name: string } }) =>
      unwrapSdkData(await postConnectorsByNameEnable({ path: { name: arg.name } })),
  )

  return { enableConnector: trigger, isEnabling: isMutating, error }
}

export function useDisableConnector() {
  const { trigger, isMutating, error } = useSWRMutation(
    'disable-connector',
    async (_key: string, { arg }: { arg: { name: string } }) =>
      unwrapSdkData(await postConnectorsByNameDisable({ path: { name: arg.name } })),
  )

  return { disableConnector: trigger, isDisabling: isMutating, error }
}
