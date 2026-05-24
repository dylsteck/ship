/**
 * Re-export SDK types plus web-only UI aliases.
 * Prefer importing from `@ship/sdk` in new code.
 */

export type {
  Session,
  CreateSessionBody,
  SandboxStatus,
  ChatMessage,
  ChatTask,
  GitState,
  ModelInfo,
  AgentInfo,
  User,
  Connector,
  GitHubRepo,
  ChatEvent,
} from '@ship/sdk'

/** @deprecated Use CreateSessionBody from @ship/sdk */
export type CreateSessionParams = import('@ship/sdk').CreateSessionBody

/** Composer mode identifiers */
export type AgentModeId = 'agent' | 'plan' | 'build'

/** Composer mode option (matches SDK agent mode shape). */
export interface AgentMode {
  id: AgentModeId
  name: string
}

/** @deprecated Use SDK DefaultModelResponse shape */
export interface DefaultModelResponse {
  model?: string | null
  modelId?: string | null
}

/** @deprecated Use SDK agent id ref */
export interface DefaultAgentResponse {
  agentId: string
}

/** Connector list wrapper (SDK uses ConnectorsResponse) */
export interface ConnectorStatus {
  connectors: import('@ship/sdk').Connector[]
}

/** @deprecated Use ChatMessage */
export type Message = import('@ship/sdk').ChatMessage

export interface SendMessageParams {
  content: string
  model?: string
}
