import { Effect } from 'effect'
import { describe, expect, it } from 'vitest'

import { DatabaseError, SandboxNotFoundError } from './errors'
import { runToResponse } from './http'

describe('runToResponse', () => {
  it('encodes a success value with the provided encoder', async () => {
    const res = await runToResponse(Effect.succeed({ ok: true }), (v) =>
      Response.json(v, { status: 201 }),
    )
    expect(res.status).toBe(201)
    expect(await res.json()).toEqual({ ok: true })
  })

  it('maps a tagged AppError to its declared HTTP status', async () => {
    const res = await runToResponse(
      Effect.fail(new SandboxNotFoundError({ sandboxId: 'sbx-1' })),
      () => new Response(null),
    )
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({
      error: 'SandboxNotFoundError',
      message: 'Sandbox not found: sbx-1',
      retryable: false,
    })
  })

  it('maps a retryable database error to 500 with the retryable flag', async () => {
    const res = await runToResponse(
      Effect.fail(new DatabaseError({ operation: 'accounts.select', cause: 'x' })),
      () => new Response(null),
    )
    expect(res.status).toBe(500)
    expect(((await res.json()) as { retryable: boolean }).retryable).toBe(true)
  })

  it('collapses unexpected defects to a generic 500', async () => {
    const res = await runToResponse(
      Effect.die(new Error('kaboom')) as Effect.Effect<never, never>,
      () => new Response(null),
    )
    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({
      error: 'InternalError',
      message: 'Internal server error',
      retryable: false,
    })
  })
})
