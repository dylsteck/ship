/**
 * Ship agent — a thin wrapper around AI SDK's {@link streamText} that wires
 * up tools, the sandbox context, system prompt, and prompt-cache markers.
 *
 * The host (the API worker) is responsible for:
 *   - looping the result if the model finished with `tool-calls`,
 *   - persisting messages and forwarding the UIMessageChunk stream to the
 *     client.
 *
 * @packageDocumentation
 */

import { stepCountIs, streamText, type ModelMessage, type StreamTextResult, type ToolSet } from 'ai'
import type { Sandbox } from '@ship/sandbox'
import { withAnthropicCacheControl } from './cache-control'
import { isAnthropicModelId, resolveModel, type AgentModelEnv } from './models'
import { buildSystemPrompt } from './system-prompt'
import { buildToolSet } from './tools'

/**
 * Inputs for a single agent step (one call to {@link streamText}).
 */
export interface RunAgentStepInput {
  /** Live sandbox for this turn. */
  sandbox: Sandbox
  /** Model id to use (e.g. `anthropic/claude-3-7-sonnet-20250219`). */
  modelId?: string
  /** Custom user-level instructions appended to the system prompt. */
  customInstructions?: string
  /** Plan-mode disables write/edit tools. */
  planMode?: boolean
  /** Conversation history (already converted to ModelMessage). */
  messages: ModelMessage[]
  /** Caller-controlled abort signal; aborts the model + tool calls. */
  abortSignal?: AbortSignal
  /** Worker env containing API keys. */
  env: AgentModelEnv
  /** Override the default tool set (advanced). */
  tools?: ToolSet
  /** Stop loop when this many steps have run. Defaults to 30. */
  maxSteps?: number
}

const DEFAULT_MAX_STEPS = 30

/**
 * Run one agent step: send the conversation to the model, stream tool/text
 * deltas, and resolve when the model finishes its turn.
 *
 * The returned {@link StreamTextResult} can be:
 *   - `pipeUIMessageStreamToResponse` for SSE,
 *   - awaited via `result.finishReason` to decide whether to loop again.
 *
 * @example
 * ```ts
 * const result = await runAgentStep({ sandbox, env, messages, modelId })
 * for await (const chunk of result.toUIMessageStream()) writer.write(chunk)
 * ```
 */
export function runAgentStep(input: RunAgentStepInput): StreamTextResult<ToolSet, never> {
  const sandbox = input.sandbox
  const tools = input.tools ?? buildToolSet({ ...(input.planMode === true ? { planMode: true } : {}) })
  const systemPrompt = buildSystemPrompt({
    workingDirectory: sandbox.workingDirectory,
    ...(sandbox.currentBranch !== undefined ? { currentBranch: sandbox.currentBranch } : {}),
    ...(sandbox.environmentDetails !== undefined ? { environmentDetails: sandbox.environmentDetails } : {}),
    ...(input.customInstructions !== undefined ? { customInstructions: input.customInstructions } : {}),
    ...(input.planMode === true ? { planMode: true } : {}),
  })

  const messages = isAnthropicModelId(input.modelId)
    ? withAnthropicCacheControl(input.messages)
    : input.messages

  const model = resolveModel(input.modelId, input.env)

  return streamText({
    model,
    system: systemPrompt,
    messages,
    tools,
    stopWhen: stepCountIs(input.maxSteps ?? DEFAULT_MAX_STEPS),
    experimental_context: { sandbox },
    ...(input.abortSignal ? { abortSignal: input.abortSignal } : {}),
  })
}
