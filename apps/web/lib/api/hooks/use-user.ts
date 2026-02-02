'use client'

import useSWR from 'swr'
import { fetcher, apiUrl } from '../client'
import type { User } from '../types'

/**
 * Hook to fetch user information
 */
export function useUser(userId: string | undefined) {
  const { data, error, isLoading, mutate } = useSWR<User>(
    userId ? apiUrl(`/users/${userId}`) : null,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 60000, // Cache for 1 minute
    }
  )

  return {
    user: data,
    isLoading,
    isError: !!error,
    error,
    mutate,
  }
}
