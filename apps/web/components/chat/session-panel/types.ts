import type { SessionInfo as SSESessionInfo } from '@/lib/sse-types'
import type { UIMessage } from '@/lib/ai-elements-adapter'

export interface RepoInfo {
  owner: string
  name: string
  branch?: string
}

export interface AgentInfo {
  id: string
  name: string
}

export interface ModelInfo {
  id: string
  name?: string
  provider?: string
  mode?: string
}

export interface TokenInfo {
  input: number
  output: number
  reasoning: number
  cache: { read: number; write: number }
  contextLimit?: number
}

export interface DiffSummary {
  filename: string
  additions: number
  deletions: number
}

export interface Todo {
  id: string
  content: string
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled'
  priority: 'high' | 'medium' | 'low'
}

export interface SessionPanelProps {
  sessionId: string
  repo?: RepoInfo
  agent?: AgentInfo
  model?: ModelInfo
  tokens?: TokenInfo
  cost?: number
  todos?: Todo[]
  diffs?: DiffSummary[]
  sessionInfo?: SSESessionInfo
  agentUrl?: string
  agentSessionId?: string
  messages?: UIMessage[]
  className?: string
}
