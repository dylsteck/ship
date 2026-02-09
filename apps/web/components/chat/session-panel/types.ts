import type { SessionInfo as SSESessionInfo } from '@/lib/sse-types'
import type { UIMessage } from '@/lib/ai-elements-adapter'

export interface RepoInfo {
  owner: string
  name: string
  branch?: string
}

export interface ModelInfo {
  id: string
  name?: string
  provider?: string
  mode?: 'build' | 'plan'
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
  model?: ModelInfo
  tokens?: TokenInfo
  cost?: number
  todos?: Todo[]
  diffs?: DiffSummary[]
  sessionInfo?: SSESessionInfo
  openCodeUrl?: string
  messages?: UIMessage[]
  className?: string
  onTodoClick?: (todo: Todo) => void
}
