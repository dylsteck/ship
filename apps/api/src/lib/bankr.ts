/**
 * Bankr LLM Gateway Service
 *
 * Reusable client for the Bankr gateway at https://llm.bankr.bot.
 * Supports both OpenAI-compatible and Anthropic-compatible endpoints.
 * Auth via X-API-Key header with a bk_... key.
 *
 * This file is the single source of truth for Bankr model metadata.
 */

const BANKR_BASE_URL = 'https://llm.bankr.bot'

// ─── Model Metadata (single source of truth) ────────────────────────

export const BANKR_MODELS = [
  { id: 'claude-opus-4.6', name: 'Claude Opus 4.6', contextWindow: 200000, maxTokens: 32000 },
  { id: 'claude-sonnet-4.6', name: 'Claude Sonnet 4.6', contextWindow: 200000, maxTokens: 64000 },
  { id: 'claude-haiku-4.5', name: 'Claude Haiku 4.5', contextWindow: 200000, maxTokens: 64000 },
  { id: 'gpt-5.2', name: 'GPT-5.2', contextWindow: 1000000, maxTokens: 128000 },
  { id: 'gpt-5.2-codex', name: 'GPT-5.2 Codex', contextWindow: 1000000, maxTokens: 128000 },
  { id: 'gpt-5-mini', name: 'GPT-5 Mini', contextWindow: 1000000, maxTokens: 65536 },
  { id: 'gpt-5-nano', name: 'GPT-5 Nano', contextWindow: 1000000, maxTokens: 65536 },
  { id: 'kimi-k2.5', name: 'Kimi K2.5', contextWindow: 256000, maxTokens: 128000 },
  { id: 'qwen3-coder', name: 'Qwen3 Coder', contextWindow: 256000, maxTokens: 65536 },
] as const

export const BANKR_MODEL_IDS = BANKR_MODELS.map((m) => m.id)

export type BankrModelId = (typeof BANKR_MODELS)[number]['id']

// ─── Derived formats for consumers ──────────────────────────────────

/**
 * Models for the /models/available API route.
 * Prefixed with `bankr/`, tagged with provider "Bankr".
 */
export function getBankrRouteModels() {
  return BANKR_MODELS.map((m) => ({
    id: `bankr/${m.id}`,
    name: m.name,
    provider: 'Bankr' as const,
    description: `${m.name} via Bankr`,
    contextWindow: m.contextWindow,
    maxTokens: m.maxTokens,
  }))
}

/**
 * OpenCode provider config object for merging into opencode.json.
 * @param apiKeyEnvRef - The env reference string, e.g. '{env:BANKR_API_KEY}'
 */
export function getBankrOpenCodeProvider(apiKeyEnvRef: string) {
  const models: Record<string, { name: string; limit: { context: number; output: number } }> = {}
  for (const m of BANKR_MODELS) {
    models[m.id] = { name: m.name, limit: { context: m.contextWindow, output: m.maxTokens } }
  }
  return {
    npm: '@ai-sdk/openai-compatible',
    name: 'Bankr LLM Gateway',
    options: {
      baseURL: `${BANKR_BASE_URL}/v1`,
      apiKey: apiKeyEnvRef,
    },
    models,
  }
}

/**
 * AgentModel[] for the agent registry (opencode agent config).
 * Prefixed with `bankr/`, tagged with provider "Bankr".
 */
export function getBankrAgentModels() {
  return BANKR_MODELS.map((m) => ({
    id: `bankr/${m.id}`,
    name: m.name,
    provider: 'Bankr' as const,
    contextWindow: m.contextWindow,
    maxTokens: m.maxTokens,
  }))
}

// ─── API Client ─────────────────────────────────────────────────────

export interface BankrChatOptions {
  apiKey: string
  model: string
  messages: Array<{ role: string; content: string }>
  stream?: boolean
  max_tokens?: number
}

export interface BankrMessagesOptions extends BankrChatOptions {
  system?: string
}

/**
 * OpenAI-compatible chat completion via Bankr gateway.
 * Works with all Bankr models regardless of underlying provider.
 */
export async function bankrChatCompletion(options: BankrChatOptions): Promise<Response> {
  return fetch(`${BANKR_BASE_URL}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': options.apiKey,
    },
    body: JSON.stringify({
      model: options.model,
      messages: options.messages,
      stream: options.stream ?? false,
      max_tokens: options.max_tokens,
    }),
  })
}

/**
 * Anthropic-compatible messages via Bankr gateway.
 * Useful for Claude models or when you need Anthropic message format.
 */
export async function bankrMessages(options: BankrMessagesOptions): Promise<Response> {
  return fetch(`${BANKR_BASE_URL}/v1/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': options.apiKey,
    },
    body: JSON.stringify({
      model: options.model,
      messages: options.messages,
      system: options.system,
      stream: options.stream ?? false,
      max_tokens: options.max_tokens,
    }),
  })
}

/**
 * Strip 'bankr/' prefix to get the raw Bankr model ID.
 * e.g. 'bankr/claude-opus-4.6' → 'claude-opus-4.6'
 */
export function toBankrModelId(shipModelId: string): string {
  return shipModelId.replace(/^bankr\//, '')
}
