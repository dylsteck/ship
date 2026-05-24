'use client'

import { useState, useCallback } from 'react'
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@ship/ui'
import { cn } from '@ship/ui/utils'
import { HugeiconsIcon } from '@hugeicons/react'
import { ArrowDown01Icon } from '@hugeicons/core-free-icons'
import type { GitHubRepo } from '@/lib/api/types'
import { RepoSelectorList, RepoSelectorSearch } from './repo-selector-list'

export interface RepoSelectorProps {
  repos: GitHubRepo[]
  selectedRepo: GitHubRepo | null
  onRepoSelect: (repo: GitHubRepo) => void
  isLoading?: boolean
  loadMore?: () => void
  hasMore?: boolean
  isLoadingMore?: boolean
  disabled?: boolean
  placeholder?: string
  searchPlaceholder?: string
  fullWidth?: boolean
  triggerClassName?: string
  allowNone?: boolean
  onClear?: () => void
}

export function RepoSelector({
  repos,
  selectedRepo,
  onRepoSelect,
  isLoading = false,
  loadMore,
  hasMore = false,
  isLoadingMore = false,
  disabled = false,
  placeholder = 'Select repo',
  searchPlaceholder = 'Search repos...',
  fullWidth = false,
  allowNone = false,
  onClear,
  triggerClassName,
}: RepoSelectorProps) {
  const [repoSearch, setRepoSearch] = useState('')
  const filteredRepos = repoSearch
    ? repos.filter((r) => r.fullName.toLowerCase().includes(repoSearch.toLowerCase()))
    : repos

  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      if (!loadMore || !hasMore || isLoadingMore) return
      const el = e.currentTarget
      const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80
      if (nearBottom) loadMore()
    },
    [loadMore, hasMore, isLoadingMore],
  )

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            disabled={disabled}
            className={cn(
              fullWidth
                ? 'h-9 w-full justify-between px-3 rounded-md gap-2'
                : 'h-8 px-2 sm:px-3 rounded-full gap-1.5',
              triggerClassName,
            )}
          >
            <span className={fullWidth ? 'flex-1 text-left truncate text-sm' : 'max-w-[100px] sm:max-w-[150px] truncate text-sm'}>
              {selectedRepo ? selectedRepo.fullName : placeholder}
            </span>
            <HugeiconsIcon icon={ArrowDown01Icon} strokeWidth={2} className="text-muted-foreground size-3.5 shrink-0" />
          </Button>
        }
      />
      <DropdownMenuContent align="start" className="w-[280px]">
        <RepoSelectorSearch
          searchPlaceholder={searchPlaceholder}
          repoSearch={repoSearch}
          onSearchChange={setRepoSearch}
        />
        <RepoSelectorList
          filteredRepos={filteredRepos}
          selectedRepo={selectedRepo}
          onRepoSelect={onRepoSelect}
          isLoading={isLoading}
          isLoadingMore={isLoadingMore}
          allowNone={allowNone}
          onClear={onClear}
          onScroll={handleScroll}
        />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
