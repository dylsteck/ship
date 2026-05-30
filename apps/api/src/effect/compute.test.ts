import { Effect } from 'effect'
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  connectComputeSandbox,
  createComputeSandbox,
  destroyComputeSandbox,
  requireComputeSandbox,
} from '../lib/compute-provider'
import { ComputeSandboxes, ComputeSandboxesLive, type ComputeSandboxesService } from './compute'

vi.mock('../lib/compute-provider', () => ({
  createComputeSandbox: vi.fn(),
  connectComputeSandbox: vi.fn(),
  requireComputeSandbox: vi.fn(),
  destroyComputeSandbox: vi.fn(),
}))

function program<A, E>(use: (svc: ComputeSandboxesService) => Effect.Effect<A, E>) {
  return Effect.gen(function* () {
    const svc = yield* ComputeSandboxes
    return yield* use(svc)
  }).pipe(Effect.provide(ComputeSandboxesLive))
}

/** Run to its success value. */
const run = <A, E>(use: (svc: ComputeSandboxesService) => Effect.Effect<A, E>) =>
  Effect.runPromise(program(use))

/** Run an expected-failure program, resolving to the tagged error value. */
const runErr = <A, E>(use: (svc: ComputeSandboxesService) => Effect.Effect<A, E>) =>
  Effect.runPromise(Effect.flip(program(use)))

afterEach(() => {
  vi.clearAllMocks()
})

describe('ComputeSandboxes', () => {
  it('create returns the sandbox on success', async () => {
    vi.mocked(createComputeSandbox).mockResolvedValue({ sandboxId: 'sbx-1' } as never)
    const result = await run((s) => s.create('key', { templateId: 't' }))
    expect(result).toEqual({ sandboxId: 'sbx-1' })
    expect(createComputeSandbox).toHaveBeenCalledWith('key', { templateId: 't' })
  })

  it('create fails with SandboxCreateError when the provider throws', async () => {
    vi.mocked(createComputeSandbox).mockRejectedValue(new Error('boom'))
    const err = await runErr((s) => s.create('key', {}))
    expect(err._tag).toBe('SandboxCreateError')
  })

  it('connect returns null when the provider has no record', async () => {
    vi.mocked(connectComputeSandbox).mockResolvedValue(null)
    expect(await run((s) => s.connect('key', 'sbx-1'))).toBeNull()
  })

  it('connect fails with SandboxConnectError on throw', async () => {
    vi.mocked(connectComputeSandbox).mockRejectedValue(new Error('network'))
    const err = await runErr((s) => s.connect('key', 'sbx-1'))
    expect(err._tag).toBe('SandboxConnectError')
  })

  it('require maps "Sandbox not found" to SandboxNotFoundError', async () => {
    vi.mocked(requireComputeSandbox).mockRejectedValue(new Error('Sandbox not found: sbx-1'))
    const err = await runErr((s) => s.require('key', 'sbx-1'))
    expect(err._tag).toBe('SandboxNotFoundError')
  })

  it('require maps other failures to SandboxConnectError', async () => {
    vi.mocked(requireComputeSandbox).mockRejectedValue(new Error('network down'))
    const err = await runErr((s) => s.require('key', 'sbx-1'))
    expect(err._tag).toBe('SandboxConnectError')
  })

  it('require does not misclassify unrelated "not found" messages as 404', async () => {
    vi.mocked(requireComputeSandbox).mockRejectedValue(new Error('template not found'))
    const err = await runErr((s) => s.require('key', 'sbx-1'))
    expect(err._tag).toBe('SandboxConnectError')
  })

  it('destroy succeeds', async () => {
    vi.mocked(destroyComputeSandbox).mockResolvedValue(undefined)
    await expect(run((s) => s.destroy('key', 'sbx-1'))).resolves.toBeUndefined()
    expect(destroyComputeSandbox).toHaveBeenCalledWith('key', 'sbx-1')
  })

  it('destroy fails with SandboxConnectError on throw', async () => {
    vi.mocked(destroyComputeSandbox).mockRejectedValue(new Error('kill failed'))
    const err = await runErr((s) => s.destroy('key', 'sbx-1'))
    expect(err._tag).toBe('SandboxConnectError')
  })
})
