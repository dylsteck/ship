'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ModelSelector, ModelBadge } from '@/components/model/model-selector'
import { ConnectorSettings } from '@/components/settings/connector-settings'
import { Button, Card, CardHeader, CardTitle, CardDescription, CardContent } from '@ship/ui'
import { useModels, useDefaultModel, useSetDefaultModel } from '@/lib/api'

export function SettingsClient({ userId }: { userId: string }) {
  const [selectedModel, setSelectedModel] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)

  // Use SWR hooks
  const { models: availableModels, isLoading: modelsLoading } = useModels()
  const { defaultModelId, isLoading: defaultLoading, mutate: mutateDefault } = useDefaultModel(userId)
  const { setDefaultModel: saveDefaultModel, isSetting } = useSetDefaultModel()

  const loading = modelsLoading || defaultLoading

  // Sync selected model with default model when loaded
  useEffect(() => {
    if (defaultModelId && !selectedModel) {
      setSelectedModel(defaultModelId)
    }
  }, [defaultModelId, selectedModel])

  const handleSave = async () => {
    try {
      setSaveSuccess(false)
      setError(null)
      await saveDefaultModel({ userId, modelId: selectedModel })
      mutateDefault() // Refresh default model
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    }
  }

  const hasChanges = selectedModel !== (defaultModelId || '')

  if (loading) {
    return (
      <div className="min-h-screen bg-muted/30">
        <header className="h-11 border-b border-border bg-background">
          <div className="h-full flex items-center px-4">
            <Link href="/dashboard" className="flex items-center gap-2">
              <div className="w-5 h-5 bg-foreground rounded flex items-center justify-center">
                <svg className="w-3 h-3 text-background" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                </svg>
              </div>
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
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="w-5 h-5 bg-foreground rounded flex items-center justify-center">
              <svg className="w-3 h-3 text-background" fill="currentColor" viewBox="0 0 20 20">
                <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
              </svg>
            </div>
            <span className="text-[13px] font-semibold text-foreground">Ship</span>
          </Link>
          <a href="/api/auth/logout" className="text-[12px] text-muted-foreground hover:text-foreground transition-colors">
            Logout
          </a>
        </div>
      </header>

      <div className="mx-auto max-w-xl px-4 py-6">
        <Link href="/dashboard" className="inline-flex items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground transition-colors mb-4">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Dashboard
        </Link>

        <h1 className="text-lg font-semibold text-foreground mb-1">Settings</h1>
        <p className="text-[12px] text-muted-foreground mb-5">Manage your preferences</p>

        <Card className="mb-4">
          <CardHeader className="pb-3">
            <CardTitle className="text-[14px]">AI Model</CardTitle>
            <CardDescription className="text-[11px]">Choose your default model</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <label className="block text-[11px] font-medium text-muted-foreground mb-1.5">Default Model</label>
              <ModelSelector value={selectedModel} onChange={setSelectedModel} availableModels={availableModels} disabled={isSetting} />
            </div>
            {selectedModel && (
              <div>
                <p className="text-[11px] text-muted-foreground mb-1">Current:</p>
                <ModelBadge modelId={selectedModel} modelName={availableModels.find((m) => m.id === selectedModel)?.name} />
              </div>
            )}
            {error && <div className="rounded-md bg-destructive/10 px-3 py-2"><p className="text-[11px] text-destructive">{error}</p></div>}
            {saveSuccess && <div className="rounded-md bg-emerald-500/10 px-3 py-2"><p className="text-[11px] text-emerald-600">Saved!</p></div>}
            <div className="flex justify-end pt-1">
              <Button size="sm" onClick={handleSave} disabled={!hasChanges || isSetting}>
                {isSetting ? 'Saving...' : 'Save'}
              </Button>
            </div>
          </CardContent>
        </Card>

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
