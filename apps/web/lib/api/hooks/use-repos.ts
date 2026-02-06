'use client'

import useSWR from 'swr'
import { fetcher, apiUrl } from '../client'
import type { GitHubRepo } from '../types'

/**
 * Hook to fetch user's GitHub repositories
 */
export function useGitHubRepos(userId: string | undefined) {
  const { data, error, isLoading, mutate } = useSWR<GitHubRepo[]>(
    userId ? apiUrl(`/accounts/github/repos/${userId}`) : null,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 30000, // Cache for 30 seconds
    }
  )

  return {
    repos: data ?? [],
    isLoading,
    isError: !!error,
    error,
    mutate,
  }
}

/**
 * Hook with search/filter functionality for repos
 */
export function useFilteredGitHubRepos(
  userId: string | undefined,
  searchQuery: string = ''
) {
  const { repos, isLoading, isError, error, mutate } = useGitHubRepos(userId)

  const filteredRepos = searchQuery
    ? repos.filter(
        (repo) =>
          repo.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          repo.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
          repo.description?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : repos

  return {
    repos: filteredRepos,
    allRepos: repos,
    isLoading,
    isError,
    error,
    mutate,
  }
}
