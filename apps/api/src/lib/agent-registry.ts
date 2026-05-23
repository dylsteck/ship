/**
 * Agent + ACP backend registry exposed to the web app.
 *
 * Chat runs in the E2B VM via Agent Client Protocol bridges (`ship-acp-*` model ids).
 *
 * @packageDocumentation
 */

import { ACP_MODEL_IDS, acpBackendFromModelId, type AcpBackendKind } from './acp-types'

export type { AcpBackendKind } from './acp-types'

export const DEFAULT_ACP_MODEL_ID = ACP_MODEL_IDS.opencode

export function resolveAcpBackend(modelId: string): AcpBackendKind {
  return acpBackendFromModelId(modelId)
}
export interface AgentMode {
  id: string
  label: string
}

export interface AgentModel {
  id: string
  name: string
  provider: string
  description?: string
  contextWindow?: number
  maxTokens?: number
}

export interface AgentConfig {
  id: string
  name: string
  /** Env vars the deployment should have for this persona (Worker / secrets). */
  requiredEnvVars: string[]
  modes: AgentMode[]
  models: AgentModel[]
}

const ACP_AGENT_MODES: AgentMode[] = [
  { id: 'agent', label: 'Agent' },
  { id: 'plan', label: 'Plan' },
]

const ACP_CONTEXT_WINDOW = 200000

/** Registry of ACP harnesses exposed to the composer. */
export const AGENTS: Record<string, AgentConfig> = {
  opencode: {
    id: 'opencode',
    name: 'OpenCode',
    requiredEnvVars: ['E2B_API_KEY'],
    modes: ACP_AGENT_MODES,
    models: [
      {
        id: ACP_MODEL_IDS.opencode,
        name: 'Default',
        provider: 'ACP — OpenCode',
        description: '`opencode acp` in sandbox — set OPENCODE_API_KEY on Worker for auth.',
        contextWindow: ACP_CONTEXT_WINDOW,
      },
    ],
  },
  cursor: {
    id: 'cursor',
    name: 'Cursor Agent',
    requiredEnvVars: ['E2B_API_KEY'],
    modes: ACP_AGENT_MODES,
    models: [
      {
        id: ACP_MODEL_IDS.cursor,
        name: 'Default',
        provider: 'ACP — Cursor',
        description: '`agent acp` — CURSOR_API_KEY / CURSOR_AUTH_TOKEN on Worker per Cursor docs.',
        contextWindow: ACP_CONTEXT_WINDOW,
      },
    ],
  },
  claude: {
    id: 'claude',
    name: 'Claude Agent',
    requiredEnvVars: ['E2B_API_KEY'],
    modes: ACP_AGENT_MODES,
    models: [
      {
        id: ACP_MODEL_IDS.claude,
        name: 'Default',
        provider: 'ACP — Claude',
        description: '`claude-agent-acp` binary in template; Claude auth per upstream docs.',
        contextWindow: ACP_CONTEXT_WINDOW,
      },
    ],
  },
  codex: {
    id: 'codex',
    name: 'Codex',
    requiredEnvVars: ['E2B_API_KEY'],
    modes: ACP_AGENT_MODES,
    models: [
      {
        id: ACP_MODEL_IDS.codex,
        name: 'Default',
        provider: 'ACP — Codex',
        description: '`codex-acp` in sandbox — typically OPENAI_API_KEY for Worker auth negotiation.',
        contextWindow: ACP_CONTEXT_WINDOW,
      },
    ],
  },
}

export function getAgent(agentId: string): AgentConfig | undefined {
  return AGENTS[agentId]
}

export function listAgents(): AgentConfig[] {
  return Object.values(AGENTS)
}

export function getDefaultAgentId(): string {
  return 'opencode'
}
