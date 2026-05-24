import type { ModelInfo, AgentInfo, GitHubRepo } from '@/lib/api/types'
import type { ComposerContextValue } from '../components/composer/composer-context'

export interface BuildComposerContextParams {
  activeSessionId: string | null
  prompt: string
  setPrompt: (value: string) => void
  handleKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void
  selectedRepo: import('@/lib/api/types').GitHubRepo | null
  setSelectedRepo: (repo: GitHubRepo | null) => void
  repos: GitHubRepo[]
  reposLoading: boolean
  reposLoadMore: () => void
  reposHasMore: boolean
  reposLoadingMore: boolean
  selectedAgent: AgentInfo | null
  handleAgentSelect: (agent: AgentInfo) => void
  agents: AgentInfo[]
  agentsLoading: boolean
  selectedModel: ModelInfo | null
  setSelectedModel: (model: ModelInfo | null) => void
  onModelSelect?: (model: ModelInfo) => void
  modelsLoading: boolean
  groupedByProvider: Record<string, ModelInfo[]>
  mode: import('@/lib/api/types').AgentModeId
  setMode: (mode: import('@/lib/api/types').AgentModeId) => void
  availableModes: import('@/lib/api/types').AgentMode[]
  handleSubmit: () => void
  handleStop: () => Promise<void>
  isCreating: boolean
  isStreaming: boolean
  messageQueueLength: number
  canSubmit: boolean
}

export function buildComposerContext(params: BuildComposerContextParams): ComposerContextValue {
  return {
    activeSessionId: params.activeSessionId,
    prompt: params.prompt,
    onPromptChange: params.setPrompt,
    onKeyDown: params.handleKeyDown,
    selectedRepo: params.selectedRepo,
    onRepoSelect: params.setSelectedRepo,
    repos: params.repos,
    reposLoading: params.reposLoading ?? false,
    reposLoadMore: params.reposLoadMore,
    reposHasMore: params.reposHasMore ?? false,
    reposLoadingMore: params.reposLoadingMore ?? false,
    selectedAgent: params.selectedAgent,
    onAgentSelect: params.handleAgentSelect,
    agents: params.agents,
    agentsLoading: params.agentsLoading,
    selectedModel: params.selectedModel,
    onModelSelect: params.onModelSelect ?? params.setSelectedModel,
    modelsLoading: params.modelsLoading ?? false,
    groupedByProvider: params.groupedByProvider,
    mode: params.mode,
    onModeChange: params.setMode,
    availableModes: params.availableModes,
    onSubmit: params.handleSubmit,
    onStop: params.handleStop,
    isCreating: !!params.isCreating,
    isStreaming: !!params.isStreaming,
    messageQueueLength: params.messageQueueLength,
    canSubmit: !!params.canSubmit,
  }
}
