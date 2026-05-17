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
        id: 'anthropic/claude-opus-4-7',
        name: 'Claude Opus 4.7',
        provider: 'Anthropic',
        contextWindow: 200000,
        maxTokens: 64000,
      },
      {
        id: 'anthropic/claude-opus-4-6',
        name: 'Claude Opus 4.6',
        provider: 'Anthropic',
        contextWindow: 200000,
        maxTokens: 64000,
      },
      {
        id: 'anthropic/claude-sonnet-4-6',
        name: 'Claude Sonnet 4.6',
        provider: 'Anthropic',
        contextWindow: 200000,
        maxTokens: 64000,
      },
      { id: 'openai/gpt-5.5', name: 'GPT-5.5', provider: 'OpenAI', contextWindow: 200000 },
      { id: 'openai/gpt-5.4', name: 'GPT-5.4', provider: 'OpenAI', contextWindow: 200000 },
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
