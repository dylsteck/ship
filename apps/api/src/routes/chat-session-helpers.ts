/**
 * Small shared helpers for chat HTTP routes.
 *
 * Before the agent harness moved out of the VM these helpers wrapped
 * sandbox-agent's session API; now they only own UI-facing concerns
 * (error messages, settings link).
 *
 * @packageDocumentation
 */

/** Path to the settings page surfaced in error actions. */
export const SETTINGS_PATH = '/settings'

/**
 * Append stdout/stderr context to a base error message when available.
 *
 * @param cmdErr - Error object that may carry stdout/stderr (e.g. from E2B's
 *   CommandExitError).
 * @param base - Human-friendly explanation of what went wrong.
 */
export function cloneFailureDetails(cmdErr: { stderr?: string; stdout?: string }, base: string): string {
  const extra = [cmdErr.stderr, cmdErr.stdout].filter(Boolean).join('\n').trim()
  if (!extra) return base
  return `${base}\n\n${extra.slice(0, 4000)}`
}

/**
 * Persist a system-role error message on the session so the user sees it
 * after a refresh.
 */
export async function persistChatErrorMessage(
  stub: { fetch: typeof fetch },
  doUrl: string,
  content: string,
  category: 'transient' | 'persistent' | 'user-action' | 'fatal',
  retryable: boolean,
  action?: { label: string; href: string },
): Promise<void> {
  try {
    await stub.fetch(
      new Request(`${doUrl}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: 'system',
          content,
          parts: JSON.stringify([
            {
              type: 'error',
              category,
              retryable,
              ...(action ? { action } : {}),
            },
          ]),
        }),
      }),
    )
  } catch (e) {
    console.warn('[chat] Failed to persist error message:', e)
  }
}
