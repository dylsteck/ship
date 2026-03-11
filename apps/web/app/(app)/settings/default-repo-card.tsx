'use client'

import { useState, useEffect, useMemo } from 'react'
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@ship/ui'
import { RepoSelector } from '@/components/repo-selector'
import { useSetDefaultRepo, useDefaultRepo } from '@/lib/api/hooks/use-default-repo'
import type { GitHubRepo } from '@/lib/api/types'

interface DefaultRepoCardProps {
  userId: string
  repos: GitHubRepo[]
  reposLoading: boolean
  reposLoadMore: () => void
  reposHasMore: boolean
  reposLoadingMore: boolean
  defaultRepoFullName: string | null
}

export function DefaultRepoCard({
  userId,
  repos,
  reposLoading,
  reposLoadMore,
  reposHasMore,
  reposLoadingMore,
  defaultRepoFullName,
}: DefaultRepoCardProps) {
  const [selected, setSelected] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false)
  const { setDefaultRepo, isSetting } = useSetDefaultRepo()
  const { mutate } = useDefaultRepo(userId)

  useEffect(() => {
    if (defaultRepoFullName && !selected) {
      setSelected(defaultRepoFullName)
    }
  }, [defaultRepoFullName, selected])

  const selectedRepoObj = useMemo(
    () => (selected ? repos.find((r) => r.fullName === selected) ?? null : null),
    [repos, selected],
  )

  const hasChanges = selected !== (defaultRepoFullName || '')

  const handleSave = async () => {
    try {
      setSaveSuccess(false)
      setError(null)
      await setDefaultRepo({ userId, repoFullName: selected })
      mutate()
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    }
  }

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Default Repository</CardTitle>
        <CardDescription className="text-xs">
          Choose which repo is pre-selected when starting new sessions
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">Repository</label>
          <RepoSelector
            repos={repos}
            selectedRepo={selectedRepoObj}
            onRepoSelect={(repo) => setSelected(repo.fullName)}
            onClear={() => setSelected('')}
            allowNone
            isLoading={reposLoading}
            loadMore={reposLoadMore}
            hasMore={reposHasMore}
            isLoadingMore={reposLoadingMore}
            disabled={isSetting}
            placeholder="Select a repository"
            fullWidth
          />
        </div>
        {selected && (
          <div className="text-xs text-muted-foreground">
            Selected: <span className="font-mono text-foreground/80">{selected}</span>
          </div>
        )}
        {error && (
          <div className="rounded-md bg-destructive/10 px-3 py-2">
            <p className="text-xs text-destructive">{error}</p>
          </div>
        )}
        {saveSuccess && (
          <div className="rounded-md bg-emerald-500/10 px-3 py-2">
            <p className="text-xs text-emerald-600">Saved!</p>
          </div>
        )}
        <div className="flex justify-end pt-1">
          <Button size="sm" onClick={handleSave} disabled={!hasChanges || isSetting}>
            {isSetting ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
