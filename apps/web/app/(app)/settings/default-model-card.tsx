'use client'

import { useState, useEffect } from 'react'
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

  // Group models by provider
  const groupedModels = models.reduce<Record<string, ModelInfo[]>>((acc, model) => {
    if (!acc[model.provider]) acc[model.provider] = []
    acc[model.provider].push(model)
    return acc
  }, {})

  return (
    <div className="px-4 py-4">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">Default Model</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Choose which model is selected by default for new sessions
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Select
            value={selected}
            onValueChange={(val) => val && setSelected(val)}
            disabled={isSetting}
          >
            <SelectTrigger className="min-w-[140px]">
              <SelectValue placeholder="Select model" />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(groupedModels).map(([provider, providerModels]) => {
                const singleGroup = Object.keys(groupedModels).length === 1
                return (
                  <SelectGroup key={provider}>
                    {!singleGroup && <SelectLabel className="capitalize">{provider}</SelectLabel>}
                    {providerModels.map((model) => (
                      <SelectItem key={model.id} value={model.id}>
                        {model.name}
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
