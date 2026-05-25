/**
 * Command compatibility helpers for Compute SDK sandboxes.
 *
 * @packageDocumentation
 */

/** Command execution result shape used by E2B and Compute SDK callsites. */
export interface SandboxCommandOutput {
  stdout?: string
  stderr?: string
  error?: string
  text?: string
  exitCode?: number
  logs?: {
    stdout?: string | string[]
    stderr?: string | string[]
  }
}

/** Options accepted by Ship command callsites. */
export interface SandboxCommandOptions {
  cwd?: string
  env?: Record<string, string>
  envs?: Record<string, string>
  timeout?: number
  timeoutMs?: number
  background?: boolean
}

/** Minimal native E2B command runner shape. */
export interface NativeCommandSandbox {
  commands: {
    run(
      command: string,
      options?: { cwd?: string; timeoutMs?: number; envs?: Record<string, string> },
    ): Promise<SandboxCommandOutput>
  }
}

/** Minimal Compute SDK command runner shape. */
export interface ComputeCommandSandbox {
  runCommand(command: string, options?: { cwd?: string; env?: Record<string, string>; timeout?: number; background?: boolean }): Promise<SandboxCommandOutput>
  getInstance?: () => Partial<NativeCommandSandbox>
}

/** Execute a command while preserving E2B `timeoutMs` and `envs` semantics when available. */
export async function runSandboxCommand(
  sandbox: ComputeCommandSandbox,
  command: string,
  options: SandboxCommandOptions = {},
): Promise<SandboxCommandOutput> {
  const timeoutMs = options.timeoutMs ?? options.timeout
  const envs = options.envs ?? options.env
  const native = sandbox.getInstance?.()

  if (native?.commands && (timeoutMs !== undefined || envs || options.background)) {
    const nativeCommand = options.background ? `nohup ${command} > /dev/null 2>&1 &` : command
    return native.commands.run(nativeCommand, {
      ...(options.cwd ? { cwd: options.cwd } : {}),
      ...(timeoutMs !== undefined ? { timeoutMs } : {}),
      ...(envs && Object.keys(envs).length > 0 ? { envs } : {}),
    })
  }

  return sandbox.runCommand(command, {
    ...(options.cwd ? { cwd: options.cwd } : {}),
    ...(timeoutMs !== undefined ? { timeout: timeoutMs } : {}),
    ...(envs && Object.keys(envs).length > 0 ? { env: envs } : {}),
    ...(options.background !== undefined ? { background: options.background } : {}),
  })
}

/** Whether a command result represents failure across E2B and Compute SDK shapes. */
export function didSandboxCommandFail(output: SandboxCommandOutput): boolean {
  return Boolean(output.error) || (typeof output.exitCode === 'number' && output.exitCode !== 0)
}

/** Human-readable command error text across E2B and Compute SDK result shapes. */
export function sandboxCommandErrorText(output: SandboxCommandOutput): string {
  return output.error || output.stderr || output.stdout || `Command failed with exit code ${output.exitCode ?? 'unknown'}`
}
