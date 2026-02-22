'use client'

import useSWR from 'swr'
import useSWRMutation from 'swr/mutation'
import { fetcher, apiUrl, post } from '../client'
import type { ModelInfo, DefaultModelResponse } from '../types'

// Provider display order - OpenCode Zen first
const PROVIDER_ORDER = ['OpenCode Zen', 'Anthropic', 'OpenAI', 'Google', 'Other']

/**
 * Hook to fetch available AI models
 */
export function useModels() {
  const { data, error, isLoading, mutate } = useSWR<ModelInfo[]>(apiUrl('/models/available'), fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60000, // Cache for 1 minute
  })

  // Group models by provider with guaranteed order
  const groupedByProvider = (() => {
    const grouped = (data ?? []).reduce<Record<string, ModelInfo[]>>((acc, model) => {
      const provider = model.provider || 'Other'
      if (!acc[provider]) acc[provider] = []
      acc[provider].push(model)
      return acc
    }, {})

    // Sort by provider order
    const sortedGrouped = PROVIDER_ORDER.reduce<Record<string, ModelInfo[]>>((acc, provider) => {
      if (grouped[provider]?.length > 0) {
        acc[provider] = grouped[provider]
      }
      return acc
    }, {})

    // Add any providers not in PROVIDER_ORDER at the end
    Object.entries(grouped).forEach(([provider, models]) => {
      if (!sortedGrouped[provider] && models.length > 0) {
        sortedGrouped[provider] = models
      }
    })

    return sortedGrouped
  })()

  return {
    models: data ?? [],
    groupedByProvider,
    isLoading,
    isError: !!error,
    error,
    mutate,
  }
}

/**
 * Hook to fetch user's default model
 */
export function useDefaultModel(userId: string | undefined) {
  const { data, error, isLoading, mutate } = useSWR<DefaultModelResponse | null>(
    userId ? apiUrl('/models/default', { userId }) : null,
    async (url: string) => {
      try {
        return await fetcher<DefaultModelResponse>(url)
      } catch (err: unknown) {
        if ((err as { status?: number })?.status === 404) return null
        throw err
      }
    },
  )

  return {
    defaultModelId: data?.model ?? data?.modelId ?? null,
    isLoading,
    isError: !!error,
    error,
    mutate,
  }
}

/**
 * Mutation hook to set user's default model
 */
export function useSetDefaultModel() {
  const { trigger, isMutating, error } = useSWRMutation(
    'set-default-model',
    async (_key: string, { arg }: { arg: { userId: string; modelId: string } }) => {
      return post<{ userId: string; model: string }, DefaultModelResponse>(apiUrl('/models/default'), {
        userId: arg.userId,
        model: arg.modelId,
      })
    },
  )

  return {
    setDefaultModel: trigger,
    isSetting: isMutating,
    error,
  }
}
