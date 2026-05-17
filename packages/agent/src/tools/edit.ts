/**
 * `edit` — apply a unique-string replacement to a file.
 *
 * Mirrors the model's mental model of "find this exact block, replace it".
 * Validates uniqueness so accidental multi-replace doesn't happen silently.
 *
 * @packageDocumentation
 */

import { tool } from 'ai'
import { z } from 'zod'
import { getAgentContext, resolveWorkspacePath, toDisplayPath } from './utils'

const editInputSchema = z
  .object({
    filePath: z.string().min(1).describe('Workspace-relative path to the file'),
    oldString: z
      .string()
      .min(1)
      .describe('Exact text to replace. Must appear exactly once unless replaceAll=true.'),
    newString: z.string().describe('Text to insert in place of oldString'),
    replaceAll: z
      .boolean()
      .optional()
      .describe('Replace every occurrence instead of requiring exactly one match'),
  })
  .refine((input) => input.oldString !== input.newString, {
    message: 'oldString and newString must differ',
  })

/** Build the `edit` tool. */
export const editTool = () =>
  tool({
    description: [
      'Apply an exact-string replacement to a file.',
      'USAGE:',
      '- Provide oldString that uniquely identifies the location (5+ lines of context recommended).',
      '- Set replaceAll=true to change every occurrence.',
      '- Always read the file at least once before editing.',
    ].join('\n'),
    inputSchema: editInputSchema,
    execute: async ({ filePath, oldString, newString, replaceAll }, { experimental_context }) => {
      const { sandbox } = getAgentContext(experimental_context, 'edit')
      const absolutePath = resolveWorkspacePath(filePath, sandbox.workingDirectory)
      const original = await sandbox.readFile(absolutePath, 'utf-8')

      const occurrences = countOccurrences(original, oldString)
      if (occurrences === 0) {
        return {
          ok: false as const,
          error: 'oldString not found in file',
          path: toDisplayPath(absolutePath, sandbox.workingDirectory),
        }
      }
      if (occurrences > 1 && replaceAll !== true) {
        return {
          ok: false as const,
          error: `oldString matches ${occurrences} locations — pass more context to make it unique, or set replaceAll=true`,
          path: toDisplayPath(absolutePath, sandbox.workingDirectory),
        }
      }

      const updated = replaceAll
        ? original.split(oldString).join(newString)
        : original.replace(oldString, newString)

      await sandbox.writeFile(absolutePath, updated, 'utf-8')

      return {
        ok: true as const,
        path: toDisplayPath(absolutePath, sandbox.workingDirectory),
        replacements: replaceAll ? occurrences : 1,
      }
    },
  })

/**
 * Count non-overlapping occurrences of {@link needle} in {@link haystack}
 * without allocating arrays.
 */
function countOccurrences(haystack: string, needle: string): number {
  if (!needle) return 0
  let count = 0
  let from = 0
  while (true) {
    const i = haystack.indexOf(needle, from)
    if (i === -1) return count
    count++
    from = i + needle.length
  }
}
