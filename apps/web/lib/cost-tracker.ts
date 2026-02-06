export interface CostBreakdown {
  taskId: string
  inputTokens: number
  outputTokens: number
  estimatedCost: number
  model: string
}

// Model pricing per 1M tokens (input/output)
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  // Claude models (via OpenCode Zen)
  'opencode/claude-opus-4-6': { input: 15, output: 75 },
  'opencode/claude-opus-4-5': { input: 15, output: 75 },
  'opencode/claude-sonnet-4-5': { input: 3, output: 15 },
  // Claude models (direct Anthropic)
  'anthropic/claude-sonnet-4-20250514': { input: 3, output: 15 },
  'anthropic/claude-opus-4-20250514': { input: 15, output: 75 },
  'anthropic/claude-haiku-3-20250514': { input: 0.25, output: 1.25 },
  'claude-sonnet-4': { input: 3, output: 15 },
  'claude-opus-4': { input: 15, output: 75 },
  'claude-opus-4-6': { input: 15, output: 75 },
  'claude-haiku-3': { input: 0.25, output: 1.25 },
  // OpenAI models
  'gpt-4': { input: 10, output: 30 },
  'gpt-4-turbo': { input: 10, output: 30 },
  'gpt-3.5-turbo': { input: 0.5, output: 1.5 },
  // Default (Claude Sonnet pricing)
  default: { input: 3, output: 15 },
}

/**
 * Calculate estimated cost in USD based on token counts and model
 */
export function calculateCost(
  inputTokens: number,
  outputTokens: number,
  model: string,
): number {
  const pricing = MODEL_PRICING[model] || MODEL_PRICING.default

  const inputCost = (inputTokens / 1_000_000) * pricing.input
  const outputCost = (outputTokens / 1_000_000) * pricing.output

  return Number((inputCost + outputCost).toFixed(4))
}

/**
 * Aggregate token usage from SSE events
 */
export function aggregateCosts(events: Array<{ type: string; [key: string]: unknown }>): CostBreakdown[] {
  const taskCosts = new Map<string, { inputTokens: number; outputTokens: number; model: string }>()

  for (const event of events) {
    // Look for tool-call events with token information
    if (event.type === 'tool-call' || event.type === 'tool_call') {
      const tokens = event.tokens as { input?: number; output?: number } | undefined
      const model = (event.model as string) || 'default'
      const taskId = (event.taskId as string) || (event.messageId as string) || 'unknown'

      if (tokens) {
        const current = taskCosts.get(taskId) || {
          inputTokens: 0,
          outputTokens: 0,
          model,
        }

        taskCosts.set(taskId, {
          inputTokens: current.inputTokens + (tokens.input || 0),
          outputTokens: current.outputTokens + (tokens.output || 0),
          model: current.model || model,
        })
      }
    }
  }

  // Convert to CostBreakdown array
  return Array.from(taskCosts.entries()).map(([taskId, data]) => ({
    taskId,
    inputTokens: data.inputTokens,
    outputTokens: data.outputTokens,
    estimatedCost: calculateCost(data.inputTokens, data.outputTokens, data.model),
    model: data.model,
  }))
}
