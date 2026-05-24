'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  getAccountsGithubDefaultRepo,
  postAccountsGithubDefaultRepo,
  unwrapSdkData,
} from '@ship/sdk'
import { queryKeys } from '../query-keys'

export function useDefaultRepo(fetchEnabled: boolean | undefined) {
  const { data, error, isLoading, refetch } = useQuery({
    queryKey: queryKeys.defaultRepo,
    queryFn: async () => {
      try {
        return unwrapSdkData(await getAccountsGithubDefaultRepo())
      } catch (err: unknown) {
        if ((err as { status?: number })?.status === 404) return null
        throw err
      }
    },
    enabled: Boolean(fetchEnabled),
  })

  return {
    defaultRepoFullName: data?.repoFullName ?? null,
    isLoading,
    isError: !!error,
    error,
    mutate: refetch,
  }
}

export function useSetDefaultRepo() {
  const queryClient = useQueryClient()
  const mutation = useMutation({
    mutationFn: async (arg: { repoFullName: string }) =>
      unwrapSdkData(await postAccountsGithubDefaultRepo({ body: { repoFullName: arg.repoFullName } })),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.defaultRepo })
    },
  })

  return { setDefaultRepo: mutation.mutateAsync, isSetting: mutation.isPending, error: mutation.error }
}
