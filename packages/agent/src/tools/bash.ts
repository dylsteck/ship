/**
 * `bash` — run a non-interactive shell command in the sandbox.
 *
 * @packageDocumentation
 */

import { tool } from 'ai'
import { z } from 'zod'
import { bashCommandNeedsApproval } from './path-security'
import { getAgentContext, resolveWorkspacePath } from './utils'

const TIMEOUT_MS = 120_000

const bashInputSchema = z.object({
  command: z.string().min(1).describe('Bash command to execute (no interactive shells)'),
  cwd: z
    .string()
    .optional()
    .describe('Workspace-relative working directory for the command (defaults to workspace root)'),
})

/**
 * Build the `bash` tool.
 *
 * @remarks
 * Honors {@link bashCommandNeedsApproval} so dangerous commands surface to
 * the UI as approval prompts before executing.
 */
export const bashTool = () =>
  tool({
    description: [
      'Execute a non-interactive bash command.',
      'WHEN TO USE:',
      '- Build/test/lint commands, package managers, read-only git inspection.',
      'WHEN NOT TO USE:',
      '- File reads → use `read`. File edits → use `edit`/`write`. Search → use `grep`/`glob`.',
      'RULES:',
      '- Never prepend `cd <workspace> &&` — the cwd is already set.',
      '- Output is truncated at ~50,000 chars; commands time out at ~2 minutes.',
      '- Do not chain commands with `;` or `&&` — call this tool again per step.',
    ].join('\n'),
    inputSchema: bashInputSchema,
    needsApproval: async ({ command }) => bashCommandNeedsApproval(command),
    execute: async ({ command, cwd }, { experimental_context, abortSignal }) => {
      const { sandbox } = getAgentContext(experimental_context, 'bash')
      const workingDir = cwd ? resolveWorkspacePath(cwd, sandbox.workingDirectory) : sandbox.workingDirectory
      const result = await sandbox.exec(command, workingDir, TIMEOUT_MS, {
        ...(abortSignal ? { signal: abortSignal } : {}),
      })
      return {
        ok: result.success,
        exitCode: result.exitCode,
        stdout: result.stdout,
        stderr: result.stderr,
        ...(result.truncated ? { truncated: true } : {}),
      }
    },
  })
