/**
 * `grep` — fast workspace text search via ripgrep (with grep fallback).
 *
 * @packageDocumentation
 */

import { tool } from 'ai'
import { z } from 'zod'
import { getAgentContext, resolveWorkspacePath, shellQuote, toDisplayPath } from './utils'

const TIMEOUT_MS = 30_000
const MAX_RESULTS = 200

const grepInputSchema = z.object({
  pattern: z.string().min(1).describe('Regex pattern to search for'),
  path: z.string().optional().describe('Workspace-relative path to search (defaults to workspace root)'),
  ignoreCase: z.boolean().optional().describe('Case-insensitive search'),
  glob: z.string().optional().describe('Optional glob filter (e.g. "*.ts")'),
})

/** Build the `grep` tool. */
export const grepTool = () =>
  tool({
    description: [
      'Search workspace files for a regex pattern.',
      'USAGE:',
      '- Uses ripgrep (`rg`) when available, otherwise falls back to `grep -R`.',
      '- Returns up to 200 matches with line numbers.',
      '- Prefer this over `bash grep` so output is bounded and structured.',
    ].join('\n'),
    inputSchema: grepInputSchema,
    execute: async ({ pattern, path, ignoreCase, glob }, { experimental_context }) => {
      const { sandbox } = getAgentContext(experimental_context, 'grep')
      const searchPath = path ? resolveWorkspacePath(path, sandbox.workingDirectory) : sandbox.workingDirectory
      const command = buildGrepCommand({ pattern, path: searchPath, ignoreCase, glob })

      const result = await sandbox.exec(command, sandbox.workingDirectory, TIMEOUT_MS)
      // grep/rg exit 1 when there are no matches — that's not an error.
      const successful = result.exitCode === 0 || result.exitCode === 1
      if (!successful) {
        return {
          ok: false as const,
          error: result.stderr.trim() || `Search failed (exit code ${result.exitCode})`,
        }
      }

      const matches = result.stdout
        .split('\n')
        .filter(Boolean)
        .slice(0, MAX_RESULTS)
        .map((line) => ({ display: line, relative: relativizeMatch(line, sandbox.workingDirectory) }))

      return {
        ok: true as const,
        path: toDisplayPath(searchPath, sandbox.workingDirectory),
        count: matches.length,
        truncated: matches.length === MAX_RESULTS,
        matches: matches.map((m) => m.relative),
      }
    },
  })

function buildGrepCommand(opts: { pattern: string; path: string; ignoreCase?: boolean; glob?: string }): string {
  const flags = opts.ignoreCase ? '-i' : ''
  const globFlag = opts.glob ? `-g ${shellQuote(opts.glob)}` : ''
  const rgArgs = ['rg', '--line-number', '--no-heading', '--max-columns=400', flags, globFlag, '--', shellQuote(opts.pattern), shellQuote(opts.path)]
    .filter(Boolean)
    .join(' ')
  const grepArgs = `grep -RIn --binary-files=without-match ${flags} -- ${shellQuote(opts.pattern)} ${shellQuote(opts.path)}`
  return `command -v rg >/dev/null 2>&1 && ${rgArgs} || ${grepArgs}`
}

/** Reformat absolute path matches to workspace-relative for compactness. */
function relativizeMatch(line: string, workingDirectory: string): string {
  const trimmed = workingDirectory.replace(/\/+$/, '')
  const prefix = `${trimmed}/`
  if (line.startsWith(prefix)) return line.slice(prefix.length)
  if (line.startsWith(trimmed)) return line.slice(trimmed.length).replace(/^\//, '')
  return line
}
