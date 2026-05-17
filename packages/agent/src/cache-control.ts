/**
 * Anthropic prompt-cache helpers.
 *
 * Anthropic's prompt cache lets us mark stable prefixes of the request so
 * subsequent turns reuse them. We mark:
 *   - the system prompt
 *   - the tool definitions
 *   - the last cacheable user message
 *
 * Inspired by `packages/agent/context-management/cache-control.ts` in
 * vercel-labs/open-agents.
 *
 * @packageDocumentation
 */

import type { ModelMessage } from 'ai'

/** Provider-options shape Anthropic understands for ephemeral cache breakpoints. */
const ANTHROPIC_EPHEMERAL: Record<string, Record<string, unknown>> = {
  anthropic: {
    cacheControl: { type: 'ephemeral' },
  },
}

/**
 * Add Anthropic prompt-cache markers to a list of messages.
 *
 * @param messages - The messages about to be sent to the model.
 * @returns A new array (never mutates input) with `providerOptions` set on
 *   the most recent system + assistant boundary appropriate for caching.
 */
export function withAnthropicCacheControl(messages: ModelMessage[]): ModelMessage[] {
  if (messages.length === 0) return messages

  const result = messages.map((m) => ({ ...m }))

  // Cache the system message (first), if present.
  const firstSystem = result.findIndex((m) => m.role === 'system')
  if (firstSystem !== -1) {
    result[firstSystem] = withProviderOptions(result[firstSystem]!, ANTHROPIC_EPHEMERAL)
  }

  // Cache the most recent assistant message before the latest user turn so we
  // include all prior tool history in the cached prefix.
  const lastAssistant = findLastIndex(result, (m) => m.role === 'assistant')
  if (lastAssistant !== -1) {
    result[lastAssistant] = withProviderOptions(result[lastAssistant]!, ANTHROPIC_EPHEMERAL)
  }

  return result
}

function withProviderOptions(message: ModelMessage, providerOptions: Record<string, Record<string, unknown>>): ModelMessage {
  // ModelMessage is a discriminated union; spread preserves role + content.
  return { ...message, providerOptions: mergeProviderOptions(message.providerOptions, providerOptions) } as ModelMessage
}

function mergeProviderOptions(
  existing: Record<string, Record<string, unknown>> | undefined,
  next: Record<string, Record<string, unknown>>,
): Record<string, Record<string, unknown>> {
  if (!existing) return next
  const merged: Record<string, Record<string, unknown>> = { ...existing }
  for (const [provider, options] of Object.entries(next)) {
    merged[provider] = { ...(existing[provider] ?? {}), ...options }
  }
  return merged
}

function findLastIndex<T>(array: T[], predicate: (value: T) => boolean): number {
  for (let i = array.length - 1; i >= 0; i--) {
    if (predicate(array[i]!)) return i
  }
  return -1
}
