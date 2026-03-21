'use client'

import { useState, useEffect, useMemo } from 'react'
import {
  Button,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectGroup,
  SelectLabel,
  SelectItem,
} from '@ship/ui'
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

  // Group repos by owner
  const groupedRepos = useMemo(() => {
    const groups: Record<string, GitHubRepo[]> = {}
    for (const repo of repos) {
      const owner = repo.fullName.split('/')[0] || 'Other'
      if (!groups[owner]) groups[owner] = []
      groups[owner].push(repo)
    }
    return groups
  }, [repos])

  return (
    <div className="px-4 py-4">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">Default Repository</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Choose which repo is pre-selected when starting new sessions
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Select
            value={selected || '__none__'}
            onValueChange={(val) => setSelected(val === '__none__' ? '' : (val ?? ''))}
            disabled={isSetting || reposLoading}
          >
            <SelectTrigger className="min-w-[140px] max-w-[200px]">
              <SelectValue placeholder={reposLoading ? 'Loading...' : 'Select repo'} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">
                <span className="text-muted-foreground">None</span>
              </SelectItem>
              {Object.entries(groupedRepos).map(([owner, ownerRepos]) => {
                const singleGroup = Object.keys(groupedRepos).length === 1
                return (
                  <SelectGroup key={owner}>
                    {!singleGroup && <SelectLabel>{owner}</SelectLabel>}
                    {ownerRepos.map((repo) => (
                      <SelectItem key={repo.id} value={repo.fullName}>
                        {repo.fullName}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                )
              })}
            </SelectContent>
          </Select>
          {hasChanges && (
            <Button size="sm" variant="outline" onClick={handleSave} disabled={isSetting} className="h-7 text-xs">
              {isSetting ? 'Saving...' : 'Save'}
            </Button>
          )}
        </div>
      </div>
      {error && (
        <div className="mt-2 rounded-md bg-destructive/10 px-3 py-1.5">
          <p className="text-xs text-destructive">{error}</p>
        </div>
      )}
      {saveSuccess && (
        <div className="mt-2 rounded-md bg-emerald-500/10 px-3 py-1.5">
          <p className="text-xs text-emerald-600">Saved!</p>
        </div>
      )}
    </div>
  )
}
