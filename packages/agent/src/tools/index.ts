/**
 * Default tool kit for the Ship agent.
 *
 * @packageDocumentation
 */

import type { Tool, ToolSet } from 'ai'
import { askUserQuestionTool } from './ask-user-question'
import { bashTool } from './bash'
import { editTool } from './edit'
import { globTool } from './glob'
import { grepTool } from './grep'
import { readTool } from './read'
import { todoWriteTool } from './todo'
import { writeTool } from './write'

export { askUserQuestionTool } from './ask-user-question'
export { bashTool } from './bash'
export { editTool } from './edit'
export { globTool } from './glob'
export { grepTool } from './grep'
export { readTool } from './read'
export { todoWriteTool, type TodoItem, type TodoStatus } from './todo'
export { writeTool } from './write'
export { bashCommandNeedsApproval, isDotEnvFilePath, isSensitivePath } from './path-security'
export { getAgentContext, resolveWorkspacePath, toDisplayPath, type AgentToolContext } from './utils'

/**
 * Build the full default tool kit.
 *
 * @param options - Per-mode flags (e.g. plan mode disables write tools).
 * @returns Tool set ready to pass to {@link streamText}.
 */
export function buildToolSet(options: { planMode?: boolean } = {}): ToolSet {
  const baseTools: Record<string, Tool> = {
    read: readTool(),
    grep: grepTool(),
    glob: globTool(),
    bash: bashTool(),
    todo_write: todoWriteTool(),
    ask_user_question: askUserQuestionTool(),
  }
  if (!options.planMode) {
    baseTools['write'] = writeTool()
    baseTools['edit'] = editTool()
  }
  return baseTools as ToolSet
}
