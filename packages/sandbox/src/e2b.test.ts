import { describe, expect, it, vi } from 'vitest'
import { E2BSandboxAdapter } from './e2b'

describe('E2BSandboxAdapter', () => {
  it('returns Compute SDK URLs from domain()', async () => {
    const adapter = new E2BSandboxAdapter(
      fakeSandbox({
        getUrl: vi.fn().mockResolvedValue('https://sbx.example'),
      }),
      'e2b_key',
      { workingDirectory: '/home/user' },
    )

    await expect(adapter.domain(3000)).resolves.toBe('https://sbx.example')
  })

  it('preserves Dirent-style readdir behavior through native find output', async () => {
    const adapter = new E2BSandboxAdapter(
      fakeSandbox({
        nativeRun: vi.fn().mockResolvedValue({ stdout: 'd src\nf package.json\nl current\n', exitCode: 0 }),
      }),
      'e2b_key',
      { workingDirectory: '/home/user' },
    )

    const entries = await adapter.readdir('/repo')

    expect(entries.map((entry) => entry.name)).toEqual(['src', 'package.json', 'current'])
    expect(entries[0]?.isDirectory()).toBe(true)
    expect(entries[1]?.isFile()).toBe(true)
    expect(entries[2]?.isSymbolicLink()).toBe(true)
  })
})

function fakeSandbox(overrides: {
  getUrl?: (options: { port: number }) => Promise<string>
  nativeRun?: (command: string, options?: unknown) => Promise<{ stdout?: string; stderr?: string; exitCode?: number }>
}) {
  return {
    sandboxId: 'sbx-1',
    provider: 'e2b',
    filesystem: {
      readFile: vi.fn(),
      writeFile: vi.fn(),
      mkdir: vi.fn(),
      readdir: vi.fn(),
      exists: vi.fn(),
      remove: vi.fn(),
    },
    runCommand: vi.fn(),
    getInfo: vi.fn(),
    getUrl: overrides.getUrl ?? vi.fn(),
    destroy: vi.fn(),
    getProvider: vi.fn(),
    getInstance: () => ({
      commands: { run: overrides.nativeRun ?? vi.fn() },
      setTimeout: vi.fn(),
      pause: vi.fn(),
    }),
  } as never
}
