'use client'

import useSWR from 'swr'
import useSWRMutation from 'swr/mutation'
import { fetcher, apiUrl, post } from '../client'
import type { AgentInfo, DefaultAgentResponse, ModelInfo } from '../types'
import { expandLegacyAgents, FALLBACK_AGENTS } from '../acp-catalog'

const ACP_HARNESSES = {
  opencode: { name: 'OpenCode', provider: 'ACP — OpenCode' },
  cursor: { name: 'Cursor', provider: 'ACP — Cursor' },
  claude: { name: 'Claude', provider: 'ACP — Claude' },
  codex: { name: 'Codex', provider: 'ACP — Codex' },
} as const

type AcpHarnessId = keyof typeof ACP_HARNESSES

function acpHarnessForModel(model: ModelInfo): AcpHarnessId | null {
  const marker = `${model.id} ${model.name} ${model.provider}`.toLowerCase()
  if (marker.includes('opencode')) return 'opencode'
  if (marker.includes('cursor')) return 'cursor'
  if (marker.includes('claude')) return 'claude'
  if (marker.includes('codex')) return 'codex'
  return null
}

function normalizeAcpModel(model: ModelInfo, harnessId: AcpHarnessId): ModelInfo {
  const harness = ACP_HARNESSES[harnessId]
  const isLegacyHarnessModel =
    model.name === `${harness.name} (ACP)` || model.name === harness.name || model.name === 'Default'
  return {
    ...model,
    name: isLegacyHarnessModel ? 'Configured default' : model.name,
    provider: isLegacyHarnessModel ? harness.provider : model.provider,
  }
}

function normalizeAgents(rawAgents: AgentInfo[]): AgentInfo[] {
  const normalized = new Map<string, AgentInfo>()

  for (const agent of rawAgents) {
    if (agent.id !== 'ship') {
      const harnessId = (Object.keys(ACP_HARNESSES) as AcpHarnessId[]).find((id) => id === agent.id)
      if (!harnessId) {
        normalized.set(agent.id, agent)
        continue
      }
      normalized.set(harnessId, {
        ...agent,
        name: ACP_HARNESSES[harnessId].name,
        models: (agent.models ?? []).map((model) => normalizeAcpModel(model, harnessId)),
      })
      continue
    }

    for (const model of agent.models ?? []) {
      const harnessId = acpHarnessForModel(model)
      if (!harnessId) continue
      const harness = ACP_HARNESSES[harnessId]
      normalized.set(harnessId, {
        id: harnessId,
        name: harness.name,
        modes: agent.modes,
        models: [normalizeAcpModel(model, harnessId)],
      })
    }
  }

  return (Object.keys(ACP_HARNESSES) as AcpHarnessId[])
    .map((id) => normalized.get(id))
    .filter((agent): agent is AgentInfo => Boolean(agent))
}

/**
 * Hook to fetch available agents with their models and modes
 */
export function useAgents() {
  const { data, error, isLoading } = useSWR<AgentInfo[]>(apiUrl('/models/agents'), fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60000,
  })
  const agents = data && data.length > 0 ? data : FALLBACK_AGENTS

  return {
    agents: expandLegacyAgents(normalizeAgents(agents)),
    isLoading,
    isError: !!error && !agents.length,
    error,
  }
}

/**
 * Hook to fetch the JWT user's default agent preference.
 */
export function useDefaultAgent(fetchEnabled: boolean | undefined) {
  const { data, error, isLoading, mutate } = useSWR<DefaultAgentResponse | null>(
    fetchEnabled ? apiUrl('/models/default-agent') : null,
    async (url: string) => {
      try {
        return await fetcher<DefaultAgentResponse>(url)
      } catch (err: unknown) {
        if ((err as { status?: number })?.status === 404) return null
        throw err
      }
    },
  )

  return {
    defaultAgentId: data?.agentId === 'ship' ? 'opencode' : (data?.agentId ?? null),
    isLoading,
    isError: !!error,
    error,
    mutate,
  }
}

/**
 * Mutation hook to set user's default agent
 */
export function useSetDefaultAgent() {
  const { trigger, isMutating, error } = useSWRMutation(
    'set-default-agent',
    async (_key: string, { arg }: { arg: { agentId: string } }) => {
      return post<{ agentId: string }, DefaultAgentResponse>(apiUrl('/models/default-agent'), {
        agentId: arg.agentId,
      })
    },
  )

  return {
    setDefaultAgent: trigger,
    isSetting: isMutating,
    error,
  }
}
