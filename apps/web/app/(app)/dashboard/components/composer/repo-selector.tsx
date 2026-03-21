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

  // Cursor-style: compact, no bg on hover, just color shift, rounded-full
  const triggerClass =
    'h-auto gap-0.5 px-0 py-0 rounded-full text-muted-foreground hover:text-foreground hover:bg-transparent! hover:shadow-none! [&_span]:text-xs [&_span]:max-w-[200px] [&_svg]:size-2.5 [&_svg]:opacity-40 [&_svg]:transition-opacity hover:[&_svg]:opacity-100'

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
      triggerClassName={triggerClass}
    />
  )
}
