/**
 * Sandbox interface — stable VM IO surface (`exec`, files, tunnel URLs).
 *
 * @remarks
 * Chat intelligence now runs **inside** the VM behind ACP; the Worker mainly provisions + bridges RPC.
 *
 * @packageDocumentation
 */

export type SandboxBackend = 'e2b'

/** Generic Dirent shape. We intentionally avoid pulling fs.Dirent on Workers. */
export interface SandboxDirent {
  name: string
  isDirectory: () => boolean
  isFile: () => boolean
  isSymbolicLink: () => boolean
}

export interface SandboxStats {
  isDirectory: () => boolean
  isFile: () => boolean
  size: number
  mtimeMs: number
}

export interface ExecResult {
  success: boolean
  exitCode: number | null
  stdout: string
  stderr: string
  truncated: boolean
}

/**
 * Persistable identity for a sandbox instance.
 *
 * Stored on `chat_sessions` (D1) and the SessionDO. Re-attaching to a
 * sandbox is just `connectSandbox(state)` — never re-provision.
 */
export type SandboxState =
  | {
      type: 'e2b'
      sandboxId: string
      /** Wall-clock ms when the sandbox is expected to expire/auto-pause. */
      expiresAt?: number
    }

export interface Sandbox {
  readonly type: SandboxBackend
  /** Workspace root inside the VM. */
  readonly workingDirectory: string
  /** Optional: current git branch when known. */
  readonly currentBranch?: string
  /** Optional: short, agent-prompt-friendly env description. */
  readonly environmentDetails?: string
  /** Optional: ISO ms timestamp when the sandbox is expected to expire. */
  readonly expiresAt?: number

  readFile(path: string, encoding: 'utf-8'): Promise<string>
  writeFile(path: string, content: string, encoding: 'utf-8'): Promise<void>
  stat(path: string): Promise<SandboxStats>
  mkdir(path: string, options?: { recursive?: boolean }): Promise<void>
  readdir(path: string): Promise<SandboxDirent[]>

  /** Execute a shell command and return result. */
  exec(command: string, cwd: string, timeoutMs: number, options?: { signal?: AbortSignal }): Promise<ExecResult>

  /** Get the public URL/host for an exposed port (e.g. dev server). */
  domain?(port: number): Promise<string>

  /** Refresh the sandbox auto-pause timeout. */
  extendTimeout(timeoutMs: number): Promise<void>

  /** Pause the sandbox (cost control). State survives. */
  pause(): Promise<void>

  /** Persistable state — reconnect with `connectSandbox(state)`. */
  getState(): SandboxState
}
