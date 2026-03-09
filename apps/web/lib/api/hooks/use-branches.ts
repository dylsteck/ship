'use client'

import useSWR from 'swr'
import { authFetcher, apiUrl } from '../client'

interface BranchesResponse {
  branches: string[]
}

/**
 * Hook to fetch branches for a specific GitHub repository.
 * Only fetches when both userId and repo (owner/name) are provided.
 */
export function useGitHubBranches(
  userId: string | undefined,
  owner: string | undefined,
  repo: string | undefined,
) {
  const key =
    userId && owner && repo
      ? apiUrl(`/accounts/github/branches/${userId}/${owner}/${repo}`)
      : null

  const { data, error, isLoading } = useSWR<BranchesResponse>(key, authFetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60000,
  })

  return {
    branches: data?.branches ?? [],
    isLoading,
    isError: !!error,
  }
}
