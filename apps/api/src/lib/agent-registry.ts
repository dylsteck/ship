/**
 * Agent + model registry exposed to the web app.
 *
 * Ship now runs a single in-worker agent harness (`@ship/agent`) with
 * pluggable models. The "agent" entries below describe the UI-facing
 * personas (modes + offered models) — they no longer correspond to a
 * separate in-VM agent process.
 *
 * @packageDocumentation
 */

import { getBankrAgentModels } from './bankr'

/** UI label/identifier for an agent mode (e.g. `Build`, `Plan`). */
export interface AgentMode {
  id: string
  label: string
}

/** Model entry shown in the model picker. */
export interface AgentModel {
  id: string
  name: string
  provider: string
  description?: string
  contextWindow?: number
  maxTokens?: number
}

/** UI persona for the agent — drives the model picker + mode selector. */
export interface AgentConfig {
  id: string
  name: string
  /** Env vars the model invocation requires. */
  requiredEnvVars: string[]
  modes: AgentMode[]
  models: AgentModel[]
}

/** Registry of agent personas. Default is `ship`. */
export const AGENTS: Record<string, AgentConfig> = {
  ship: {
    id: 'ship',
    name: 'Ship',
    requiredEnvVars: ['ANTHROPIC_API_KEY'],
    modes: [
      { id: 'agent', label: 'Agent' },
      { id: 'plan', label: 'Plan' },
    ],
    models: [
      {
        id: 'anthropic/claude-3-7-sonnet-20250219',
        name: 'Claude 3.7 Sonnet',
        provider: 'Anthropic',
        contextWindow: 200000,
        maxTokens: 64000,
      },
      {
        id: 'anthropic/claude-3-5-sonnet-20241022',
        name: 'Claude 3.5 Sonnet',
        provider: 'Anthropic',
        contextWindow: 200000,
        maxTokens: 8192,
      },
      {
        id: 'anthropic/claude-3-5-haiku-20241022',
        name: 'Claude 3.5 Haiku',
        provider: 'Anthropic',
        contextWindow: 200000,
        maxTokens: 8192,
      },
      { id: 'openai/gpt-4o', name: 'GPT-4o', provider: 'OpenAI', contextWindow: 128000 },
      { id: 'openai/gpt-4o-mini', name: 'GPT-4o mini', provider: 'OpenAI', contextWindow: 128000 },
      ...getBankrAgentModels(),
    ],
  },
}

/** Look up an agent persona by id. */
export function getAgent(agentId: string): AgentConfig | undefined {
  return AGENTS[agentId]
}

/** List every registered agent persona. */
export function listAgents(): AgentConfig[] {
  return Object.values(AGENTS)
}

/** Default agent persona id surfaced to new sessions. */
export function getDefaultAgentId(): string {
  return 'ship'
}
