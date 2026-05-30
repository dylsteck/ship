import { describe, expect, it, vi } from 'vitest'

import { commitChanges, GitWorkflowError, pushBranch } from './git-workflow'
import type { ComputeCommandSandbox, SandboxCommandOutput } from './sandbox-command'

function fakeSandbox(outputs: SandboxCommandOutput[]): ComputeCommandSandbox & { runCommand: ReturnType<typeof vi.fn> } {
  return {
    runCommand: vi.fn(async () => outputs.shift() ?? { stdout: '', exitCode: 0 }),
  }
}

describe('git workflow Effect compatibility wrappers', () => {
  it('preserves NO_CHANGES commit behavior', async () => {
    const sandbox = fakeSandbox([
      { stdout: '', exitCode: 0 },
      { stdout: '', exitCode: 0 },
      { stdout: '', exitCode: 0 },
    ])

    await expect(
      commitChanges(sandbox, 'test commit', { name: 'Ship Agent', email: 'shipagent@dylansteck.com' }),
    ).rejects.toMatchObject({
      code: 'NO_CHANGES',
      message: 'No changes to commit',
    })
  })

  it('resets the remote URL when push fails after installing token auth', async () => {
    const sandbox = fakeSandbox([
      { stdout: 'https://github.com/acme/app.git\n', exitCode: 0 },
      { stdout: '', exitCode: 0 },
      { stderr: 'rejected', exitCode: 1 },
      { stdout: '', exitCode: 0 },
    ])

    await expect(pushBranch(sandbox, 'ship-test', 'gho_secret')).rejects.toBeInstanceOf(GitWorkflowError)

    expect(sandbox.runCommand).toHaveBeenNthCalledWith(
      2,
      'cd /home/user/repo && git remote set-url origin "https://x-access-token:gho_secret@github.com/acme/app.git"',
      {},
    )
    expect(sandbox.runCommand).toHaveBeenNthCalledWith(
      4,
      'cd /home/user/repo && git remote set-url origin "https://github.com/acme/app.git"',
      {},
    )
  })
})
