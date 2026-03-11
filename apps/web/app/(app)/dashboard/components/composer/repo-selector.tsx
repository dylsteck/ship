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

  // Cursor-style: text-base, no bg on hover, just color shift, rounded-full
  const triggerClass =
    'h-auto gap-1 px-0 py-0 rounded-full text-muted-foreground hover:text-foreground hover:bg-transparent! [&_span]:text-sm [&_span]:max-w-[240px] [&_svg]:size-3 [&_svg]:opacity-40 [&_svg]:transition-opacity hover:[&_svg]:opacity-100'

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
