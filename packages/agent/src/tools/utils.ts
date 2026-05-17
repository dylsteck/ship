/**
 * Shared helpers for tool implementations.
 *
 * Tools never construct sandboxes — they receive a {@link Sandbox} via
 * `experimental_context` and call its methods. This makes tools testable
 * with a fake sandbox and keeps backend specifics out of the loop.
 *
 * @packageDocumentation
 */

import type { Sandbox } from '@ship/sandbox'

/**
 * Context passed to every tool's `execute` via AI SDK's
 * `experimental_context` channel.
 */
export interface AgentToolContext {
  /** Live sandbox handle for this turn. */
  sandbox: Sandbox
}

/**
 * Narrow `experimental_context` to {@link AgentToolContext}.
 *
 * @throws Error if the context isn't shaped correctly. This indicates a
 *   programmer error (forgot to pass `experimental_context` to streamText).
 */
export function getAgentContext(value: unknown, toolName: string): AgentToolContext {
  if (
    typeof value === 'object' &&
    value !== null &&
    'sandbox' in value &&
    typeof (value as AgentToolContext).sandbox === 'object'
  ) {
    return value as AgentToolContext
  }
  throw new Error(
    `[tool:${toolName}] experimental_context.sandbox is missing — wire it through streamText({ experimental_context })`,
  )
}

/**
 * Resolve a workspace-relative path against the sandbox working directory.
 *
 * @param input - Path passed by the model. Workspace-relative or absolute.
 * @param workingDirectory - The agent's working directory.
 * @returns Absolute path safe to pass to sandbox file operations.
 */
export function resolveWorkspacePath(input: string, workingDirectory: string): string {
  if (!input) return workingDirectory
  if (input.startsWith('/')) return input
  // Avoid path module on workers — sandbox is POSIX-only.
  const trimmedRoot = workingDirectory.replace(/\/+$/, '')
  const trimmedInput = input.replace(/^\.\//, '')
  return `${trimmedRoot}/${trimmedInput}`
}

/**
 * Convert an absolute sandbox path to a compact display path relative to
 * the working directory. Falls back to the absolute path on mismatch.
 */
export function toDisplayPath(absolutePath: string, workingDirectory: string): string {
  const trimmed = workingDirectory.replace(/\/+$/, '')
  if (absolutePath === trimmed) return '.'
  if (absolutePath.startsWith(`${trimmed}/`)) {
    return absolutePath.slice(trimmed.length + 1)
  }
  return absolutePath
}

/**
 * Quote a string for safe interpolation into a single bash command.
 *
 * Uses single-quote wrapping with `'\''` escapes — same pattern shells use.
 */
export function shellQuote(input: string): string {
  return `'${input.replace(/'/g, "'\\''")}'`
}
