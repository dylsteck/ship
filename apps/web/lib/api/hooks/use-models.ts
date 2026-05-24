'use client'

import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  getModelsAvailable,
  getModelsDefault,
  getModelsDefaultAgentModel,
  getModelsSessionsBySessionId,
  postModelsDefault,
  postModelsDefaultAgentModel,
  postModelsSessionsBySessionId,
  unwrapSdkData,
  type ModelInfo,
} from '@ship/sdk'
import { modelsWithFallback } from '../acp-catalog'
import { queryKeys } from '../query-keys'

const PROVIDER_ORDER = ['ACP — OpenCode', 'ACP — Cursor', 'ACP — Claude', 'ACP — Codex', 'Other']

export function useModels(fetchEnabled = true) {
  const { data, error, isLoading, refetch } = useQuery({
    queryKey: queryKeys.models,
    queryFn: async () => unwrapSdkData(await getModelsAvailable()),
    enabled: fetchEnabled,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  })
  const models = fetchEnabled ? modelsWithFallback(data) : []

  const groupedByProvider = (() => {
    const grouped = models.reduce<Record<string, ModelInfo[]>>((acc, model) => {
      const provider = model.provider || 'Other'
      if (!acc[provider]) acc[provider] = []
      acc[provider].push(model)
      return acc
    }, {})

    const sortedGrouped = PROVIDER_ORDER.reduce<Record<string, ModelInfo[]>>((acc, provider) => {
      if (grouped[provider]?.length > 0) acc[provider] = grouped[provider]
      return acc
    }, {})

    Object.entries(grouped).forEach(([provider, list]) => {
      if (!sortedGrouped[provider] && list.length > 0) sortedGrouped[provider] = list
    })

    return sortedGrouped
  })()

  return {
    models,
    groupedByProvider,
    isLoading,
    isError: !!error && !models.length,
    error,
    mutate: refetch,
  }
}

export function useDefaultModel(fetchEnabled: boolean | undefined) {
  const { data, error, isLoading, refetch } = useQuery({
    queryKey: queryKeys.modelsDefault,
    queryFn: async () => {
      try {
        return unwrapSdkData(await getModelsDefault())
      } catch (err: unknown) {
        if ((err as { status?: number })?.status === 404) return null
        throw err
      }
    },
    enabled: Boolean(fetchEnabled),
  })

  return {
    defaultModelId: data?.model ?? null,
    isLoading,
    isError: !!error,
    error,
    mutate: refetch,
  }
}

export function useSessionModel(sessionId: string | undefined) {
  const { data, error, isLoading, refetch } = useQuery({
    queryKey: queryKeys.sessionModel(sessionId ?? ''),
    queryFn: async () => {
      try {
        return unwrapSdkData(await getModelsSessionsBySessionId({ path: { sessionId: sessionId! } }))
      } catch (err: unknown) {
        if ((err as { status?: number })?.status === 404) return null
        throw err
      }
    },
    enabled: Boolean(sessionId),
  })

  return {
    sessionModelId: data?.model ?? null,
    isLoading,
    isError: !!error,
    error,
    mutate: refetch,
  }
}

export function useAgentDefaultModel(agentId: string | undefined, fetchEnabled: boolean | undefined) {
  const { data, error, isLoading, refetch } = useQuery({
    queryKey: queryKeys.agentDefaultModel(agentId ?? ''),
    queryFn: async () => {
      try {
        return unwrapSdkData(await getModelsDefaultAgentModel({ query: { agentId: agentId! } }))
      } catch (err: unknown) {
        if ((err as { status?: number })?.status === 404) return { model: null }
        throw err
      }
    },
    enabled: Boolean(fetchEnabled && agentId),
  })

  return {
    defaultModelId: data?.model ?? null,
    isLoading,
    isError: !!error,
    error,
    mutate: refetch,
  }
}

export function useAgentDefaultModels(agentIds: string[], fetchEnabled: boolean | undefined) {
  const results = useQueries({
    queries: agentIds.map((agentId) => ({
      queryKey: queryKeys.agentDefaultModel(agentId),
      queryFn: async () => {
        try {
          const response = unwrapSdkData(await getModelsDefaultAgentModel({ query: { agentId } }))
          return [agentId, response.model ?? null] as const
        } catch (err: unknown) {
          if ((err as { status?: number })?.status === 404) return [agentId, null] as const
          throw err
        }
      },
      enabled: Boolean(fetchEnabled),
      staleTime: 60_000,
      refetchOnWindowFocus: false,
    })),
  })

  const isLoading = results.some((r) => r.isLoading)
  const error = results.find((r) => r.error)?.error ?? null
  const defaultModelIdsByAgent = Object.fromEntries(
    results.flatMap((r) => (r.data ? [r.data] : [])),
  ) as Record<string, string | null>

  const refetch = async () => {
    await Promise.all(results.map((r) => r.refetch()))
  }

  return {
    defaultModelIdsByAgent,
    isLoading,
    isError: !!error,
    error,
    mutate: refetch,
  }
}

export function useSetAgentDefaultModel() {
  const queryClient = useQueryClient()
  const mutation = useMutation({
    mutationFn: async (arg: { agentId: string; modelId: string }) =>
      unwrapSdkData(
        await postModelsDefaultAgentModel({
          body: { agentId: arg.agentId, model: arg.modelId },
        }),
      ),
    onSuccess: (_data, arg) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.agentDefaultModel(arg.agentId) })
    },
  })

  return { setAgentDefaultModel: mutation.mutateAsync, isSetting: mutation.isPending, error: mutation.error }
}

export function useSetDefaultModel() {
  const queryClient = useQueryClient()
  const mutation = useMutation({
    mutationFn: async (arg: { modelId: string }) =>
      unwrapSdkData(await postModelsDefault({ body: { model: arg.modelId } })),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.modelsDefault })
    },
  })

  return { setDefaultModel: mutation.mutateAsync, isSetting: mutation.isPending, error: mutation.error }
}

export function useSetSessionModel() {
  const queryClient = useQueryClient()
  const mutation = useMutation({
    mutationFn: async (arg: { sessionId: string; modelId: string }) =>
      unwrapSdkData(
        await postModelsSessionsBySessionId({
          path: { sessionId: arg.sessionId },
          body: { model: arg.modelId },
        }),
      ),
    onSuccess: (_data, arg) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.sessionModel(arg.sessionId) })
    },
  })

  return { setSessionModel: mutation.mutateAsync, isSetting: mutation.isPending, error: mutation.error }
}
