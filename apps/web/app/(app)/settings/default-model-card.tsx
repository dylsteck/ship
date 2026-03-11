'use client'

import { useState, useEffect } from 'react'
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@ship/ui'
import { ModelSelector, ModelBadge } from '@/components/model/model-selector'
import { useSetDefaultModel, useDefaultModel } from '@/lib/api/hooks/use-models'
import type { ModelInfo } from '@/lib/api/types'

interface DefaultModelCardProps {
  userId: string
  models: ModelInfo[]
  defaultModelId: string | null
}

export function DefaultModelCard({ userId, models, defaultModelId }: DefaultModelCardProps) {
  const [selected, setSelected] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false)
  const { setDefaultModel, isSetting } = useSetDefaultModel()
  const { mutate } = useDefaultModel(userId)

  useEffect(() => {
    if (defaultModelId && !selected) {
      setSelected(defaultModelId)
    }
  }, [defaultModelId, selected])

  const hasChanges = selected !== (defaultModelId || '')

  const handleSave = async () => {
    try {
      setSaveSuccess(false)
      setError(null)
      await setDefaultModel({ userId, modelId: selected })
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
        <CardTitle className="text-sm">Default Model</CardTitle>
        <CardDescription className="text-xs">
          Choose which model is selected by default for new sessions
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">Model</label>
          <ModelSelector
            value={selected}
            onChange={setSelected}
            availableModels={models}
            disabled={isSetting}
          />
        </div>
        {selected && (
          <div>
            <p className="text-xs text-muted-foreground mb-1">Current:</p>
            <ModelBadge
              modelId={selected}
              modelName={models.find((m) => m.id === selected)?.name}
            />
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
