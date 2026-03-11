import type { SessionInfo } from '@/lib/sse-types'
import type { StepFinishPart } from '@/lib/sse-types'

export type RightSidebarTab = 'git' | 'desktop' | 'terminal' | 'overview'

export interface TodoItem {
  id: string
  content: string
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled'
  priority: 'high' | 'medium' | 'low'
}

export interface FileDiff {
  filename: string
  additions: number
  deletions: number
}

export interface StepCostInfo {
  cost: number
  tokens: StepFinishPart['tokens']
}

export interface SessionPanelData {
  sessionId: string
  selectedRepo: { id: number; name: string; fullName: string; owner: string; private: boolean; description: string | null } | null
  selectedAgent: { id: string; name: string } | null
  selectedModel: { id: string; name: string; provider: string } | null
  mode: string
  lastStepCost: StepCostInfo | null
  totalCost: number
  sessionTodos: TodoItem[]
  fileDiffs: FileDiff[]
  agentUrl: string
  agentSessionId?: string
  sessionInfo: SessionInfo | null
  messages: import('@/lib/ai-elements-adapter').UIMessage[]
  sandboxStatus?: string
}
