'use client'

import {
  DropdownMenuGroup,
  DropdownMenuItem,
  Input,
} from '@ship/ui'
import { cn } from '@ship/ui/utils'
import { HugeiconsIcon } from '@hugeicons/react'
import { Tick02Icon } from '@hugeicons/core-free-icons'
import type { GitHubRepo } from '@/lib/api/types'

export function RepoSelectorList({
  filteredRepos,
  selectedRepo,
  onRepoSelect,
  isLoading,
  isLoadingMore,
  allowNone,
  onClear,
  onScroll,
}: {
  filteredRepos: GitHubRepo[]
  selectedRepo: GitHubRepo | null
  onRepoSelect: (repo: GitHubRepo) => void
  isLoading: boolean
  isLoadingMore: boolean
  allowNone?: boolean
  onClear?: () => void
  onScroll: (e: React.UIEvent<HTMLDivElement>) => void
}) {
  if (isLoading) {
    return <div className="p-3 text-center text-xs text-muted-foreground">Loading repos...</div>
  }

  if (filteredRepos.length === 0) {
    return <div className="p-3 text-center text-xs text-muted-foreground">No repos found</div>
  }

  return (
    <div className="max-h-[280px] overflow-y-auto" onScroll={onScroll}>
      <DropdownMenuGroup>
        {allowNone && (
          <DropdownMenuItem onClick={onClear}>
            <span className="text-muted-foreground italic text-xs">None</span>
          </DropdownMenuItem>
        )}
        {filteredRepos.map((repo) => {
          const isSelected = selectedRepo?.id === repo.id
          return (
            <DropdownMenuItem
              key={repo.id}
              className={cn('flex items-center justify-between cursor-pointer', isSelected && 'bg-accent')}
              onClick={() => onRepoSelect(repo)}
            >
              <span className="truncate flex-1 text-xs">{repo.fullName}</span>
              <div className="flex items-center gap-1.5 shrink-0">
                {repo.private && <span className="text-[10px] text-muted-foreground">private</span>}
                {isSelected && (
                  <HugeiconsIcon icon={Tick02Icon} size={14} strokeWidth={2.5} className="text-foreground" />
                )}
              </div>
            </DropdownMenuItem>
          )
        })}
        {isLoadingMore && (
          <div className="py-2 text-center text-xs text-muted-foreground">Loading more...</div>
        )}
      </DropdownMenuGroup>
    </div>
  )
}

export function RepoSelectorSearch({
  searchPlaceholder,
  repoSearch,
  onSearchChange,
}: {
  searchPlaceholder: string
  repoSearch: string
  onSearchChange: (value: string) => void
}) {
  return (
    <div className="p-2 pb-1">
      <Input
        placeholder={searchPlaceholder}
        value={repoSearch}
        onChange={(e) => onSearchChange(e.target.value)}
        onKeyDown={(e) => e.stopPropagation()}
        autoFocus
      />
    </div>
  )
}
