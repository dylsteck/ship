'use client'

import useSWR from 'swr'
import useSWRMutation from 'swr/mutation'
import {
  getAccountsGithubDefaultRepo,
  postAccountsGithubDefaultRepo,
  unwrapSdkData,
} from '@ship/sdk'

export function useDefaultRepo(fetchEnabled: boolean | undefined) {
  const { data, error, isLoading, mutate } = useSWR(
    fetchEnabled ? ['default-repo'] : null,
    async () => {
      try {
        return unwrapSdkData(await getAccountsGithubDefaultRepo())
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

export function useSetDefaultRepo() {
  const { trigger, isMutating, error } = useSWRMutation(
    'set-default-repo',
    async (_key: string, { arg }: { arg: { repoFullName: string } }) =>
      unwrapSdkData(await postAccountsGithubDefaultRepo({ body: { repoFullName: arg.repoFullName } })),
  )

  return { setDefaultRepo: trigger, isSetting: isMutating, error }
}
