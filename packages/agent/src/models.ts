/**
 * Model resolution.
 *
 * Ship uses Anthropic and OpenAI directly via their AI SDK providers (no
 * Vercel Gateway dependency). API keys come from Cloudflare Worker env.
 *
 * Model id format: `<provider>/<model>` (e.g. `anthropic/claude-3-7-sonnet`).
 */

import { createAnthropic } from '@ai-sdk/anthropic'
import { createOpenAI } from '@ai-sdk/openai'
import type { LanguageModel } from 'ai'

export interface AgentModelEnv {
  ANTHROPIC_API_KEY?: string
  OPENAI_API_KEY?: string
}

/** Default model when callers don't specify one. */
export const DEFAULT_MODEL_ID = 'anthropic/claude-3-7-sonnet-20250219'

export const SUPPORTED_MODEL_IDS = [
  'anthropic/claude-opus-4-7',
  'anthropic/claude-opus-4-6',
  'anthropic/claude-sonnet-4-6',
  'anthropic/claude-3-7-sonnet-20250219',
  'anthropic/claude-3-5-sonnet-20241022',
  'anthropic/claude-3-5-haiku-20241022',
  'openai/gpt-5.5',
  'openai/gpt-5.4',
  'openai/gpt-4o',
  'openai/gpt-4o-mini',
] as const

export type SupportedModelId = (typeof SUPPORTED_MODEL_IDS)[number]

export function resolveModel(modelId: string | undefined, env: AgentModelEnv): LanguageModel {
  const id = modelId ?? DEFAULT_MODEL_ID
  const slashIndex = id.indexOf('/')
  if (slashIndex === -1) {
    throw new Error(`Invalid model id "${id}" — expected "<provider>/<model>"`)
  }
  const provider = id.slice(0, slashIndex)
  const name = id.slice(slashIndex + 1)

  if (provider === 'anthropic') {
    if (!env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY is required to use Anthropic models')
    }
    const client = createAnthropic({ apiKey: env.ANTHROPIC_API_KEY })
    return client(name)
  }

  if (provider === 'openai') {
    if (!env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is required to use OpenAI models')
    }
    const client = createOpenAI({ apiKey: env.OPENAI_API_KEY })
    return client(name)
  }

  throw new Error(`Unsupported model provider "${provider}" in id "${id}"`)
}

/** Best-effort: are we using an Anthropic model? Used to decide cache markers. */
export function isAnthropicModelId(modelId: string | undefined): boolean {
  return (modelId ?? DEFAULT_MODEL_ID).startsWith('anthropic/')
}
