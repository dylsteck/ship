'use client'

import { useQuery } from '@tanstack/react-query'
import { getUsersMe, unwrapSdkData, type User } from '@ship/sdk'
import { queryKeys } from '../query-keys'

export function useUser(fetchEnabled: boolean | undefined) {
  const { data, error, isLoading, refetch } = useQuery({
    queryKey: queryKeys.usersMe,
    queryFn: async () => unwrapSdkData(await getUsersMe()),
    enabled: Boolean(fetchEnabled),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  })

  return {
    user: data,
    isLoading,
    isError: !!error,
    error,
    mutate: refetch,
  }
}
