'use client'

import useSWR from 'swr'
import useSWRMutation from 'swr/mutation'
import { fetcher, apiUrl, post } from '../client'
import type { ModelInfo, DefaultModelResponse } from '../types'

/**
 * Hook to fetch available AI models
 */
export function useModels() {
  const { data, error, isLoading, mutate } = useSWR<ModelInfo[]>(
    apiUrl('/models/available'),
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 60000, // Cache for 1 minute
    }
  )

  // Group models by provider for easy display
  const groupedByProvider = (data ?? []).reduce<Record<string, ModelInfo[]>>(
    (acc, model) => {
      const provider = model.provider || 'Other'
      if (!acc[provider]) acc[provider] = []
      acc[provider].push(model)
      return acc
    },
    {}
  )

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
  const { data, error, isLoading, mutate } = useSWR<DefaultModelResponse>(
    userId ? apiUrl('/models/default', { userId }) : null,
    fetcher
  )

  return {
    defaultModelId: data?.modelId ?? null,
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
      return post<{ userId: string; modelId: string }, DefaultModelResponse>(
        apiUrl('/models/default'),
        arg
      )
    }
  )

  return {
    setDefaultModel: trigger,
    isSetting: isMutating,
    error,
  }
}
