/**
 * `@ship/agent` — out-of-VM agent harness for Ship.
 *
 * The harness composes:
 *   - {@link buildSystemPrompt} for a stable, cacheable system prompt
 *   - {@link buildToolSet} for the default file/shell/search/todo/ask toolkit
 *   - {@link withAnthropicCacheControl} for prompt-cache markers
 *   - {@link runAgentStep} which streams from the model with tools wired up
 *
 * @packageDocumentation
 */

export { runAgentStep, type RunAgentStepInput } from './agent'
export { withAnthropicCacheControl } from './cache-control'
export {
  DEFAULT_MODEL_ID,
  SUPPORTED_MODEL_IDS,
  isAnthropicModelId,
  resolveModel,
  type AgentModelEnv,
  type SupportedModelId,
} from './models'
export { buildSystemPrompt, type SystemPromptInput } from './system-prompt'
export {
  askUserQuestionTool,
  bashCommandNeedsApproval,
  bashTool,
  buildToolSet,
  editTool,
  getAgentContext,
  globTool,
  grepTool,
  isDotEnvFilePath,
  isSensitivePath,
  readTool,
  resolveWorkspacePath,
  toDisplayPath,
  todoWriteTool,
  writeTool,
  type AgentToolContext,
  type TodoItem,
  type TodoStatus,
} from './tools'
