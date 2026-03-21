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
import { useAgentDefaultModel, useSetAgentDefaultModel } from '@/lib/api/hooks/use-models'
import type { AgentInfo, ModelInfo } from '@/lib/api/types'

interface AgentModelRowProps {
  userId: string
  agent: AgentInfo
  allModels: ModelInfo[]
}

export function AgentModelRow({ userId, agent, allModels }: AgentModelRowProps) {
  const models = agent.models.length > 0 ? agent.models : allModels
  const { defaultModelId, mutate } = useAgentDefaultModel(userId, agent.id)
  const { setAgentDefaultModel, isSetting } = useSetAgentDefaultModel()
  const [selected, setSelected] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)

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
      await setAgentDefaultModel({ userId, agentId: agent.id, modelId: selected })
      mutate()
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    }
  }

  const groupedModels = useMemo(() => {
    return models.reduce<Record<string, ModelInfo[]>>((acc, model) => {
      const provider = model.provider || 'Other'
      if (!acc[provider]) acc[provider] = []
      acc[provider].push(model)
      return acc
    }, {})
  }, [models])

  return (
    <div className="px-4 py-4">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">{agent.name}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Default model for this agent</p>
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
