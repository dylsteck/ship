/**
 * Connect to a sandbox by its persisted state.
 *
 * The agent never creates sandboxes itself — provisioning is done at session
 * start and the resulting state is persisted on the session row. Tools and
 * the durable run loop all start with `connectSandbox(state)`.
 */

import { connectE2BSandbox, type E2BSandboxAdapter } from './e2b'
import type { Sandbox, SandboxState } from './interface'

export interface ConnectOptions {
  /** API key for the chosen backend (E2B_API_KEY for `type: 'e2b'`). */
  apiKey: string
  /** Override the default working directory if the workspace lives elsewhere. */
  workingDirectory?: string
  /** Inject env vars (no-op when reconnecting; used at create time). */
  envs?: Record<string, string>
  /** Refresh the auto-pause timeout right after connect. */
  timeoutMs?: number
}

export async function connectSandbox(state: SandboxState, options: ConnectOptions): Promise<Sandbox> {
  switch (state.type) {
    case 'e2b': {
      const adapter: E2BSandboxAdapter = await connectE2BSandbox(state, options.apiKey, {
        ...(options.workingDirectory ? { workingDirectory: options.workingDirectory } : {}),
        ...(options.timeoutMs ? { timeoutMs: options.timeoutMs } : {}),
      })
      if (options.timeoutMs) {
        await adapter.extendTimeout(options.timeoutMs)
      }
      return adapter
    }
    default: {
      const _exhaustive: never = state.type
      throw new Error(`Unsupported sandbox backend: ${_exhaustive as string}`)
    }
  }
}
