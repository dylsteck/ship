/**
 * Builds the agent's system prompt from sandbox context.
 *
 * The prompt is intentionally compact and stays the same shape from turn to
 * turn so providers can prompt-cache it. Everything that varies per turn lives
 * in the user message, not here.
 *
 * @packageDocumentation
 */

/**
 * Inputs that influence the system prompt content.
 */
export interface SystemPromptInput {
  /** Workspace root inside the sandbox (e.g. `/home/user/project`). */
  workingDirectory?: string
  /** Current git branch in the workspace, when known. */
  currentBranch?: string
  /** Free-form description of the runtime (host, ports, tools available). */
  environmentDetails?: string
  /** End-user supplied custom instructions (kept short). */
  customInstructions?: string
  /** Optional plan-mode hint that disables write/edit/bash. */
  planMode?: boolean
}

/** Default working directory when none is provided. */
const DEFAULT_WORKING_DIRECTORY = '/home/user'

/**
 * Build the agent's system prompt.
 *
 * @remarks
 * Treat the result as cache-friendly: do not interpolate per-turn data into
 * it; pass per-turn data via {@link convertToModelMessages} input instead.
 *
 * @example
 * ```ts
 * const prompt = buildSystemPrompt({ workingDirectory: '/home/user/repo', currentBranch: 'main' })
 * ```
 */
export function buildSystemPrompt(input: SystemPromptInput): string {
  const cwd = input.workingDirectory ?? DEFAULT_WORKING_DIRECTORY
  const sections: string[] = []

  sections.push(buildIdentitySection(input.planMode === true))
  sections.push(buildWorkspaceSection(cwd, input.currentBranch))
  if (input.environmentDetails?.trim()) {
    sections.push(buildEnvironmentSection(input.environmentDetails.trim()))
  }
  sections.push(buildToolGuidelinesSection(input.planMode === true))
  if (input.customInstructions?.trim()) {
    sections.push(buildCustomInstructionsSection(input.customInstructions.trim()))
  }

  return sections.join('\n\n').trim()
}

function buildIdentitySection(planMode: boolean): string {
  return [
    '# Ship — software engineering agent',
    '',
    'You are Ship, a senior software engineer that ships changes by reading code, planning, editing, and verifying.',
    planMode
      ? 'You are currently in **plan mode** — analyze, propose a plan, and ASK before mutating the workspace.'
      : 'Default to action: when the user asks for a code change, make it, verify it, and report back.',
  ].join('\n')
}

function buildWorkspaceSection(cwd: string, branch?: string): string {
  const lines = [
    '## Workspace',
    `- Working directory: ${cwd}`,
    `- All bash, read, write, edit, glob and grep tools are rooted at this directory by default.`,
    `- NEVER prepend \`cd ${cwd} &&\` to bash commands — the cwd is already set.`,
  ]
  if (branch) lines.push(`- Current git branch: ${branch}`)
  return lines.join('\n')
}

function buildEnvironmentSection(details: string): string {
  return ['## Environment', details].join('\n')
}

function buildToolGuidelinesSection(planMode: boolean): string {
  const lines = [
    '## Tool guidelines',
    '- Use `read` to inspect files. Always read before editing with `edit` or `write`.',
    '- Use `grep` and `glob` instead of `bash` for searching/listing files.',
    '- Use `bash` for build/test/lint and read-only git inspection (status, diff, log).',
    '- Prefer multiple targeted reads/edits over one giant write.',
    '- Use `todo_write` to track multi-step plans; keep one item `in_progress` at a time.',
    '- Use `ask_user_question` only when blocked on a real ambiguity.',
  ]
  if (planMode) {
    lines.push(
      '- Plan mode: do NOT call `write`, `edit` or write-side `bash` commands. Produce a plan and stop.',
    )
  }
  return lines.join('\n')
}

function buildCustomInstructionsSection(customInstructions: string): string {
  return ['## User instructions', customInstructions].join('\n')
}
