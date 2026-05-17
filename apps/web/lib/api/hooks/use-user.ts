'use client'

import useSWR from 'swr'
import { fetcher, apiUrl } from '../client'
import type { User } from '../types'

/**
 * Hook to fetch the current user (`GET /users/me`, session JWT).
 */
export function useUser(fetchEnabled: boolean | undefined) {
  const { data, error, isLoading, mutate } = useSWR<User>(
    fetchEnabled ? apiUrl('/users/me') : null,
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
