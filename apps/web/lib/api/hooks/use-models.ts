'use client'

import useSWR from 'swr'
import useSWRMutation from 'swr/mutation'
import { fetcher, apiUrl, post } from '../client'
import type { ModelInfo, DefaultModelResponse } from '../types'

// Provider display order - OpenCode Zen first, Bankr before direct providers
const PROVIDER_ORDER = ['OpenCode Zen', 'Bankr', 'Anthropic', 'OpenAI', 'Google', 'Other']

/**
 * Hook to fetch available AI models
 * When userId is provided, conditionally includes Bankr models based on user preference
 */
export function useModels(userId?: string) {
  const { data, error, isLoading, mutate } = useSWR<ModelInfo[]>(
    apiUrl('/models/available', userId ? { userId } : undefined),
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 60000, // Cache for 1 minute
    },
  )

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
 * Hook to fetch the effective model for a specific session.
 */
export function useSessionModel(sessionId: string | undefined) {
  const { data, error, isLoading, mutate } = useSWR<{ model: string; override: boolean } | null>(
    sessionId ? apiUrl(`/models/sessions/${sessionId}`) : null,
    async (url: string) => {
      try {
        return await fetcher<{ model: string; override: boolean }>(url)
      } catch (err: unknown) {
        if ((err as { status?: number })?.status === 404) return null
        throw err
      }
    },
  )

  return {
    sessionModelId: data?.model ?? null,
    isLoading,
    isError: !!error,
    error,
    mutate,
  }
}

/**
 * Hook to fetch user's default model for a specific agent
 */
export function useAgentDefaultModel(userId: string | undefined, agentId: string | undefined) {
  const { data, error, isLoading, mutate } = useSWR<{ model: string | null }>(
    userId && agentId ? apiUrl('/models/default-agent-model', { userId, agentId }) : null,
    async (url: string) => {
      try {
        return await fetcher<{ model: string | null }>(url)
      } catch (err: unknown) {
        if ((err as { status?: number })?.status === 404) return { model: null }
        throw err
      }
    },
  )

  return {
    defaultModelId: data?.model ?? null,
    isLoading,
    isError: !!error,
    error,
    mutate,
  }
}

/**
 * Mutation hook to set user's default model for a specific agent
 */
export function useSetAgentDefaultModel() {
  const { trigger, isMutating, error } = useSWRMutation(
    'set-agent-default-model',
    async (_key: string, { arg }: { arg: { userId: string; agentId: string; modelId: string } }) => {
      return post<{ userId: string; agentId: string; model: string }, { success: boolean; model: string }>(
        apiUrl('/models/default-agent-model'),
        {
          userId: arg.userId,
          agentId: arg.agentId,
          model: arg.modelId,
        },
      )
    },
  )

  return {
    setAgentDefaultModel: trigger,
    isSetting: isMutating,
    error,
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

/**
 * Hook to fetch user's Bankr preference
 */
export function useBankrEnabled(userId: string | undefined) {
  const { data, error, isLoading, mutate } = useSWR<{ enabled: boolean }>(
    userId ? apiUrl('/models/bankr', { userId }) : null,
    fetcher,
    { revalidateOnFocus: false },
  )

  return {
    bankrEnabled: data?.enabled ?? false,
    isLoading,
    isError: !!error,
    error,
    mutate,
  }
}

/**
 * Mutation hook to toggle Bankr on/off
 */
export function useSetBankrEnabled() {
  const { trigger, isMutating, error } = useSWRMutation(
    'set-bankr-enabled',
    async (_key: string, { arg }: { arg: { userId: string; enabled: boolean } }) => {
      return post<{ userId: string; enabled: boolean }, { success: boolean; enabled: boolean }>(
        apiUrl('/models/bankr'),
        { userId: arg.userId, enabled: arg.enabled },
      )
    },
  )

  return {
    setBankrEnabled: trigger,
    isSetting: isMutating,
    error,
  }
}
