import type { AgentInfo, AgentMode, ModelInfo } from './types'

const LEGACY_MODEL_IDS = {
  opencode: 'ship-acp-opencode',
  cursor: 'ship-acp-cursor',
  claude: 'ship-acp-claude',
  codex: 'ship-acp-codex',
} as const

const AGENT_MODES: AgentMode[] = [
  { id: 'agent', label: 'Agent' },
  { id: 'plan', label: 'Plan' },
]

const FALLBACK_OPENCODE_MODELS: ModelInfo[] = [
  openCodeModel('gpt-5.5', 'GPT-5.5', 1050000),
  openCodeModel('gpt-5.5-pro', 'GPT-5.5 Pro', 1050000),
  openCodeModel('gpt-5.4', 'GPT-5.4', 1050000),
  openCodeModel('gpt-5.4-mini', 'GPT-5.4 Mini', 400000),
  openCodeModel('gpt-5.3-codex', 'GPT-5.3 Codex', 400000),
  openCodeModel('gpt-5.3-codex-spark', 'GPT-5.3 Codex Spark', 128000),
  openCodeModel('claude-opus-4-7', 'Claude Opus 4.7', 200000),
  openCodeModel('claude-sonnet-4-6', 'Claude Sonnet 4.6', 1000000),
  openCodeModel('claude-sonnet-4-5', 'Claude Sonnet 4.5', 1000000),
  openCodeModel('gemini-3.5-flash', 'Gemini 3.5 Flash', 1048576),
  openCodeModel('deepseek-v4-flash-free', 'DeepSeek V4 Flash Free', 200000, true),
  openCodeModel('nemotron-3-super-free', 'Nemotron 3 Super Free', 200000, true),
  openCodeModel('big-pickle', 'Big Pickle', 200000, true),
]

const FALLBACK_CURSOR_MODELS: ModelInfo[] = [
  harnessModel('cursor', 'auto', 'Auto', 'Cursor CLI', 'Cursor chooses the best available model.'),
  harnessModel('cursor', 'composer-2', 'Composer 2', 'Cursor CLI', 'Cursor agentic coding model.'),
  harnessModel('cursor', 'gpt-5', 'GPT-5', 'Cursor CLI', '`agent --model` selected before ACP startup.'),
  harnessModel(
    'cursor',
    'claude-4-sonnet-thinking',
    'Claude Sonnet Thinking',
    'Cursor CLI',
    '`agent --model` selected before ACP startup.',
  ),
  harnessModel(
    'cursor',
    'claude-4-opus-thinking',
    'Claude Opus Thinking',
    'Cursor CLI',
    '`agent --model` selected before ACP startup.',
  ),
  harnessModel('cursor', 'gemini-3-pro', 'Gemini 3 Pro', 'Cursor CLI', '`agent --model` selected before ACP startup.'),
  harnessModel('cursor', 'grok', 'Grok', 'Cursor CLI', '`agent --model` selected before ACP startup.'),
]

const FALLBACK_CLAUDE_MODELS: ModelInfo[] = [
  harnessModel('claude', 'opus', 'Opus', 'Claude Code', 'Claude Code alias for the latest Opus model.'),
  harnessModel('claude', 'sonnet', 'Sonnet', 'Claude Code', 'Claude Code alias for the latest Sonnet model.'),
  harnessModel('claude', 'sonnet[1m]', 'Sonnet 1M', 'Claude Code', 'Claude Code long-context Sonnet alias.', 1000000),
  harnessModel('claude', 'haiku', 'Haiku', 'Claude Code', 'Claude Code alias for the latest Haiku model.'),
  harnessModel('claude', 'claude-opus-4-7', 'Claude Opus 4.7', 'Claude Code', 'Pinned Claude Code model.'),
  harnessModel('claude', 'claude-sonnet-4-6', 'Claude Sonnet 4.6', 'Claude Code', 'Pinned Claude Code model.'),
  harnessModel('claude', 'claude-haiku-4-5-20251001', 'Claude Haiku 4.5', 'Claude Code', 'Pinned Claude Code model.'),
]

const FALLBACK_CODEX_MODELS: ModelInfo[] = [
  harnessModel('codex', 'gpt-5.5', 'GPT-5.5', 'Codex', 'Set through Codex ACP model config when available.', 1000000),
  harnessModel('codex', 'gpt-5.4', 'GPT-5.4', 'Codex', 'Set through Codex ACP model config when available.', 1000000),
  harnessModel(
    'codex',
    'gpt-5.4-mini',
    'GPT-5.4 Mini',
    'Codex',
    'Set through Codex ACP model config when available.',
    400000,
  ),
  harnessModel(
    'codex',
    'gpt-5.3-codex',
    'GPT-5.3 Codex',
    'Codex',
    'Set through Codex ACP model config when available.',
    400000,
  ),
  harnessModel(
    'codex',
    'gpt-5.3-codex-spark',
    'GPT-5.3 Codex Spark',
    'Codex',
    'Set through Codex ACP model config when available.',
    128000,
  ),
]

/** Curated browser-side fallback for ACP agents when prod serves legacy harness-only data. */
export const FALLBACK_AGENTS: AgentInfo[] = [
  fallbackAgent('opencode', 'OpenCode', FALLBACK_OPENCODE_MODELS),
  fallbackAgent('cursor', 'Cursor Agent', FALLBACK_CURSOR_MODELS),
  fallbackAgent('claude', 'Claude Agent', FALLBACK_CLAUDE_MODELS),
  fallbackAgent('codex', 'Codex', FALLBACK_CODEX_MODELS),
]

/** Curated flat model fallback matching {@link FALLBACK_AGENTS}. */
export const FALLBACK_MODELS: ModelInfo[] = FALLBACK_AGENTS.flatMap((agent) => agent.models)

function openCodeModel(modelId: string, name: string, contextWindow?: number, isFree = false): ModelInfo {
  const upstreamModelId = `opencode/${modelId}`
  return {
    id: `${LEGACY_MODEL_IDS.opencode}:${upstreamModelId}`,
    upstreamModelId,
    name,
    provider: isFree ? 'OpenCode Zen - Free' : 'OpenCode Zen',
    description: 'Selected through OpenCode ACP runtime config before startup.',
    contextWindow,
    isFree,
    source: 'opencode-zen-fallback',
  }
}

function harnessModel(
  agentId: keyof typeof LEGACY_MODEL_IDS,
  upstreamModelId: string,
  name: string,
  provider: string,
  description: string,
  contextWindow = 200000,
): ModelInfo {
  return {
    id: `${LEGACY_MODEL_IDS[agentId]}:${upstreamModelId}`,
    upstreamModelId,
    name,
    provider,
    description,
    contextWindow,
    source: `${agentId}-fallback`,
  }
}

function fallbackAgent(id: keyof typeof LEGACY_MODEL_IDS, name: string, models: ModelInfo[]): AgentInfo {
  return { id, name, modes: AGENT_MODES, models }
}

function isConcreteAcpModel(model: ModelInfo): boolean {
  return Object.values(LEGACY_MODEL_IDS).some((legacyId) => model.id.startsWith(`${legacyId}:`))
}

function isLegacyHarnessModel(model: ModelInfo): boolean {
  return Object.values(LEGACY_MODEL_IDS).some((legacyId) => model.id === legacyId)
}

function fallbackModelsForAgent(agentId: string): ModelInfo[] | null {
  return FALLBACK_AGENTS.find((agent) => agent.id === agentId)?.models ?? null
}

/** Returns `true` when the response already includes concrete per-harness models. */
export function hasConcreteAcpModels(models: ModelInfo[]): boolean {
  return models.some(isConcreteAcpModel)
}

/** Replace legacy single-model harnesses with a curated per-harness catalog. */
export function expandLegacyAgents(agents: AgentInfo[]): AgentInfo[] {
  return agents.map((agent) => {
    const fallbackModels = fallbackModelsForAgent(agent.id)
    if (!fallbackModels) return agent
    const models = agent.models ?? []
    if (models.length === 0 || models.every(isLegacyHarnessModel)) {
      return { ...agent, models: fallbackModels }
    }
    return agent
  })
}

/** Use API models when they are concrete; otherwise fall back to the curated catalog. */
export function modelsWithFallback(models: ModelInfo[] | undefined): ModelInfo[] {
  if (models && hasConcreteAcpModels(models)) return models
  return FALLBACK_MODELS
}

/** Map legacy harness ids like `ship-acp-opencode` to the first concrete model for that harness. */
export function resolveLegacyDefaultModel(modelId: string | null | undefined, models: ModelInfo[]): ModelInfo | null {
  if (!modelId) return null
  const exact = models.find((model) => model.id === modelId)
  if (exact) return exact
  const legacyId = Object.values(LEGACY_MODEL_IDS).find(
    (candidate) => modelId === candidate || modelId.endsWith(candidate),
  )
  if (!legacyId) return null
  return models.find((model) => model.id.startsWith(`${legacyId}:`)) ?? null
}
