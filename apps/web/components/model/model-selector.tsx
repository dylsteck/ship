'use client'

import { useEffect, useState } from 'react'
import { Select, SelectGroup, SelectItem, Badge, cn } from '@ship/ui'

export interface ModelInfo {
  id: string
  name: string
  provider: string
  description?: string
}

interface ModelSelectorProps {
  value: string
  onChange: (modelId: string) => void
  disabled?: boolean
  availableModels?: ModelInfo[]
  placeholder?: string
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8787'

export function ModelSelector({
  value,
  onChange,
  disabled = false,
  availableModels: providedModels,
  placeholder = 'Select a model',
}: ModelSelectorProps) {
  const [models, setModels] = useState<ModelInfo[]>(providedModels || [])
  const [loading, setLoading] = useState(!providedModels)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (providedModels) {
      setModels(providedModels)
      setLoading(false)
      return
    }

    async function fetchModels() {
      try {
        setLoading(true)
        const res = await fetch(`${API_URL}/models/available`)
        if (!res.ok) throw new Error('Failed to fetch models')
        setModels(await res.json())
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load')
      } finally {
        setLoading(false)
      }
    }
    fetchModels()
  }, [providedModels])

  if (loading) {
    return (
      <Select value="" onValueChange={() => {}} disabled>
        <SelectItem value="">Loading models...</SelectItem>
      </Select>
    )
  }

  if (error) {
    return (
      <Select value="" onValueChange={() => {}} disabled>
        <SelectItem value="">Error loading models</SelectItem>
      </Select>
    )
  }

  if (models.length === 0) {
    return (
      <Select value="" onValueChange={() => {}} disabled>
        <SelectItem value="">No models available</SelectItem>
      </Select>
    )
  }

  const groupedModels = models.reduce<Record<string, ModelInfo[]>>((acc, model) => {
    if (!acc[model.provider]) acc[model.provider] = []
    acc[model.provider].push(model)
    return acc
  }, {})

  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectItem value="">{placeholder}</SelectItem>
      {Object.entries(groupedModels).map(([provider, providerModels]) => (
        <SelectGroup key={provider} label={provider}>
          {providerModels.map((model) => (
            <SelectItem key={model.id} value={model.id}>{model.name}</SelectItem>
          ))}
        </SelectGroup>
      ))}
    </Select>
  )
}

export function ModelBadge({ modelId, modelName, className = '' }: { modelId: string; modelName?: string; className?: string }) {
  const provider = modelId.split('/')[0] || 'Unknown'
  const displayName = modelName || modelId.split('/')[1] || modelId

  return (
    <Badge variant="secondary" className={cn('gap-1', className)}>
      <span className="font-semibold">{provider}</span>
      <span className="opacity-40">/</span>
      <span>{displayName}</span>
    </Badge>
  )
}
