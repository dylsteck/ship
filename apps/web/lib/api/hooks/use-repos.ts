'use client'

import useSWR from 'swr'
import useSWRInfinite from 'swr/infinite'
import { authFetcher, apiUrl } from '../client'
import type { GitHubRepo } from '../types'

const REPOS_PER_PAGE = 50

interface ReposPageResponse {
  repos: GitHubRepo[]
  hasMore: boolean
  nextPage: number | null
}

/**
 * Hook to fetch user's GitHub repositories with infinite scroll/pagination.
 * Loads first page on mount, then loadMore() fetches subsequent pages.
 */
export function useGitHubRepos(userId: string | undefined) {
  const getKey = (pageIndex: number, previousPageData: ReposPageResponse | null) => {
    if (!userId) return null
    if (pageIndex > 0 && previousPageData && !previousPageData.hasMore) return null
    return apiUrl(`/accounts/github/repos/${userId}`, {
      page: pageIndex + 1,
      per_page: REPOS_PER_PAGE,
    })
  }

  const { data, error, size, setSize, isLoading, isValidating } = useSWRInfinite<ReposPageResponse>(
    getKey,
    authFetcher,
    {
      revalidateOnFocus: false,
      revalidateFirstPage: false,
      dedupingInterval: 60000, // 1 min - API has its own 5 min cache
    }
  )

  const repos = data ? data.flatMap((p) => p.repos) : []
  const isLoadingMore = isLoading || (size > 0 && data && typeof data[size - 1] === 'undefined')
  const hasMore = data && data.length > 0 ? (data[data.length - 1]?.hasMore ?? false) : true
  const loadMore = () => setSize(size + 1)

  return {
    repos,
    isLoading,
    isLoadingMore,
    hasMore,
    loadMore,
    isError: !!error,
    error,
    mutate: () => setSize(1),
  }
}

/**
 * Hook with search/filter functionality for repos (client-side filter over paginated data)
 */
export function useFilteredGitHubRepos(
  userId: string | undefined,
  searchQuery: string = ''
) {
  const { repos, isLoading, isLoadingMore, hasMore, loadMore, isError, error, mutate } =
    useGitHubRepos(userId)

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
    isLoadingMore,
    hasMore,
    loadMore,
    isError,
    error,
    mutate,
  }
}
