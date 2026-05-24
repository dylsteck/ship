'use client'

import { cn, Badge } from '@ship/ui'
import type { GitHubRepo } from '@/lib/api/types'

export function CreateSessionRepoList({
  repos,
  selectedRepo,
  onSelect,
  isLoadingMore,
}: {
  repos: GitHubRepo[]
  selectedRepo: string
  onSelect: (fullName: string) => void
  isLoadingMore: boolean
}) {
  return (
    <>
      {repos.map((repo) => (
        <button
          key={repo.id}
          type="button"
          onClick={() => onSelect(repo.fullName)}
          className={cn(
            'w-full px-2.5 py-2 text-left hover:bg-accent transition-colors flex items-center justify-between border-b border-border last:border-b-0',
            selectedRepo === repo.fullName && 'bg-accent',
          )}
        >
          <div className="min-w-0 flex-1">
            <p className={cn('text-[12px] truncate', selectedRepo === repo.fullName ? 'text-foreground font-medium' : 'text-foreground')}>
              {repo.fullName}
            </p>
            {repo.description && (
              <p className="text-[10px] text-muted-foreground truncate mt-0.5">{repo.description}</p>
            )}
          </div>
          <div className="flex items-center gap-1.5 ml-2 shrink-0">
            {repo.language && (
              <Badge variant="secondary" className="text-[9px] px-1 py-0">
                {repo.language}
              </Badge>
            )}
            {repo.private && (
              <svg className="w-3 h-3 text-muted-foreground" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
                  clipRule="evenodd"
                />
              </svg>
            )}
            {selectedRepo === repo.fullName && (
              <svg className="w-3.5 h-3.5 text-foreground" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
            )}
          </div>
        </button>
      ))}
      {isLoadingMore && (
        <div className="px-2.5 py-2 text-center text-[11px] text-muted-foreground border-b border-border">
          Loading more...
        </div>
      )}
    </>
  )
}

export function CreateSessionRepoPicker({
  searchQuery,
  onSearchChange,
  reposLoading,
  reposError,
  filteredRepos,
  selectedRepo,
  onSelectRepo,
  reposLoadingMore,
  onScroll,
  onRetry,
}: {
  searchQuery: string
  onSearchChange: (value: string) => void
  reposLoading: boolean
  reposError: string | null
  filteredRepos: GitHubRepo[]
  selectedRepo: string
  onSelectRepo: (fullName: string) => void
  reposLoadingMore: boolean
  onScroll: (e: React.UIEvent<HTMLDivElement>) => void
  onRetry: () => void
}) {
  return (
    <div>
      <label className="block text-[11px] font-medium text-muted-foreground mb-1.5">Repository</label>
      <input
        type="text"
        placeholder="Search repositories..."
        value={searchQuery}
        onChange={(e) => onSearchChange(e.target.value)}
        disabled={reposLoading}
        className="mb-2 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
      />
      <div
        className="border border-border rounded-md overflow-hidden max-h-[220px] overflow-y-auto"
        onScroll={onScroll}
      >
        {reposLoading ? (
          <div className="p-3 text-center">
            <div className="w-4 h-4 border-2 border-muted border-t-foreground rounded-full animate-spin mx-auto" />
            <p className="text-[11px] text-muted-foreground mt-1.5">Loading...</p>
          </div>
        ) : reposError ? (
          <div className="p-3 text-center">
            <p className="text-[11px] text-destructive mb-1.5">{reposError}</p>
            <button type="button" onClick={onRetry} className="text-[11px] text-muted-foreground hover:text-foreground underline">
              Try again
            </button>
          </div>
        ) : filteredRepos.length === 0 ? (
          <div className="p-3 text-center">
            <p className="text-[11px] text-muted-foreground">
              {searchQuery ? 'No matching repositories' : 'No repositories found'}
            </p>
          </div>
        ) : (
          <CreateSessionRepoList
            repos={filteredRepos}
            selectedRepo={selectedRepo}
            onSelect={onSelectRepo}
            isLoadingMore={reposLoadingMore}
          />
        )}
      </div>
    </div>
  )
}
