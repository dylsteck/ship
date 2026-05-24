'use client'

import { useCallback } from 'react'
import type { GitHubRepo, ModelInfo, AgentInfo } from '@/lib/api/types'
import { useSetDefaultRepo } from '@/lib/api/hooks/use-default-repo'
import { useSetDefaultAgent } from '@/lib/api/hooks/use-agents'
import { useSetAgentDefaultModel } from '@/lib/api/hooks/use-models'

export interface UseHomepageComposerDefaultsParams {
  activeSessionId: string | null
  selectedAgentId: string | undefined
  setSelectedRepo: (repo: GitHubRepo) => void
  handleAgentSelect: (agent: AgentInfo) => void
  mutateDefaultRepo: () => void
  mutateDefaultAgent: () => void
  mutateAgentDefaultModel: () => void
}

/**
 * Persists homepage composer repo/agent/model picks as the user's saved defaults.
 * No-ops when a session is active — session pages use session-scoped state instead.
 */
export function useHomepageComposerDefaults({
  activeSessionId,
  selectedAgentId,
  setSelectedRepo,
  handleAgentSelect,
  mutateDefaultRepo,
  mutateDefaultAgent,
  mutateAgentDefaultModel,
}: UseHomepageComposerDefaultsParams) {
  const { setDefaultRepo } = useSetDefaultRepo()
  const { setDefaultAgent } = useSetDefaultAgent()
  const { setAgentDefaultModel } = useSetAgentDefaultModel()

  const handleRepoSelect = useCallback(
    async (repo: GitHubRepo) => {
      setSelectedRepo(repo)
      if (activeSessionId) return

      try {
        await setDefaultRepo({ repoFullName: repo.fullName })
        mutateDefaultRepo()
      } catch (error) {
        console.error('Failed to save default repo:', error)
      }
    },
    [activeSessionId, setSelectedRepo, setDefaultRepo, mutateDefaultRepo],
  )

  const handleAgentSelectWithPersist = useCallback(
    async (agent: AgentInfo) => {
      handleAgentSelect(agent)
      if (activeSessionId) return

      try {
        await setDefaultAgent({ agentId: agent.id })
        mutateDefaultAgent()
      } catch (error) {
        console.error('Failed to save default agent:', error)
      }
    },
    [activeSessionId, handleAgentSelect, setDefaultAgent, mutateDefaultAgent],
  )

  const persistDefaultModel = useCallback(
    async (model: ModelInfo, agentIdOverride?: string) => {
      const agentId = agentIdOverride ?? selectedAgentId
      if (activeSessionId || !agentId) return

      try {
        await setAgentDefaultModel({ agentId, modelId: model.id })
        mutateAgentDefaultModel()
      } catch (error) {
        console.error('Failed to save default model:', error)
      }
    },
    [activeSessionId, selectedAgentId, setAgentDefaultModel, mutateAgentDefaultModel],
  )

  return { handleRepoSelect, handleAgentSelectWithPersist, persistDefaultModel }
}
