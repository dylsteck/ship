/**
 * `read` — read a file from the sandbox workspace.
 *
 * @packageDocumentation
 */

import { tool } from 'ai'
import { z } from 'zod'
import { getAgentContext, resolveWorkspacePath, toDisplayPath } from './utils'

const DEFAULT_LIMIT = 2000
const MAX_BYTES = 1_500_000

const readInputSchema = z.object({
  filePath: z.string().min(1).describe('Workspace-relative path to the file (e.g. "src/index.ts")'),
  offset: z.number().int().min(1).optional().describe('1-indexed line number to start at'),
  limit: z.number().int().min(1).optional().describe(`Max lines to return (default ${DEFAULT_LIMIT})`),
})

/**
 * Build the `read` tool.
 *
 * @returns AI SDK Tool that reads a file via the sandbox handle on
 *   `experimental_context.sandbox`.
 */
export const readTool = () =>
  tool({
    description: [
      'Read a file from the workspace.',
      'USAGE:',
      '- Workspace-relative paths preferred (e.g., "src/index.ts").',
      '- Returns a "N\\tcontent" line-numbered view (1-indexed).',
      '- Default limit is 2000 lines; use offset/limit for long files.',
      'BEFORE EDITING:',
      '- Always read a file at least once before editing it.',
    ].join('\n'),
    inputSchema: readInputSchema,
    execute: async ({ filePath, offset = 1, limit = DEFAULT_LIMIT }, { experimental_context }) => {
      const { sandbox } = getAgentContext(experimental_context, 'read')
      const absolutePath = resolveWorkspacePath(filePath, sandbox.workingDirectory)

      const content = await sandbox.readFile(absolutePath, 'utf-8')
      if (content.length > MAX_BYTES) {
        return {
          ok: false as const,
          error: `File too large (${content.length} bytes). Use offset/limit or read with bash.`,
          path: toDisplayPath(absolutePath, sandbox.workingDirectory),
        }
      }
      const allLines = content.split('\n')
      const start = Math.max(0, offset - 1)
      const end = Math.min(allLines.length, start + limit)
      const view = allLines
        .slice(start, end)
        .map((line, i) => `${start + i + 1}\t${line}`)
        .join('\n')

      return {
        ok: true as const,
        path: toDisplayPath(absolutePath, sandbox.workingDirectory),
        totalLines: allLines.length,
        offset: start + 1,
        limit: end - start,
        truncated: end < allLines.length,
        content: view,
      }
    },
  })
