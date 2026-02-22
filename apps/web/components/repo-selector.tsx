'use client'

import { useState, useCallback } from 'react'
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Input,
} from '@ship/ui'
import { HugeiconsIcon } from '@hugeicons/react'
import { ArrowDown01Icon, GithubIcon } from '@hugeicons/core-free-icons'
import type { GitHubRepo } from '@/lib/api/types'

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
  /** Full-width trigger for settings/card layout */
  fullWidth?: boolean
  /** Show "None" option to clear selection (e.g. for default repo) */
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
    [loadMore, hasMore, isLoadingMore]
  )

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            disabled={disabled}
            className={
              fullWidth
                ? 'h-9 w-full justify-between px-3 rounded-md gap-2'
                : 'h-8 px-2 sm:px-3 rounded-full gap-1.5'
            }
          >
            <HugeiconsIcon icon={GithubIcon} strokeWidth={2} />
            <span
              className={
                fullWidth
                  ? 'flex-1 text-left truncate text-sm'
                  : 'max-w-[100px] sm:max-w-[150px] truncate text-sm'
              }
            >
              {selectedRepo ? selectedRepo.fullName : placeholder}
            </span>
            <HugeiconsIcon
              icon={ArrowDown01Icon}
              strokeWidth={2}
              className="text-muted-foreground size-3.5 shrink-0"
            />
          </Button>
        }
      />
      <DropdownMenuContent align="start" className="w-[280px]">
        <div className="p-2 pb-1">
          <Input
            placeholder={searchPlaceholder}
            value={repoSearch}
            onChange={(e) => setRepoSearch(e.target.value)}
            onKeyDown={(e) => e.stopPropagation()}
            autoFocus
          />
        </div>
        <div className="max-h-[280px] overflow-y-auto" onScroll={handleScroll}>
          {isLoading ? (
            <div className="p-3 text-center text-sm text-muted-foreground">Loading repos...</div>
          ) : filteredRepos.length === 0 ? (
            <div className="p-3 text-center text-sm text-muted-foreground">No repos found</div>
          ) : (
            <DropdownMenuGroup>
              {allowNone && (
                <DropdownMenuItem onClick={onClear}>
                  <span className="text-muted-foreground italic">None</span>
                </DropdownMenuItem>
              )}
              {filteredRepos.map((repo) => (
                <DropdownMenuItem key={repo.id} onClick={() => onRepoSelect(repo)}>
                  <HugeiconsIcon icon={GithubIcon} strokeWidth={2} />
                  <span className="truncate flex-1">{repo.fullName}</span>
                  {repo.private && <span className="text-[10px] text-muted-foreground">private</span>}
                </DropdownMenuItem>
              ))}
              {isLoadingMore && (
                <div className="py-2 text-center text-xs text-muted-foreground">Loading more...</div>
              )}
            </DropdownMenuGroup>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
