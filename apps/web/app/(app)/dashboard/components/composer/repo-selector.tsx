'use client'

import { useComposer } from './composer-context'
import { RepoSelector as SharedRepoSelector } from '@/components/repo-selector'

/** Repo selector wired to ComposerContext - used in dashboard composer */
export function ComposerRepoSelector() {
  const {
    activeSessionId,
    selectedRepo,
    onRepoSelect,
    repos,
    reposLoading,
    reposLoadMore,
    reposHasMore,
    reposLoadingMore,
  } = useComposer()

  return (
    <SharedRepoSelector
      repos={repos}
      selectedRepo={selectedRepo}
      onRepoSelect={onRepoSelect}
      isLoading={reposLoading}
      loadMore={reposLoadMore}
      hasMore={reposHasMore}
      isLoadingMore={reposLoadingMore}
      placeholder="Select repo"
      triggerClassName={
        !activeSessionId
          ? 'text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100 [&_svg]:text-zinc-400'
          : undefined
      }
    />
  )
}
