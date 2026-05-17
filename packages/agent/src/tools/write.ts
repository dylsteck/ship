/**
 * `write` — overwrite a file with new content.
 *
 * @packageDocumentation
 */

import { tool } from 'ai'
import { z } from 'zod'
import { getAgentContext, resolveWorkspacePath, toDisplayPath } from './utils'

const writeInputSchema = z.object({
  filePath: z.string().min(1).describe('Workspace-relative path to the file'),
  content: z.string().describe('Full new content for the file'),
})

/** Build the `write` tool. */
export const writeTool = () =>
  tool({
    description: [
      'Write (or overwrite) a file with the given content.',
      'USAGE:',
      '- Workspace-relative paths preferred.',
      '- Creates parent directories as needed.',
      '- For small in-place edits prefer the `edit` tool — `write` replaces the entire file.',
    ].join('\n'),
    inputSchema: writeInputSchema,
    execute: async ({ filePath, content }, { experimental_context }) => {
      const { sandbox } = getAgentContext(experimental_context, 'write')
      const absolutePath = resolveWorkspacePath(filePath, sandbox.workingDirectory)
      await sandbox.writeFile(absolutePath, content, 'utf-8')
      return {
        ok: true as const,
        path: toDisplayPath(absolutePath, sandbox.workingDirectory),
        bytes: content.length,
      }
    },
  })
