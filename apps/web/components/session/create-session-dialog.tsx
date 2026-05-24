'use client'

import { useState, useTransition, useCallback } from 'react'
import { useFilteredGitHubRepos } from '@/lib/api'
import { CreateSessionDialogShell } from './create-session-dialog-shell'

interface CreateSessionDialogProps {
  isOpen: boolean
  onClose: () => void
  onCreate: (data: { repoOwner: string; repoName: string; model?: string }) => Promise<void>
}

export function CreateSessionDialog({ isOpen, onClose, onCreate }: CreateSessionDialogProps) {
  const [selectedRepo, setSelectedRepo] = useState<string>('')
  const [selectedModel, setSelectedModel] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [searchQuery, setSearchQuery] = useState('')

  const {
    repos: filteredRepos,
    isLoading: reposLoading,
    isLoadingMore: reposLoadingMore,
    hasMore: reposHasMore,
    loadMore: reposLoadMore,
    isError,
    mutate,
  } = useFilteredGitHubRepos(isOpen, searchQuery)

  const handleReposScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      const el = e.currentTarget
      const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80
      if (nearBottom && reposHasMore && !reposLoadingMore) {
        reposLoadMore()
      }
    },
    [reposHasMore, reposLoadingMore, reposLoadMore],
  )

  const reposError = isError ? 'Failed to load repositories' : null

  const resetForm = () => {
    setSelectedRepo('')
    setSelectedModel('')
    setSearchQuery('')
    setError(null)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!selectedRepo) {
      setError('Please select a repository')
      return
    }
    const [repoOwner, repoName] = selectedRepo.split('/')
    startTransition(async () => {
      try {
        await onCreate({ repoOwner, repoName, model: selectedModel || undefined })
        resetForm()
        onClose()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to create session')
      }
    })
  }

  const handleClose = () => {
    if (!isPending) {
      resetForm()
      onClose()
    }
  }

  if (!isOpen) return null

  return (
    <CreateSessionDialogShell
      error={error}
      isPending={isPending}
      selectedRepo={selectedRepo}
      selectedModel={selectedModel}
      searchQuery={searchQuery}
      reposLoading={reposLoading ?? false}
      reposError={reposError}
      filteredRepos={filteredRepos}
      reposLoadingMore={reposLoadingMore ?? false}
      onSearchChange={setSearchQuery}
      onSelectRepo={setSelectedRepo}
      onSelectModel={setSelectedModel}
      onScroll={handleReposScroll}
      onRetry={() => mutate()}
      onClose={handleClose}
      onSubmit={handleSubmit}
    />
  )
}
