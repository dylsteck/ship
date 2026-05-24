'use client'

import { Button, Card } from '@ship/ui'
import { ModelSelector } from '@/components/model/model-selector'
import { CreateSessionRepoPicker } from './create-session-repo-picker'

export function CreateSessionDialogShell({
  error,
  isPending,
  selectedRepo,
  selectedModel,
  searchQuery,
  reposLoading,
  reposError,
  filteredRepos,
  reposLoadingMore,
  onSearchChange,
  onSelectRepo,
  onSelectModel,
  onScroll,
  onRetry,
  onClose,
  onSubmit,
}: {
  error: string | null
  isPending: boolean
  selectedRepo: string
  selectedModel: string
  searchQuery: string
  reposLoading: boolean
  reposError: string | null
  filteredRepos: import('@/lib/api/types').GitHubRepo[]
  reposLoadingMore: boolean
  onSearchChange: (value: string) => void
  onSelectRepo: (fullName: string) => void
  onSelectModel: (value: string) => void
  onScroll: (e: React.UIEvent<HTMLDivElement>) => void
  onRetry: () => void
  onClose: () => void
  onSubmit: (e: React.FormEvent) => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={onClose} />
      <Card className="relative w-full max-w-md shadow-lg">
        <div className="px-4 pt-4 pb-3 border-b border-border">
          <h2 className="text-[15px] font-semibold text-foreground">New Session</h2>
          <p className="mt-0.5 text-[12px] text-muted-foreground">Select a repository to start building</p>
        </div>

        <form onSubmit={onSubmit}>
          <div className="p-4 space-y-3">
            <CreateSessionRepoPicker
              searchQuery={searchQuery}
              onSearchChange={onSearchChange}
              reposLoading={reposLoading}
              reposError={reposError}
              filteredRepos={filteredRepos}
              selectedRepo={selectedRepo}
              onSelectRepo={onSelectRepo}
              reposLoadingMore={reposLoadingMore}
              onScroll={onScroll}
              onRetry={onRetry}
            />

            <div>
              <label className="block text-[11px] font-medium text-muted-foreground mb-1.5">AI Model</label>
              <ModelSelector
                value={selectedModel}
                onChange={onSelectModel}
                disabled={isPending}
                placeholder="Default (Big Pickle)"
              />
            </div>

            {error && (
              <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2">
                <p className="text-[11px] text-destructive">{error}</p>
              </div>
            )}
          </div>

          <div className="px-4 py-3 bg-muted/30 border-t border-border flex items-center justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={isPending}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={isPending || !selectedRepo}>
              {isPending ? 'Creating...' : 'Create Session'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}
