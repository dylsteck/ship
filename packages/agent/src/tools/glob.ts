/**
 * `glob` — list workspace files matching a glob pattern.
 *
 * @packageDocumentation
 */

import { tool } from 'ai'
import { z } from 'zod'
import { getAgentContext, resolveWorkspacePath, shellQuote, toDisplayPath } from './utils'

const TIMEOUT_MS = 15_000
const MAX_RESULTS = 500

const globInputSchema = z.object({
  pattern: z.string().min(1).describe('Glob pattern (e.g. "src/**/*.ts")'),
  path: z.string().optional().describe('Workspace-relative root for the search (defaults to workspace root)'),
})

/** Build the `glob` tool. */
export const globTool = () =>
  tool({
    description: [
      'List workspace files matching a glob pattern.',
      'USAGE:',
      '- Glob is shell glob (`**`, `*`, `?`).',
      '- Returns up to 500 paths, workspace-relative, sorted by modified time desc.',
    ].join('\n'),
    inputSchema: globInputSchema,
    execute: async ({ pattern, path }, { experimental_context }) => {
      const { sandbox } = getAgentContext(experimental_context, 'glob')
      const searchRoot = path ? resolveWorkspacePath(path, sandbox.workingDirectory) : sandbox.workingDirectory

      // Use bash glob with sort by mtime; -printf is GNU-only but our sandbox is Linux.
      const command = `cd ${shellQuote(searchRoot)} && shopt -s globstar nullglob dotglob && for f in ${shellQuote(pattern).slice(1, -1)}; do stat -c '%Y\t%n' "$f" 2>/dev/null; done | sort -rn | head -n ${MAX_RESULTS} | cut -f2-`
      const result = await sandbox.exec(`bash -c ${shellQuote(command)}`, sandbox.workingDirectory, TIMEOUT_MS)

      const lines = result.stdout.split('\n').filter(Boolean)
      return {
        ok: true as const,
        path: toDisplayPath(searchRoot, sandbox.workingDirectory),
        count: lines.length,
        truncated: lines.length === MAX_RESULTS,
        files: lines,
      }
    },
  })
