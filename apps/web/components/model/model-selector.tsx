'use client'

import { useEffect, useState } from 'react'
import { Select, SelectGroup, SelectItem } from '@/components/ui/select'

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
        const data = await res.json()
        setModels(data)
      } catch (err) {
        console.error('Error fetching models:', err)
        setError(err instanceof Error ? err.message : 'Failed to load models')
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

  // Group models by provider
  const groupedModels = models.reduce<Record<string, ModelInfo[]>>((acc, model) => {
    if (!acc[model.provider]) {
      acc[model.provider] = []
    }
    acc[model.provider].push(model)
    return acc
  }, {})

  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectItem value="">{placeholder}</SelectItem>
      {Object.entries(groupedModels).map(([provider, providerModels]) => (
        <SelectGroup key={provider} label={provider}>
          {providerModels.map((model) => (
            <SelectItem key={model.id} value={model.id}>
              {model.name}
            </SelectItem>
          ))}
        </SelectGroup>
      ))}
    </Select>
  )
}

interface ModelBadgeProps {
  modelId: string
  modelName?: string
  className?: string
}

export function ModelBadge({ modelId, modelName, className = '' }: ModelBadgeProps) {
  // Extract provider from model ID (format: provider/model)
  const provider = modelId.split('/')[0] || 'Unknown'
  const displayName = modelName || modelId.split('/')[1] || modelId

  return (
    <div
      className={`inline-flex items-center gap-1.5 rounded-md bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-300 ${className}`}
      title={modelId}
    >
      <span className="font-semibold">{provider}</span>
      <span className="opacity-50">/</span>
      <span>{displayName}</span>
    </div>
  )
}
