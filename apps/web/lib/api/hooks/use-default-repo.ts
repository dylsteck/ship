'use client'

import useSWR from 'swr'
import useSWRMutation from 'swr/mutation'
import { fetcher, apiUrl, post } from '../client'

export interface DefaultRepoResponse {
  repoFullName: string | null
}

/**
 * Hook to fetch the JWT user's default repository preference.
 */
export function useDefaultRepo(fetchEnabled: boolean | undefined) {
  const { data, error, isLoading, mutate } = useSWR<DefaultRepoResponse | null>(
    fetchEnabled ? apiUrl('/accounts/github/default-repo') : null,
    async (url: string) => {
      try {
        return await fetcher<DefaultRepoResponse>(url)
      } catch (err: unknown) {
        if ((err as { status?: number })?.status === 404) return null
        throw err
      }
    },
  )

  return {
    defaultRepoFullName: data?.repoFullName ?? null,
    isLoading,
    isError: !!error,
    error,
    mutate,
  }
}

/**
 * Mutation hook to set user's default repo
 */
export function useSetDefaultRepo() {
  const { trigger, isMutating, error } = useSWRMutation(
    'set-default-repo',
    async (_key: string, { arg }: { arg: { repoFullName: string } }) => {
      return post<{ repoFullName: string }, DefaultRepoResponse>(apiUrl('/accounts/github/default-repo'), arg)
    },
  )

  return {
    setDefaultRepo: trigger,
    isSetting: isMutating,
    error,
  }
}
