'use client'

import { Select, SelectGroup, SelectItem, Badge, cn } from '@ship/ui'
import { useModels, type ModelInfo } from '@/lib/api'

// Re-export type for backward compatibility
export type { ModelInfo }

interface ModelSelectorProps {
  value: string
  onChange: (modelId: string) => void
  disabled?: boolean
  availableModels?: ModelInfo[]
  placeholder?: string
}

export function ModelSelector({
  value,
  onChange,
  disabled = false,
  availableModels: providedModels,
  placeholder = 'Select a model',
}: ModelSelectorProps) {
  // Use SWR hook if no models provided
  const { models: fetchedModels, groupedByProvider, isLoading, isError } = useModels()
  
  // Use provided models or fetched models
  const models = providedModels || fetchedModels

  if (isLoading && !providedModels) {
    return (
      <Select value="" onValueChange={() => {}} disabled>
        <SelectItem value="">Loading models...</SelectItem>
      </Select>
    )
  }

  if (isError && !providedModels) {
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

  // Use pre-grouped if from hook, otherwise group manually
  const groupedModels = providedModels 
    ? models.reduce<Record<string, ModelInfo[]>>((acc, model) => {
        if (!acc[model.provider]) acc[model.provider] = []
        acc[model.provider].push(model)
        return acc
      }, {})
    : groupedByProvider

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
