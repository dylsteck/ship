/**
 * E2B-backed Sandbox implementation.
 *
 * Wraps `@computesdk/e2b` so the agent's tools call a small, stable
 * surface (`exec`, `readFile`, `writeFile`, ...) instead of speaking to an
 * in-VM HTTP server. The agent harness lives outside the VM.
 */

import { e2b } from '@computesdk/e2b'
import type {
  ExecResult,
  Sandbox,
  SandboxDirent,
  SandboxState,
  SandboxStats,
} from './interface'

/** Default custom E2B template ID baked with common dev tools. */
export const E2B_TEMPLATE_ID = 'n1exdf9kj7gpwk6810c9'

const MAX_OUTPUT_LENGTH = 50_000
const DEFAULT_WORKING_DIRECTORY = '/home/user'
const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000

type E2BCompute = ReturnType<typeof e2b>
type E2BProviderSandbox = Awaited<ReturnType<E2BCompute['sandbox']['create']>>

function truncate(output: string): { output: string; truncated: boolean } {
  if (output.length <= MAX_OUTPUT_LENGTH) return { output, truncated: false }
  return { output: output.slice(0, MAX_OUTPUT_LENGTH), truncated: true }
}

function shellQuote(s: string): string {
  return `'${s.replace(/'/g, "'\\''")}'`
}

interface E2BCommandError extends Error {
  exitCode?: number
  stdout?: string
  stderr?: string
}

interface E2BSandboxConfig {
  apiKey: string
  /** Inject env vars (e.g. GITHUB_TOKEN) so commands inherit them. */
  envs?: Record<string, string>
  /** Initial timeout in ms before auto-pause. */
  timeoutMs?: number
  /** Metadata stored on the sandbox (e.g. sessionId). */
  metadata?: Record<string, string>
  /** Working directory (must exist or be creatable). Default: /home/user. */
  workingDirectory?: string
  /** Override template; falls back to E2B_TEMPLATE_ID, then E2B default. */
  template?: string
}

/**
 * Create a fresh sandbox.
 *
 * The returned wrapper is short-lived (don't store it across requests) — use
 * `state` + `connectSandbox(state)` to re-attach.
 */
export async function createE2BSandbox(config: E2BSandboxConfig): Promise<E2BSandboxAdapter> {
  const template = config.template ?? E2B_TEMPLATE_ID
  const provider = e2b({ apiKey: config.apiKey })
  const sandbox = await provider.sandbox.create({
    ...(template ? { templateId: template } : {}),
    lifecycle: { onTimeout: 'pause' },
    timeout: config.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    ...(config.metadata && { metadata: config.metadata }),
    ...(config.envs && Object.keys(config.envs).length > 0 && { envs: config.envs }),
  })

  return new E2BSandboxAdapter(sandbox, config.apiKey, {
    workingDirectory: config.workingDirectory ?? DEFAULT_WORKING_DIRECTORY,
  })
}

/**
 * Re-attach to an existing sandbox by id.
 * Auto-resumes if the sandbox is paused.
 */
export async function connectE2BSandbox(
  state: Extract<SandboxState, { type: 'e2b' }>,
  apiKey: string,
  options: { workingDirectory?: string; timeoutMs?: number } = {},
): Promise<E2BSandboxAdapter> {
  const provider = e2b({ apiKey })
  const sandbox = await provider.sandbox.getById(state.sandboxId)
  if (!sandbox) throw new Error(`Sandbox not found: ${state.sandboxId}`)
  await sandbox.getInstance().setTimeout(options.timeoutMs ?? DEFAULT_TIMEOUT_MS)

  return new E2BSandboxAdapter(sandbox, apiKey, {
    workingDirectory: options.workingDirectory ?? DEFAULT_WORKING_DIRECTORY,
  })
}

interface AdapterOptions {
  workingDirectory: string
  currentBranch?: string
  environmentDetails?: string
}

export class E2BSandboxAdapter implements Sandbox {
  readonly type = 'e2b' as const
  readonly workingDirectory: string
  readonly currentBranch?: string
  readonly environmentDetails?: string

  private sandbox: E2BProviderSandbox
  private apiKey: string

  constructor(sandbox: E2BProviderSandbox, apiKey: string, options: AdapterOptions) {
    this.sandbox = sandbox
    this.apiKey = apiKey
    this.workingDirectory = options.workingDirectory
    if (options.currentBranch !== undefined) this.currentBranch = options.currentBranch
    if (options.environmentDetails !== undefined) this.environmentDetails = options.environmentDetails
  }

  /** Apply environment details after-the-fact (e.g. once we know the branch). */
  withContext(options: { currentBranch?: string; environmentDetails?: string }): E2BSandboxAdapter {
    return new E2BSandboxAdapter(this.sandbox, this.apiKey, {
      workingDirectory: this.workingDirectory,
      ...(options.currentBranch !== undefined ? { currentBranch: options.currentBranch } : {}),
      ...(options.environmentDetails !== undefined ? { environmentDetails: options.environmentDetails } : {}),
    })
  }

  get expiresAt(): number | undefined {
    // E2B SDK doesn't expose remaining timeout cleanly; consumers should track via DO meta.
    return undefined
  }

  async readFile(path: string, _encoding: 'utf-8'): Promise<string> {
    return this.sandbox.filesystem.readFile(path)
  }

  async writeFile(path: string, content: string, _encoding: 'utf-8'): Promise<void> {
    // Ensure parent directory exists.
    const lastSep = path.lastIndexOf('/')
    if (lastSep > 0) {
      const parent = path.slice(0, lastSep)
      try {
        await this.sandbox.filesystem.mkdir(parent)
      } catch {
        // Directory may already exist — ignore.
      }
    }
    await this.sandbox.filesystem.writeFile(path, content)
  }

  async stat(path: string): Promise<SandboxStats> {
    const result = await this.runNativeCommand(`stat -c '%F\t%s\t%Y' ${shellQuote(path)}`).catch((e) => {
      throw new Error(`ENOENT: no such file or directory, stat '${path}': ${(e as Error).message}`)
    })
    const [fileType, sizeStr, mtimeStr] = (result.stdout ?? '').trim().split('\t')
    const isDir = fileType === 'directory'
    return {
      isDirectory: () => isDir,
      isFile: () => !isDir,
      size: Number.parseInt(sizeStr ?? '0', 10),
      mtimeMs: Number.parseInt(mtimeStr ?? '0', 10) * 1000,
    }
  }

  async mkdir(path: string, options?: { recursive?: boolean }): Promise<void> {
    if (options?.recursive) {
      await this.sandbox.filesystem.mkdir(path)
      return
    }
    await this.runNativeCommand(`mkdir ${shellQuote(path)}`)
  }

  async readdir(path: string): Promise<SandboxDirent[]> {
    const result = await this.runNativeCommand(`find ${shellQuote(path)} -maxdepth 1 -mindepth 1 -printf '%y %f\\n'`).catch((e) => {
      throw new Error(`ENOENT: no such file or directory, scandir '${path}': ${(e as Error).message}`)
    })

    const output = (result.stdout ?? '').trim()
    if (!output) return []

    return output.split('\n').map((line) => {
      const [type, ...nameParts] = line.split(' ')
      const name = nameParts.join(' ')
      const isDir = type === 'd'
      const isFile = type === 'f'
      const isSym = type === 'l'
      return {
        name,
        isDirectory: () => isDir,
        isFile: () => isFile,
        isSymbolicLink: () => isSym,
      }
    })
  }

  async exec(
    command: string,
    cwd: string,
    timeoutMs: number,
    options?: { signal?: AbortSignal },
  ): Promise<ExecResult> {
    try {
      const wrapped = `cd ${shellQuote(cwd)} && ${command}`
      // Race against caller's abort signal.
      const exec = this.runNativeCommand(wrapped, { timeoutMs, cwd })
      const result = await raceWithSignal(exec, options?.signal)
      const stdout = truncate(result.stdout ?? '')
      const stderr = truncate(result.stderr ?? '')
      return {
        success: result.exitCode === 0,
        exitCode: result.exitCode ?? null,
        stdout: stdout.output,
        stderr: stderr.output,
        truncated: stdout.truncated || stderr.truncated,
      }
    } catch (error) {
      // E2B throws CommandExitError on non-zero exit — surface it as a normal result.
      const ce = error as E2BCommandError
      if (typeof ce.exitCode === 'number') {
        const stdout = truncate(ce.stdout ?? '')
        const stderr = truncate(ce.stderr ?? '')
        return {
          success: false,
          exitCode: ce.exitCode,
          stdout: stdout.output,
          stderr: stderr.output,
          truncated: stdout.truncated || stderr.truncated,
        }
      }
      const message = error instanceof Error ? error.message : String(error)
      return { success: false, exitCode: null, stdout: '', stderr: message, truncated: false }
    }
  }

  domain(port: number): Promise<string> {
    return this.sandbox.getUrl({ port })
  }

  async extendTimeout(timeoutMs: number): Promise<void> {
    await this.sandbox.getInstance().setTimeout(timeoutMs)
  }

  async pause(): Promise<void> {
    await this.sandbox.getInstance().pause()
  }

  getState(): SandboxState {
    return { type: 'e2b', sandboxId: this.sandbox.sandboxId }
  }

  private runNativeCommand(
    command: string,
    options?: { timeoutMs?: number; cwd?: string; envs?: Record<string, string> },
  ): Promise<{ stdout?: string; stderr?: string; exitCode?: number }> {
    return this.sandbox.getInstance().commands.run(command, options)
  }
}

/** Reject when an external signal aborts; otherwise resolve with promise's value. */
async function raceWithSignal<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return promise
  if (signal.aborted) throw new DOMException('Aborted', 'AbortError')
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(new DOMException('Aborted', 'AbortError'))
    signal.addEventListener('abort', onAbort, { once: true })
    promise.then(
      (value) => {
        signal.removeEventListener('abort', onAbort)
        resolve(value)
      },
      (err) => {
        signal.removeEventListener('abort', onAbort)
        reject(err)
      },
    )
  })
}
