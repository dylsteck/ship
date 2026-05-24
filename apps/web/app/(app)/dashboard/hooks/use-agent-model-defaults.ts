'use client'

import { useEffect, useMemo } from 'react'
import { resolveLegacyDefaultModel } from '@/lib/api/acp-catalog'
import { useAgentDefaultModels } from '@/lib/api/hooks/use-models'
import type { AgentInfo, ModelInfo } from '@/lib/api/types'

function findAgentModel(agent: AgentInfo, modelId: string | null | undefined): ModelInfo | null {
  if (!modelId) return null
  return (
    agent.models.find((model) => model.id === modelId || model.id.endsWith(modelId)) ??
    resolveLegacyDefaultModel(modelId, agent.models)
  )
}

function resolveAgentDefaultModel(
  agent: AgentInfo,
  savedModelId: string | null | undefined,
  globalDefaultModelId: string | null | undefined,
): ModelInfo | undefined {
  return (
    findAgentModel(agent, savedModelId) ??
    findAgentModel(agent, globalDefaultModelId) ??
    agent.models.find((model) => model.isDefault) ??
    agent.models[0]
  )
}

/**
 * Resolves saved-or-fallback concrete model defaults for every ACP harness.
 */
export function useAgentModelDefaults({
  agents,
  activeSessionId,
  selectedAgent,
  selectedModel,
  setSelectedModel,
  globalDefaultModelId,
  globalDefaultModelLoading,
}: {
  agents: AgentInfo[]
  activeSessionId: string | null
  selectedAgent: AgentInfo | null
  selectedModel: ModelInfo | null
  setSelectedModel: (model: ModelInfo | null) => void
  globalDefaultModelId: string | null
  globalDefaultModelLoading: boolean
}) {
  const agentIds = useMemo(() => agents.map((agent) => agent.id), [agents])
  const {
    defaultModelIdsByAgent,
    isLoading: agentDefaultModelsLoading,
    mutate,
  } = useAgentDefaultModels(agentIds, agentIds.length > 0)

  const agentDefaultModels = useMemo(() => {
    return Object.fromEntries(
      agents.map((agent) => [
        agent.id,
        resolveAgentDefaultModel(agent, defaultModelIdsByAgent[agent.id], globalDefaultModelId),
      ]),
    ) as Record<string, ModelInfo | undefined>
  }, [agents, defaultModelIdsByAgent, globalDefaultModelId])

  useEffect(() => {
    if (activeSessionId || !selectedAgent || globalDefaultModelLoading || agentDefaultModelsLoading) return
    const defaultModel = agentDefaultModels[selectedAgent.id]
    if (!defaultModel) return

    const selectedBelongsToAgent = selectedAgent.models.some((model) => model.id === selectedModel?.id)
    if (!selectedBelongsToAgent) {
      setSelectedModel(defaultModel)
    }
  }, [
    activeSessionId,
    agentDefaultModels,
    agentDefaultModelsLoading,
    globalDefaultModelLoading,
    selectedAgent,
    selectedModel?.id,
    setSelectedModel,
  ])

  return {
    agentDefaultModels,
    agentDefaultModelsLoading,
    mutateAgentDefaultModels: mutate,
  }
}
