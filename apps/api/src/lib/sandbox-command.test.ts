import { describe, expect, it, vi } from 'vitest'
import { didSandboxCommandFail, runSandboxCommand, sandboxCommandErrorText } from './sandbox-command'

describe('sandbox command compatibility', () => {
  it('maps timeoutMs and envs to native E2B command options when available', async () => {
    const nativeRun = vi.fn().mockResolvedValue({ stdout: 'ok', exitCode: 0 })
    const sandbox = {
      runCommand: vi.fn(),
      getInstance: () => ({ commands: { run: nativeRun } }),
    }

    await runSandboxCommand(sandbox, 'git clone', {
      cwd: '/repo',
      timeoutMs: 120_000,
      envs: { GITHUB_CLONE_TOKEN: 'token' },
    })

    expect(nativeRun).toHaveBeenCalledWith('git clone', {
      cwd: '/repo',
      timeoutMs: 120_000,
      envs: { GITHUB_CLONE_TOKEN: 'token' },
    })
    expect(sandbox.runCommand).not.toHaveBeenCalled()
  })

  it('maps Ship command options to Compute SDK runCommand options', async () => {
    const sandbox = {
      runCommand: vi.fn().mockResolvedValue({ stdout: 'ok', exitCode: 0 }),
    }

    await runSandboxCommand(sandbox, 'git status', {
      cwd: '/repo',
      timeout: 10_000,
      env: { CI: '1' },
      background: true,
    })

    expect(sandbox.runCommand).toHaveBeenCalledWith('git status', {
      cwd: '/repo',
      timeout: 10_000,
      env: { CI: '1' },
      background: true,
    })
  })

  it('maps env and background consistently on the native E2B path', async () => {
    const nativeRun = vi.fn().mockResolvedValue({ stdout: 'ok', exitCode: 0 })
    const sandbox = {
      runCommand: vi.fn(),
      getInstance: () => ({ commands: { run: nativeRun } }),
    }

    await runSandboxCommand(sandbox, 'npm run dev', {
      env: { PORT: '3000' },
      background: true,
    })

    expect(nativeRun).toHaveBeenCalledWith('nohup npm run dev > /dev/null 2>&1 &', {
      envs: { PORT: '3000' },
    })
    expect(sandbox.runCommand).not.toHaveBeenCalled()
  })

  it('normalizes command failure detection and messages', () => {
    expect(didSandboxCommandFail({ exitCode: 1 })).toBe(true)
    expect(didSandboxCommandFail({ error: 'boom', exitCode: 0 })).toBe(true)
    expect(didSandboxCommandFail({ exitCode: 0 })).toBe(false)
    expect(sandboxCommandErrorText({ stderr: 'bad', exitCode: 1 })).toBe('bad')
  })
})
