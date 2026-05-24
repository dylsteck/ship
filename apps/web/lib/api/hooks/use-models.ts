'use client'

import useSWR from 'swr'
import useSWRMutation from 'swr/mutation'
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

const PROVIDER_ORDER = ['ACP — OpenCode', 'ACP — Cursor', 'ACP — Claude', 'ACP — Codex', 'Other']

export function useModels(fetchEnabled = true) {
  const { data, error, isLoading, mutate } = useSWR<ModelInfo[]>(
    fetchEnabled ? ['models-available'] : null,
    async () => unwrapSdkData(await getModelsAvailable()),
    { revalidateOnFocus: false, dedupingInterval: 60000 },
  )
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
    mutate,
  }
}

export function useDefaultModel(fetchEnabled: boolean | undefined) {
  const { data, error, isLoading, mutate } = useSWR(
    fetchEnabled ? ['models-default'] : null,
    async () => {
      try {
        return unwrapSdkData(await getModelsDefault())
      } catch (err: unknown) {
        if ((err as { status?: number })?.status === 404) return null
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

export function useSessionModel(sessionId: string | undefined) {
  const { data, error, isLoading, mutate } = useSWR(
    sessionId ? ['session-model', sessionId] : null,
    async () => {
      try {
        return unwrapSdkData(await getModelsSessionsBySessionId({ path: { sessionId: sessionId! } }))
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

export function useAgentDefaultModel(agentId: string | undefined, fetchEnabled: boolean | undefined) {
  const { data, error, isLoading, mutate } = useSWR(
    fetchEnabled && agentId ? ['agent-default-model', agentId] : null,
    async () => {
      try {
        return unwrapSdkData(await getModelsDefaultAgentModel({ query: { agentId: agentId! } }))
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

export function useAgentDefaultModels(agentIds: string[], fetchEnabled: boolean | undefined) {
  const key = fetchEnabled && agentIds.length > 0 ? ['agent-default-models', ...agentIds] : null
  const { data, error, isLoading, mutate } = useSWR<Record<string, string | null>>(
    key,
    async ([, ...ids]: string[]) => {
      const entries = await Promise.all(
        ids.map(async (agentId) => {
          try {
            const response = unwrapSdkData(await getModelsDefaultAgentModel({ query: { agentId } }))
            return [agentId, response.model ?? null] as const
          } catch (err: unknown) {
            if ((err as { status?: number })?.status === 404) return [agentId, null] as const
            throw err
          }
        }),
      )
      return Object.fromEntries(entries)
    },
    { revalidateOnFocus: false },
  )

  return {
    defaultModelIdsByAgent: data ?? {},
    isLoading,
    isError: !!error,
    error,
    mutate,
  }
}

export function useSetAgentDefaultModel() {
  const { trigger, isMutating, error } = useSWRMutation(
    'set-agent-default-model',
    async (_key: string, { arg }: { arg: { agentId: string; modelId: string } }) =>
      unwrapSdkData(
        await postModelsDefaultAgentModel({
          body: { agentId: arg.agentId, model: arg.modelId },
        }),
      ),
  )

  return { setAgentDefaultModel: trigger, isSetting: isMutating, error }
}

export function useSetDefaultModel() {
  const { trigger, isMutating, error } = useSWRMutation(
    'set-default-model',
    async (_key: string, { arg }: { arg: { modelId: string } }) =>
      unwrapSdkData(await postModelsDefault({ body: { model: arg.modelId } })),
  )

  return { setDefaultModel: trigger, isSetting: isMutating, error }
}

export function useSetSessionModel() {
  const { trigger, isMutating, error } = useSWRMutation(
    'set-session-model',
    async (_key: string, { arg }: { arg: { sessionId: string; modelId: string } }) =>
      unwrapSdkData(
        await postModelsSessionsBySessionId({
          path: { sessionId: arg.sessionId },
          body: { model: arg.modelId },
        }),
      ),
  )

  return { setSessionModel: trigger, isSetting: isMutating, error }
}
