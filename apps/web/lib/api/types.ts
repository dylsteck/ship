/**
 * API Types
 * Shared types for API requests and responses
 *
 * Note: ChatSession and Message are defined in ./server.ts for server-side usage
 */

// ============ Sessions ============

export interface CreateSessionParams {
  userId: string
  repoOwner: string
  repoName: string
  model: string
  agentType?: string
  initialPrompt?: string
  /** Initial title (e.g. from first prompt); persisted for cross-tab sync */
  title?: string
  /** Base branch to clone and create ship branch from (e.g. main). Defaults to main. */
  baseBranch?: string
}

export interface SandboxStatus {
  ready: boolean
  url?: string
  terminalUrl?: string
  /** Sandbox ID from E2B; from GET /sessions/:id/sandbox */
  sandboxId?: string | null
  /** Sandbox-agent URL for Desktop iframe; from GET /sessions/:id/sandbox */
  sandboxAgentUrl?: string | null
  /** Raw status from DO: provisioning, active, resuming, error, etc. */
  status?: string | null
}

// ============ Chat ============

export interface ChatMessage {
  id: string
  sessionId: string
  role: 'user' | 'assistant' | 'system'
  content: string
  createdAt: string
  metadata?: Record<string, unknown>
}

export interface SendMessageParams {
  content: string
  model?: string
}

export interface ChatTask {
  id: string
  title: string
  status: 'pending' | 'in_progress' | 'completed' | 'failed'
  createdAt: string
}

export interface GitState {
  branch: string
  hasChanges: boolean
  prUrl?: string
  prStatus?: 'draft' | 'open' | 'merged' | 'closed'
}

// ============ Models ============

export interface ModelInfo {
  id: string
  name: string
  provider: string
  description?: string
  contextWindow?: number
  maxTokens?: number
  isDefault?: boolean
}

export interface DefaultModelResponse {
  model?: string | null
  modelId?: string | null
}

// ============ Agents ============

/** All known agent mode IDs across all agents */
export type AgentModeId =
  | 'build' | 'plan'                    // OpenCode
  | 'default' | 'acceptEdits'           // Claude Code
  | 'auto' | 'read-only' | 'full-access' // Codex

export interface AgentMode {
  id: AgentModeId
  label: string
}

export interface AgentInfo {
  id: string
  name: string
  modes: AgentMode[]
  models: ModelInfo[]
}

export interface DefaultAgentResponse {
  agentId: string
}

// ============ GitHub ============

export interface GitHubRepo {
  id: number
  name: string
  fullName: string
  owner: string
  description: string | null
  private: boolean
  updatedAt: string
  language: string | null
  stars: number
  defaultBranch?: string
}

// ============ Connectors ============

export interface Connector {
  name: string
  displayName: string
  description: string
  enabled: boolean
  connected: boolean
  icon?: string
}

export interface ConnectorStatus {
  connectors: Connector[]
}

// ============ Users ============

export interface User {
  id: string
  username: string
  email: string | null
  name: string | null
  avatarUrl: string | null
  createdAt?: string
}

// ============ API Error ============

export interface ApiError extends Error {
  info?: unknown
  status?: number
}
