'use client'

import useSWRInfinite from 'swr/infinite'
import { getAccountsGithubRepos, unwrapSdkData, type GitHubRepo } from '@ship/sdk'

const REPOS_PER_PAGE = 50

export interface ReposPageResponse {
  repos: GitHubRepo[]
  hasMore: boolean
  nextPage: number | null
}

export function useGitHubRepos(fetchEnabled: boolean | undefined) {
  const getKey = (pageIndex: number, previousPageData: ReposPageResponse | null) => {
    if (!fetchEnabled) return null
    if (pageIndex > 0 && previousPageData && !previousPageData.hasMore) return null
    return ['github-repos', pageIndex + 1] as const
  }

  const { data, error, size, setSize, isLoading, isValidating } = useSWRInfinite<ReposPageResponse>(
    getKey,
    async ([, page]: readonly ['github-repos', number]) =>
      unwrapSdkData(
        await getAccountsGithubRepos({
          query: { page: String(page), per_page: String(REPOS_PER_PAGE) },
        }),
      ),
    {
      revalidateOnFocus: false,
      revalidateFirstPage: false,
      dedupingInterval: 60000,
    },
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
