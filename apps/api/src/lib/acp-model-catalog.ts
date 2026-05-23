/**
 * ACP model catalogs exposed to the web app.
 *
 * @remarks
 * OpenCode is the only ACP harness here with verified runtime model selection:
 * `opencode --model provider/model acp`. Other ACP CLIs stay on their configured
 * defaults until they advertise model config options or publish a stable model flag.
 *
 * @packageDocumentation
 */

import { acpModelId, ACP_MODEL_IDS, type AcpBackendKind } from './acp-types'

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
  isDefault?: boolean
  isFree?: boolean
  source?: string
  upstreamModelId?: string
}

export interface AgentConfig {
  id: string
  name: string
  /** Env vars the deployment should have for this persona (Worker / secrets). */
  requiredEnvVars: string[]
  modes: AgentMode[]
  models: AgentModel[]
}

interface ModelsDevModel {
  name?: string
  tool_call?: boolean
  limit?: { context?: number; output?: number }
  cost?: { input?: number; output?: number; cache_read?: number; cache_write?: number }
}

interface ModelsDevProvider {
  models?: Record<string, ModelsDevModel>
}

interface OpenCodeZenModel {
  id?: string
}

interface OpenCodeZenResponse {
  data?: OpenCodeZenModel[]
}

type FetchLike = typeof fetch

const ACP_AGENT_MODES: AgentMode[] = [
  { id: 'agent', label: 'Agent' },
  { id: 'plan', label: 'Plan' },
]

const ACP_CONTEXT_WINDOW = 200000
const CATALOG_TTL_MS = 10 * 60 * 1000
const REQUEST_TIMEOUT_MS = 2500

const FALLBACK_OPENCODE_MODELS: AgentModel[] = [
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

let openCodeCache: { expiresAt: number; models: AgentModel[] } | null = null

function openCodeModel(modelId: string, name: string, contextWindow?: number, isFree = false): AgentModel {
  const upstreamModelId = `opencode/${modelId}`
  return {
    id: acpModelId('opencode', upstreamModelId),
    upstreamModelId,
    name,
    provider: isFree ? 'OpenCode Zen - Free' : 'OpenCode Zen',
    description: '`opencode --model` selected before ACP startup.',
    contextWindow,
    isFree,
    source: 'opencode-zen',
  }
}

function fallbackModelName(modelId: string): string {
  return modelId
    .split('-')
    .filter(Boolean)
    .map((part) => {
      if (/^gpt$/i.test(part)) return 'GPT'
      if (/^\d/.test(part)) return part
      return part.charAt(0).toUpperCase() + part.slice(1)
    })
    .join(' ')
}

function isFreeModel(model: ModelsDevModel | undefined): boolean {
  if (!model?.cost) return false
  return (model.cost.input ?? 1) === 0 && (model.cost.output ?? 1) === 0
}

async function fetchJson<T>(fetcher: FetchLike, url: string): Promise<T> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    const res = await fetcher(url, { signal: controller.signal })
    if (!res.ok) throw new Error(`fetch failed ${res.status}: ${url}`)
    return (await res.json()) as T
  } finally {
    clearTimeout(timer)
  }
}

async function fetchOpenCodeModels(fetcher: FetchLike): Promise<AgentModel[]> {
  const [zenResult, modelsDevResult] = await Promise.allSettled([
    fetchJson<OpenCodeZenResponse>(fetcher, 'https://opencode.ai/zen/v1/models'),
    fetchJson<Record<string, ModelsDevProvider>>(fetcher, 'https://models.dev/api.json'),
  ])
  if (zenResult.status !== 'fulfilled') return FALLBACK_OPENCODE_MODELS

  const modelsDev =
    modelsDevResult.status === 'fulfilled' ? (modelsDevResult.value.opencode?.models ?? {}) : {}
  const ids = (zenResult.value.data ?? []).map((model) => model.id).filter((id): id is string => Boolean(id))
  const models = ids.map((id) => {
    const meta = modelsDev[id]
    return openCodeModel(id, meta?.name ?? fallbackModelName(id), meta?.limit?.context, isFreeModel(meta))
  })

  return models.length > 0 ? models : FALLBACK_OPENCODE_MODELS
}

/** Returns cached OpenCode model entries, falling back to a curated list on network failure. */
export async function listOpenCodeModels(fetcher: FetchLike = fetch): Promise<AgentModel[]> {
  const now = Date.now()
  if (openCodeCache && openCodeCache.expiresAt > now) return openCodeCache.models
  const models = await fetchOpenCodeModels(fetcher).catch(() => FALLBACK_OPENCODE_MODELS)
  openCodeCache = { models, expiresAt: now + CATALOG_TTL_MS }
  return models
}

function configuredDefaultModel(backend: AcpBackendKind, provider: string, description: string): AgentModel {
  return {
    id: ACP_MODEL_IDS[backend],
    name: 'Configured default',
    provider,
    description,
    contextWindow: ACP_CONTEXT_WINDOW,
  }
}

/** Registry of ACP harnesses exposed to the composer. */
export async function listAgents(fetcher: FetchLike = fetch): Promise<AgentConfig[]> {
  const openCodeModels = await listOpenCodeModels(fetcher)
  return [
    {
      id: 'opencode',
      name: 'OpenCode',
      requiredEnvVars: ['E2B_API_KEY'],
      modes: ACP_AGENT_MODES,
      models: openCodeModels,
    },
    {
      id: 'cursor',
      name: 'Cursor Agent',
      requiredEnvVars: ['E2B_API_KEY'],
      modes: ACP_AGENT_MODES,
      models: [
        configuredDefaultModel(
          'cursor',
          'Selected by Cursor ACP',
          '`agent acp` configured default; no verified model flag is wired yet.',
        ),
      ],
    },
    {
      id: 'claude',
      name: 'Claude Agent',
      requiredEnvVars: ['E2B_API_KEY'],
      modes: ACP_AGENT_MODES,
      models: [
        configuredDefaultModel(
          'claude',
          'Selected by Claude ACP',
          '`claude-agent-acp` configured default; no verified model flag is wired yet.',
        ),
      ],
    },
    {
      id: 'codex',
      name: 'Codex',
      requiredEnvVars: ['E2B_API_KEY'],
      modes: ACP_AGENT_MODES,
      models: [
        configuredDefaultModel(
          'codex',
          'Selected by Codex ACP',
          '`codex-acp` configured default; no verified model flag is wired yet.',
        ),
      ],
    },
  ]
}

/** Returns every selectable ACP model as a flat list. */
export async function listAvailableModels(fetcher: FetchLike = fetch): Promise<AgentModel[]> {
  const agents = await listAgents(fetcher)
  return agents.flatMap((agent) => agent.models)
}

/** Checks whether a model id is a known ACP model id or preserved legacy harness id. */
export async function isKnownAcpModel(modelId: string, fetcher: FetchLike = fetch): Promise<boolean> {
  if ((Object.values(ACP_MODEL_IDS) as string[]).includes(modelId)) return true
  const models = await listAvailableModels(fetcher)
  return models.some((model) => model.id === modelId)
}
