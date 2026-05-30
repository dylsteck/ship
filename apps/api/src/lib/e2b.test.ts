import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createComputeSandbox,
  getNativeE2BSandbox,
  requireComputeSandbox,
} from './compute-provider'
import {
  buildComputeCreateOptions,
  createSessionSandbox,
  getSandboxStatus,
  refreshSandboxTimeout,
  resumeSandbox,
} from './e2b'

vi.mock('./compute-provider', () => ({
  connectComputeSandbox: vi.fn(),
  createComputeSandbox: vi.fn(),
  destroyComputeSandbox: vi.fn(),
  getNativeE2BSandbox: vi.fn((sandbox: { native: unknown }) => sandbox.native),
  requireComputeSandbox: vi.fn(),
}))

describe('E2B Compute SDK lifecycle helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('maps Ship sandbox config to Compute SDK create options', () => {
    expect(
      buildComputeCreateOptions({
        sessionId: 'session-1',
        timeoutMs: 1234,
        autoPause: false,
        metadata: { source: 'test' },
        envs: { OPENAI_API_KEY: 'sk-test' },
      }),
    ).toEqual({
      templateId: 'n1exdf9kj7gpwk6810c9',
      lifecycle: { onTimeout: 'kill' },
      timeout: 1234,
      metadata: { sessionId: 'session-1', source: 'test' },
      envs: { OPENAI_API_KEY: 'sk-test' },
    })
  })

  it('creates sandboxes with Compute SDK options', async () => {
    vi.mocked(createComputeSandbox).mockResolvedValue({ sandboxId: 'sbx-1' } as never)

    await expect(createSessionSandbox('e2b_key', { sessionId: 'session-1' })).resolves.toMatchObject({
      id: 'sbx-1',
      status: 'active',
      metadata: { sessionId: 'session-1' },
    })
    expect(createComputeSandbox).toHaveBeenCalledWith(
      'e2b_key',
      expect.objectContaining({
        templateId: 'n1exdf9kj7gpwk6810c9',
        lifecycle: { onTimeout: 'pause' },
        timeout: 300_000,
      }),
    )
  })

  it('wraps missing reconnects in resume errors', async () => {
    vi.mocked(requireComputeSandbox).mockRejectedValue(new Error('Sandbox not found: missing-sbx'))

    await expect(resumeSandbox('e2b_key', 'missing-sbx')).rejects.toMatchObject({
      code: 'RESUME_FAILED',
      sandboxId: 'missing-sbx',
    })
  })

  it('wraps missing status checks in status errors', async () => {
    vi.mocked(requireComputeSandbox).mockRejectedValue(new Error('Sandbox not found: missing-sbx'))

    await expect(getSandboxStatus('e2b_key', 'missing-sbx')).rejects.toMatchObject({
      code: 'STATUS_FAILED',
      sandboxId: 'missing-sbx',
    })
  })

  it('retries resume when native timeout refresh is rate limited', async () => {
    vi.useFakeTimers()
    try {
      const native = {
        setTimeout: vi
          .fn()
          .mockRejectedValueOnce(new Error('429 too many requests'))
          .mockResolvedValueOnce(undefined),
      }
      vi.mocked(requireComputeSandbox).mockResolvedValue({ sandboxId: 'sbx-1', native } as never)

      const result = resumeSandbox('e2b_key', 'sbx-1')
      await vi.advanceTimersByTimeAsync(1500)

      await expect(result).resolves.toMatchObject({ id: 'sbx-1', status: 'active' })
      expect(native.setTimeout).toHaveBeenCalledTimes(2)
    } finally {
      vi.useRealTimers()
    }
  })

  it('refreshes timeouts through the native E2B instance', async () => {
    const native = { setTimeout: vi.fn() }
    vi.mocked(requireComputeSandbox).mockResolvedValue({ native } as never)

    await refreshSandboxTimeout('e2b_key', 'sbx-1', 42_000)

    expect(requireComputeSandbox).toHaveBeenCalledWith('e2b_key', 'sbx-1')
    expect(getNativeE2BSandbox).toHaveBeenCalled()
    expect(native.setTimeout).toHaveBeenCalledWith(42_000)
  })
})
