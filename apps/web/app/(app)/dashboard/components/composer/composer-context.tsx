'use client'

import { createContext, useContext } from 'react'
import type { GitHubRepo, ModelInfo, AgentInfo, AgentMode, AgentModeId } from '@/lib/api/types'

export interface ComposerContextValue {
  activeSessionId: string | null
  prompt: string
  onPromptChange: (value: string) => void
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void
  selectedRepo: GitHubRepo | null
  onRepoSelect: (repo: GitHubRepo) => void
  repos: GitHubRepo[]
  reposLoading: boolean
  reposLoadMore: () => void
  reposHasMore: boolean
  reposLoadingMore: boolean
  selectedAgent: AgentInfo | null
  onAgentSelect: (agent: AgentInfo) => void
  agents: AgentInfo[]
  agentsLoading: boolean
  selectedModel: ModelInfo | null
  onModelSelect: (model: ModelInfo) => void
  modelsLoading: boolean
  groupedByProvider: Record<string, ModelInfo[]>
  mode: AgentModeId
  onModeChange: (mode: AgentModeId) => void
  availableModes: AgentMode[]
  onSubmit: () => void
  onStop: () => void
  isCreating: boolean
  isStreaming: boolean
  messageQueueLength: number
  canSubmit: boolean
}

const ComposerContext = createContext<ComposerContextValue | null>(null)

export function ComposerProvider({
  value,
  children,
}: {
  value: ComposerContextValue
  children: React.ReactNode
}) {
  return <ComposerContext.Provider value={value}>{children}</ComposerContext.Provider>
}

export function useComposer() {
  const ctx = useContext(ComposerContext)
  if (!ctx) throw new Error('useComposer must be used within ComposerProvider')
  return ctx
}
