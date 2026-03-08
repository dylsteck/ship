/**
 * Agent Configuration Registry
 *
 * Defines supported agents and their configuration for sandbox-agent.
 * Each agent maps to a sandbox-agent agent name and specifies
 * required env vars, modes, and extensions.
 */

export interface AgentConfig {
  id: string
  name: string
  sandboxAgentName: string // name used by sandbox-agent (e.g., 'claude', 'opencode', 'codex')
  requiredEnvVars: string[] // e.g., ['ANTHROPIC_API_KEY']
  modes: string[] // e.g., ['agent', 'plan']
  extensions: string[] // agent-specific extensions
}

export const AGENTS: Record<string, AgentConfig> = {
  'claude-code': {
    id: 'claude-code',
    name: 'Claude Code',
    sandboxAgentName: 'claude',
    requiredEnvVars: ['ANTHROPIC_API_KEY'],
    modes: ['default', 'plan', 'acceptEdits', 'bypassPermissions'],
    extensions: [],
  },
  cursor: {
    id: 'cursor',
    name: 'Cursor',
    sandboxAgentName: 'cursor',
    requiredEnvVars: ['CURSOR_API_KEY'],
    modes: ['agent', 'plan', 'ask'],
    extensions: [],
  },
  opencode: {
    id: 'opencode',
    name: 'OpenCode',
    sandboxAgentName: 'opencode',
    requiredEnvVars: [],
    modes: ['build', 'plan'],
    extensions: [],
  },
  codex: {
    id: 'codex',
    name: 'Codex',
    sandboxAgentName: 'codex',
    requiredEnvVars: ['OPENAI_API_KEY'],
    modes: ['read-only', 'auto', 'full-access'],
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
