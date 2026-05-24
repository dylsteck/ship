'use client'

import useSWR from 'swr'
import { getUsersMe, unwrapSdkData, type User } from '@ship/sdk'

export function useUser(fetchEnabled: boolean | undefined) {
  const { data, error, isLoading, mutate } = useSWR<User>(
    fetchEnabled ? ['users-me'] : null,
    async () => unwrapSdkData(await getUsersMe()),
    { revalidateOnFocus: false, dedupingInterval: 60000 },
  )

  return {
    user: data,
    isLoading,
    isError: !!error,
    error,
    mutate,
  }
}
