/**
 * Agent Configuration Registry
 *
 * Defines supported agents and their configuration for sandbox-agent.
 * Each agent maps to a sandbox-agent agent name and specifies
 * required env vars, modes, models, and extensions.
 */

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
  sandboxAgentName: string // name used by sandbox-agent (e.g., 'claude', 'opencode', 'codex')
  requiredEnvVars: string[] // e.g., ['ANTHROPIC_API_KEY']
  modes: AgentMode[] // e.g., [{ id: 'agent', label: 'agent' }]
  models: AgentModel[] // available models for this agent
  extensions: string[] // agent-specific extensions
}

export const AGENTS: Record<string, AgentConfig> = {
  'claude-code': {
    id: 'claude-code',
    name: 'Claude Code',
    sandboxAgentName: 'claude',
    requiredEnvVars: ['ANTHROPIC_API_KEY'],
    modes: [
      { id: 'default', label: 'default' },
      { id: 'plan', label: 'Plan' },
      { id: 'acceptEdits', label: 'Accept Edits' },
    ],
    models: [
      { id: 'anthropic/claude-opus-4-6', name: 'Claude Opus 4.6', provider: 'Anthropic', contextWindow: 200000, maxTokens: 32000 },
      { id: 'anthropic/claude-sonnet-4-6', name: 'Claude Sonnet 4.6', provider: 'Anthropic', contextWindow: 200000, maxTokens: 64000 },
      { id: 'anthropic/claude-opus-4-20250514', name: 'Claude Opus 4', provider: 'Anthropic' },
      { id: 'anthropic/claude-sonnet-4-20250514', name: 'Claude Sonnet 4', provider: 'Anthropic' },
      { id: 'anthropic/claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', provider: 'Anthropic' },
    ],
    extensions: [],
  },
  opencode: {
    id: 'opencode',
    name: 'OpenCode',
    sandboxAgentName: 'opencode',
    requiredEnvVars: [],
    modes: [
      { id: 'build', label: 'Build' },
      { id: 'plan', label: 'Plan' },
    ],
    models: [
      // OpenCode Zen (free)
      { id: 'opencode/big-pickle', name: 'Big Pickle', provider: 'OpenCode Zen', contextWindow: 200000, maxTokens: 128000 },
      { id: 'opencode/glm-4.7-free', name: 'GLM 4.7 Free', provider: 'OpenCode Zen', contextWindow: 128000, maxTokens: 64000 },
      { id: 'opencode/claude-opus-4-6', name: 'Claude Opus 4.6', provider: 'OpenCode Zen', contextWindow: 200000, maxTokens: 32000 },
      { id: 'opencode/claude-opus-4-5', name: 'Claude Opus 4.5', provider: 'OpenCode Zen', contextWindow: 200000, maxTokens: 32000 },
      { id: 'opencode/claude-sonnet-4-5', name: 'Claude Sonnet 4.5', provider: 'OpenCode Zen', contextWindow: 200000, maxTokens: 64000 },
      // Direct Anthropic
      { id: 'anthropic/claude-sonnet-4-20250514', name: 'Claude Sonnet 4', provider: 'Anthropic' },
      { id: 'anthropic/claude-opus-4-20250514', name: 'Claude Opus 4', provider: 'Anthropic' },
      { id: 'anthropic/claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', provider: 'Anthropic' },
      // Bankr gateway (shown when Bankr is enabled)
      { id: 'bankr/claude-opus-4.6', name: 'Claude Opus 4.6', provider: 'Bankr', contextWindow: 200000, maxTokens: 32000 },
      { id: 'bankr/claude-sonnet-4.6', name: 'Claude Sonnet 4.6', provider: 'Bankr', contextWindow: 200000, maxTokens: 64000 },
      { id: 'bankr/claude-haiku-4.5', name: 'Claude Haiku 4.5', provider: 'Bankr', contextWindow: 200000, maxTokens: 64000 },
      { id: 'bankr/gpt-5.2', name: 'GPT-5.2', provider: 'Bankr', contextWindow: 1000000, maxTokens: 128000 },
      { id: 'bankr/gpt-5.2-codex', name: 'GPT-5.2 Codex', provider: 'Bankr', contextWindow: 1000000, maxTokens: 128000 },
      { id: 'bankr/gpt-5-mini', name: 'GPT-5 Mini', provider: 'Bankr', contextWindow: 1000000, maxTokens: 65536 },
      { id: 'bankr/gpt-5-nano', name: 'GPT-5 Nano', provider: 'Bankr', contextWindow: 1000000, maxTokens: 65536 },
      { id: 'bankr/kimi-k2.5', name: 'Kimi K2.5', provider: 'Bankr', contextWindow: 256000, maxTokens: 128000 },
      { id: 'bankr/qwen3-coder', name: 'Qwen3 Coder', provider: 'Bankr', contextWindow: 256000, maxTokens: 65536 },
    ],
    extensions: [],
  },
  codex: {
    id: 'codex',
    name: 'Codex',
    sandboxAgentName: 'codex',
    requiredEnvVars: ['OPENAI_API_KEY'],
    modes: [
      { id: 'full-access', label: 'Full Access' },
      { id: 'read-only', label: 'Read Only' },
    ],
    models: [
      { id: 'codex/default', name: 'Codex', provider: 'OpenAI' },
    ],
    extensions: [],
  },
}

/**
 * Get agent config by ID
 */
export function getAgent(agentId: string): AgentConfig | undefined {
  return AGENTS[agentId]
}

/**
 * Get agent config by sandbox-agent name
 */
export function getAgentBySandboxName(sandboxAgentName: string): AgentConfig | undefined {
  return Object.values(AGENTS).find((a) => a.sandboxAgentName === sandboxAgentName)
}

/**
 * List all available agents
 */
export function listAgents(): AgentConfig[] {
  return Object.values(AGENTS)
}

/**
 * Get the default agent ID
 */
export function getDefaultAgentId(): string {
  return 'opencode'
}
