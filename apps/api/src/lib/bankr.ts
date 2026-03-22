/**
 * Bankr LLM Gateway Service
 *
 * Reusable client for the Bankr gateway at https://llm.bankr.bot.
 * Supports both OpenAI-compatible and Anthropic-compatible endpoints.
 * Auth via X-API-Key header with a bk_... key.
 */

const BANKR_BASE_URL = 'https://llm.bankr.bot'

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
      'anthropic-version': '2023-06-01',
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

/**
 * All Bankr-available model IDs (without the bankr/ prefix).
 */
export const BANKR_MODEL_IDS = [
  'claude-opus-4.6',
  'claude-sonnet-4.6',
  'claude-haiku-4.5',
  'gpt-5.2',
  'gpt-5.2-codex',
  'gpt-5-mini',
  'gpt-5-nano',
  'kimi-k2.5',
  'qwen3-coder',
] as const

export type BankrModelId = (typeof BANKR_MODEL_IDS)[number]
