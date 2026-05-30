import { Effect, Exit } from 'effect'
import { describe, expect, it } from 'vitest'

import { DatabaseError } from './errors'
import { runPromise, runPromiseExit } from './runtime'

describe('Effect runtime boundary helpers', () => {
  it('runPromise resolves successful effects', async () => {
    await expect(runPromise(Effect.succeed('ok'))).resolves.toBe('ok')
  })

  it('runPromise rejects failed effects', async () => {
    await expect(
      runPromise(Effect.fail(new DatabaseError({ operation: 'runtime.test', cause: 'x' }))),
    ).rejects.toThrow('Database operation failed: runtime.test')
  })

  it('runPromiseExit returns a success Exit', async () => {
    const exit = await runPromiseExit(Effect.succeed(42))
    expect(Exit.isSuccess(exit)).toBe(true)
    if (Exit.isSuccess(exit)) expect(exit.value).toBe(42)
  })

  it('runPromiseExit returns a failure Exit', async () => {
    const exit = await runPromiseExit(
      Effect.fail(new DatabaseError({ operation: 'runtime.test', cause: 'x' })),
    )
    expect(Exit.isFailure(exit)).toBe(true)
  })
})
