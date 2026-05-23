'use client'

import useSWR from 'swr'
import useSWRMutation from 'swr/mutation'
import { fetcher, apiUrl, post } from '../client'
import type { ModelInfo, DefaultModelResponse } from '../types'
import { modelsWithFallback } from '../acp-catalog'

// Provider display order — sandbox ACP backends surface as distinct providers for grouping.
const PROVIDER_ORDER = ['ACP — OpenCode', 'ACP — Cursor', 'ACP — Claude', 'ACP — Codex', 'Other']

/**
 * Hook to fetch available ACP backends (`ship-acp-*`) as models for pickers.
 *
 * @param fetchEnabled - When `false`, skips the request (e.g. not logged in).
 */
export function useModels(fetchEnabled = true) {
  const { data, error, isLoading, mutate } = useSWR<ModelInfo[]>(
    fetchEnabled ? apiUrl('/models/available') : null,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 60000, // Cache for 1 minute
    },
  )
  const models = fetchEnabled ? modelsWithFallback(data) : []

  // Group models by provider with guaranteed order
  const groupedByProvider = (() => {
    const grouped = models.reduce<Record<string, ModelInfo[]>>((acc, model) => {
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
    models,
    groupedByProvider,
    isLoading,
    isError: !!error && !models.length,
    error,
    mutate,
  }
}

/**
 * Hook to fetch the JWT user's default model preference.
 */
export function useDefaultModel(fetchEnabled: boolean | undefined) {
  const { data, error, isLoading, mutate } = useSWR<DefaultModelResponse | null>(
    fetchEnabled ? apiUrl('/models/default') : null,
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
 * Hook to fetch the JWT user's default model for a specific agent (`agentId` query param).
 */
export function useAgentDefaultModel(agentId: string | undefined, fetchEnabled: boolean | undefined) {
  const { data, error, isLoading, mutate } = useSWR<{ model: string | null }>(
    fetchEnabled && agentId ? apiUrl('/models/default-agent-model', { agentId }) : null,
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
    async (_key: string, { arg }: { arg: { agentId: string; modelId: string } }) => {
      return post<{ agentId: string; model: string }, { success: boolean; model: string }>(
        apiUrl('/models/default-agent-model'),
        {
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
    async (_key: string, { arg }: { arg: { modelId: string } }) => {
      return post<{ model: string }, DefaultModelResponse>(apiUrl('/models/default'), {
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
 * Mutation hook to set the active model for a chat session.
 */
export function useSetSessionModel() {
  const { trigger, isMutating, error } = useSWRMutation(
    'set-session-model',
    async (_key: string, { arg }: { arg: { sessionId: string; modelId: string } }) => {
      return post<{ model: string }, { success: boolean; model: string }>(apiUrl(`/models/sessions/${arg.sessionId}`), {
        model: arg.modelId,
      })
    },
  )

  return {
    setSessionModel: trigger,
    isSetting: isMutating,
    error,
  }
}
