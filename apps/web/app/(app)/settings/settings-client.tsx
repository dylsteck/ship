'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import { ModelSelector, ModelBadge } from '@/components/model/model-selector'
import { RepoSelector } from '@/components/repo-selector'
import { ConnectorSettings } from '@/components/settings/connector-settings'
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@ship/ui'
import {
  useModels,
  useDefaultModel,
  useSetDefaultModel,
  useFilteredGitHubRepos,
  useDefaultRepo,
  useSetDefaultRepo,
} from '@/lib/api'

export function SettingsClient({ userId }: { userId: string }) {
  const [selectedModel, setSelectedModel] = useState<string>('')
  const [selectedRepo, setSelectedRepo] = useState<string>('')
  const [modelError, setModelError] = useState<string | null>(null)
  const [repoError, setRepoError] = useState<string | null>(null)
  const [modelSaveSuccess, setModelSaveSuccess] = useState(false)
  const [repoSaveSuccess, setRepoSaveSuccess] = useState(false)

  // Model hooks
  const { models: availableModels, isLoading: modelsLoading } = useModels()
  const { defaultModelId, isLoading: defaultModelLoading, mutate: mutateDefaultModel } = useDefaultModel(userId)
  const { setDefaultModel: saveDefaultModel, isSetting: isSettingModel } = useSetDefaultModel()

  // Repo hooks (paginated, cached)
  const {
    repos,
    isLoading: reposLoading,
    loadMore: reposLoadMore,
    hasMore: reposHasMore,
    isLoadingMore: reposLoadingMore,
  } = useFilteredGitHubRepos(userId, '')
  const { defaultRepoFullName, isLoading: defaultRepoLoading, mutate: mutateDefaultRepo } = useDefaultRepo(userId)
  const { setDefaultRepo: saveDefaultRepo, isSetting: isSettingRepo } = useSetDefaultRepo()

  const selectedRepoObj = useMemo(
    () => (selectedRepo ? repos.find((r) => r.fullName === selectedRepo) ?? null : null),
    [repos, selectedRepo]
  )

  const loading = modelsLoading || defaultModelLoading || reposLoading || defaultRepoLoading

  // Sync selected model with saved default
  useEffect(() => {
    if (defaultModelId && !selectedModel) {
      setSelectedModel(defaultModelId)
    }
  }, [defaultModelId, selectedModel])

  // Sync selected repo with saved default
  useEffect(() => {
    if (defaultRepoFullName && !selectedRepo) {
      setSelectedRepo(defaultRepoFullName)
    }
  }, [defaultRepoFullName, selectedRepo])

  const handleSaveModel = async () => {
    try {
      setModelSaveSuccess(false)
      setModelError(null)
      await saveDefaultModel({ userId, modelId: selectedModel })
      mutateDefaultModel()
      setModelSaveSuccess(true)
      setTimeout(() => setModelSaveSuccess(false), 3000)
    } catch (err) {
      setModelError(err instanceof Error ? err.message : 'Failed to save')
    }
  }

  const handleSaveRepo = async () => {
    try {
      setRepoSaveSuccess(false)
      setRepoError(null)
      await saveDefaultRepo({ userId, repoFullName: selectedRepo })
      mutateDefaultRepo()
      setRepoSaveSuccess(true)
      setTimeout(() => setRepoSaveSuccess(false), 3000)
    } catch (err) {
      setRepoError(err instanceof Error ? err.message : 'Failed to save')
    }
  }

  const modelHasChanges = selectedModel !== (defaultModelId || '')
  const repoHasChanges = selectedRepo !== (defaultRepoFullName || '')

  if (loading) {
    return (
      <div className="min-h-screen bg-muted/30">
        <header className="h-11 border-b border-border bg-background">
          <div className="h-full flex items-center px-4">
            <Link href="/" className="flex items-center gap-2">
              <span className="text-[13px] font-semibold text-foreground">Ship</span>
            </Link>
          </div>
        </header>
        <div className="flex items-center justify-center py-24">
          <div className="w-4 h-4 border-2 border-muted border-t-foreground rounded-full animate-spin"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="h-11 border-b border-border bg-background">
        <div className="h-full flex items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-[13px] font-semibold text-foreground">Ship</span>
          </Link>
          <a
            href="/api/auth/logout"
            className="text-[12px] text-muted-foreground hover:text-foreground transition-colors"
          >
            Logout
          </a>
        </div>
      </header>

      <div className="mx-auto max-w-xl px-4 py-6">
        <h1 className="text-lg font-semibold text-foreground mb-1">Settings</h1>
        <p className="text-[12px] text-muted-foreground mb-5">Manage your preferences</p>

        {/* Default Model */}
        <Card className="mb-4">
          <CardHeader className="pb-3">
            <CardTitle className="text-[14px]">Default Model</CardTitle>
            <CardDescription className="text-[11px]">
              Choose which model is selected by default for new sessions
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <label className="block text-[11px] font-medium text-muted-foreground mb-1.5">Model</label>
              <ModelSelector
                value={selectedModel}
                onChange={setSelectedModel}
                availableModels={availableModels}
                disabled={isSettingModel}
              />
            </div>
            {selectedModel && (
              <div>
                <p className="text-[11px] text-muted-foreground mb-1">Current:</p>
                <ModelBadge
                  modelId={selectedModel}
                  modelName={availableModels.find((m) => m.id === selectedModel)?.name}
                />
              </div>
            )}
            {modelError && (
              <div className="rounded-md bg-destructive/10 px-3 py-2">
                <p className="text-[11px] text-destructive">{modelError}</p>
              </div>
            )}
            {modelSaveSuccess && (
              <div className="rounded-md bg-emerald-500/10 px-3 py-2">
                <p className="text-[11px] text-emerald-600">Saved!</p>
              </div>
            )}
            <div className="flex justify-end pt-1">
              <Button size="sm" onClick={handleSaveModel} disabled={!modelHasChanges || isSettingModel}>
                {isSettingModel ? 'Saving...' : 'Save'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Default Repo */}
        <Card className="mb-4">
          <CardHeader className="pb-3">
            <CardTitle className="text-[14px]">Default Repository</CardTitle>
            <CardDescription className="text-[11px]">
              Choose which repo is pre-selected when starting new sessions
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <label className="block text-[11px] font-medium text-muted-foreground mb-1.5">Repository</label>
              <RepoSelector
                repos={repos}
                selectedRepo={selectedRepoObj}
                onRepoSelect={(repo) => setSelectedRepo(repo.fullName)}
                onClear={() => setSelectedRepo('')}
                allowNone
                isLoading={reposLoading}
                loadMore={reposLoadMore}
                hasMore={reposHasMore}
                isLoadingMore={reposLoadingMore}
                disabled={isSettingRepo}
                placeholder="Select a repository"
                fullWidth
              />
            </div>
            {selectedRepo && (
              <div className="text-[11px] text-muted-foreground">
                Selected: <span className="font-mono text-foreground/80">{selectedRepo}</span>
              </div>
            )}
            {repoError && (
              <div className="rounded-md bg-destructive/10 px-3 py-2">
                <p className="text-[11px] text-destructive">{repoError}</p>
              </div>
            )}
            {repoSaveSuccess && (
              <div className="rounded-md bg-emerald-500/10 px-3 py-2">
                <p className="text-[11px] text-emerald-600">Saved!</p>
              </div>
            )}
            <div className="flex justify-end pt-1">
              <Button size="sm" onClick={handleSaveRepo} disabled={!repoHasChanges || isSettingRepo}>
                {isSettingRepo ? 'Saving...' : 'Save'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Integrations */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-[14px]">Integrations</CardTitle>
            <CardDescription className="text-[11px]">Connect external services</CardDescription>
          </CardHeader>
          <CardContent>
            <ConnectorSettings userId={userId} />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
