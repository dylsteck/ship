'use client'

import { useInfiniteQuery } from '@tanstack/react-query'
import { getAccountsGithubRepos, unwrapSdkData, type GitHubRepo } from '@ship/sdk'
import { queryKeys } from '../query-keys'

const REPOS_PER_PAGE = 50

export interface ReposPageResponse {
  repos: GitHubRepo[]
  hasMore: boolean
  nextPage: number | null
}

export function useGitHubRepos(fetchEnabled: boolean | undefined) {
  const { data, error, isLoading, isFetchingNextPage, hasNextPage, fetchNextPage, refetch } =
    useInfiniteQuery({
      queryKey: ['github-repos'],
      queryFn: async ({ pageParam }) =>
        unwrapSdkData(
          await getAccountsGithubRepos({
            query: { page: String(pageParam), per_page: String(REPOS_PER_PAGE) },
          }),
        ),
      initialPageParam: 1,
      getNextPageParam: (lastPage) => (lastPage.hasMore ? (lastPage.nextPage ?? undefined) : undefined),
      enabled: Boolean(fetchEnabled),
      staleTime: 60_000,
      refetchOnWindowFocus: false,
    })

  const repos = data ? data.pages.flatMap((p) => p.repos) : []
  const hasMore = hasNextPage ?? false
  const loadMore = () => {
    if (hasNextPage) void fetchNextPage()
  }

  return {
    repos,
    isLoading,
    isLoadingMore: isFetchingNextPage,
    hasMore,
    loadMore,
    isError: !!error,
    error,
    mutate: refetch,
  }
}

export function useFilteredGitHubRepos(fetchEnabled: boolean | undefined, searchQuery: string = '') {
  const { repos, isLoading, isLoadingMore, hasMore, loadMore, isError, error, mutate } =
    useGitHubRepos(fetchEnabled)

  const filteredRepos = searchQuery
    ? repos.filter(
        (repo) =>
          repo.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          repo.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (repo.description?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false),
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
