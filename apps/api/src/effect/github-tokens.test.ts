import { Effect } from 'effect'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { resolveGitHubTokenEffect, type GitHubTokenResult } from './github-tokens'

interface AccountRow {
  access_token: string | null
  refresh_token: string | null
  expires_at: number | null
}

/** Minimal in-memory D1 stub covering the prepare().bind().first()/run() surface. */
function fakeDb(opts: {
  row?: AccountRow | null
  failSelect?: boolean
  failUpdate?: boolean
  onUpdate?: (args: unknown[]) => void
}): D1Database {
  return {
    prepare(_sql: string) {
      return {
        bind(...args: unknown[]) {
          return {
            first: async () => {
              if (opts.failSelect) throw new Error('db down')
              return opts.row ?? null
            },
            run: async () => {
              if (opts.failUpdate) throw new Error('db update down')
              opts.onUpdate?.(args)
              return {} as unknown
            },
          }
        },
      }
    },
  } as unknown as D1Database
}

const creds = { clientId: 'cid', clientSecret: 'secret' }

function run(
  db: D1Database,
  oauth: { clientId?: string; clientSecret?: string } = creds,
): Promise<GitHubTokenResult> {
  return Effect.runPromise(resolveGitHubTokenEffect(db, oauth, 'user-1'))
}

function runErr(
  db: D1Database,
  oauth: { clientId?: string; clientSecret?: string } = creds,
) {
  return Effect.runPromise(Effect.flip(resolveGitHubTokenEffect(db, oauth, 'user-1')))
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('resolveGitHubTokenEffect', () => {
  it('reports not_connected when there is no account row', async () => {
    const result = await run(fakeDb({ row: null }))
    expect(result).toEqual({
      token: null,
      reason: 'not_connected',
      message: expect.stringContaining('GitHub is not connected'),
    })
  })

  it('returns a classic token that has no expiry', async () => {
    const result = await run(
      fakeDb({ row: { access_token: 'gho_classic', refresh_token: null, expires_at: null } }),
    )
    expect(result).toEqual({ token: 'gho_classic' })
  })

  it('returns a still-valid token that expires in the future', async () => {
    const future = Math.floor(Date.now() / 1000) + 3600
    const result = await run(
      fakeDb({ row: { access_token: 'gho_valid', refresh_token: 'r', expires_at: future } }),
    )
    expect(result).toEqual({ token: 'gho_valid' })
  })

  it('refreshes a token inside the 120 second buffer window', async () => {
    const soon = Math.floor(Date.now() / 1000) + 60
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ access_token: 'gho_buffer_fresh', expires_in: 3600 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    const result = await run(
      fakeDb({ row: { access_token: 'gho_old', refresh_token: 'r', expires_at: soon } }),
    )

    expect(result).toEqual({ token: 'gho_buffer_fresh', refreshed: true })
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it('refreshes an expired token and persists the new value', async () => {
    const past = Math.floor(Date.now() / 1000) - 10
    const updates: unknown[][] = []
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ access_token: 'gho_fresh', expires_in: 3600 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    const result = await run(
      fakeDb({
        row: { access_token: 'gho_old', refresh_token: 'r', expires_at: past },
        onUpdate: (args) => updates.push(args),
      }),
    )

    expect(result).toEqual({ token: 'gho_fresh', refreshed: true })
    expect(fetchMock).toHaveBeenCalledOnce()
    expect(updates[0]?.[0]).toBe('gho_fresh')
  })

  it('persists a null expiry when refresh omits expires_in', async () => {
    const past = Math.floor(Date.now() / 1000) - 10
    const updates: unknown[][] = []
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ access_token: 'gho_no_expiry' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    const result = await run(
      fakeDb({
        row: { access_token: 'gho_old', refresh_token: 'r_existing', expires_at: past },
        onUpdate: (args) => updates.push(args),
      }),
    )

    expect(result).toEqual({ token: 'gho_no_expiry', refreshed: true })
    expect(updates[0]?.[2]).toBeNull()
  })

  it('reuses the old refresh token when GitHub does not return a replacement', async () => {
    const past = Math.floor(Date.now() / 1000) - 10
    const updates: unknown[][] = []
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ access_token: 'gho_fresh', expires_in: 3600 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    await run(
      fakeDb({
        row: { access_token: 'gho_old', refresh_token: 'r_existing', expires_at: past },
        onUpdate: (args) => updates.push(args),
      }),
    )

    expect(updates[0]?.[1]).toBe('r_existing')
  })

  it('reports refresh_failed when refresh credentials are missing', async () => {
    const past = Math.floor(Date.now() / 1000) - 10
    const result = await run(
      fakeDb({ row: { access_token: 'gho_old', refresh_token: 'r', expires_at: past } }),
      { clientId: undefined, clientSecret: undefined },
    )
    expect(result).toMatchObject({ token: null, reason: 'refresh_failed' })
  })

  it('reports refresh_failed when GitHub returns a non-OK refresh response', async () => {
    const past = Math.floor(Date.now() / 1000) - 10
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('nope', { status: 401 }))
    const result = await run(
      fakeDb({ row: { access_token: 'gho_old', refresh_token: 'r', expires_at: past } }),
    )
    expect(result).toMatchObject({ token: null, reason: 'refresh_failed' })
  })

  it('reports refresh_failed when refresh returns no access token', async () => {
    const past = Math.floor(Date.now() / 1000) - 10
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ refresh_token: 'r2', expires_in: 3600 }), { status: 200 }),
    )
    const result = await run(
      fakeDb({ row: { access_token: 'gho_old', refresh_token: 'r', expires_at: past } }),
    )
    expect(result).toMatchObject({ token: null, reason: 'refresh_failed' })
  })

  it('reports refresh_failed when GitHub rejects the refresh', async () => {
    const past = Math.floor(Date.now() / 1000) - 10
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: 'bad_refresh_token' }), { status: 200 }),
    )
    const result = await run(
      fakeDb({ row: { access_token: 'gho_old', refresh_token: 'r', expires_at: past } }),
    )
    expect(result).toMatchObject({ token: null, reason: 'refresh_failed' })
  })

  it('fails the effect when the database query throws', async () => {
    await expect(run(fakeDb({ failSelect: true }))).rejects.toThrow()
  })

  it('fails with GitHubApiError when the refresh transport throws', async () => {
    const past = Math.floor(Date.now() / 1000) - 10
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network down'))

    await expect(
      runErr(fakeDb({ row: { access_token: 'gho_old', refresh_token: 'r', expires_at: past } })),
    ).resolves.toMatchObject({ _tag: 'GitHubApiError' })
  })

  it('fails with DatabaseError when persisting refreshed tokens throws', async () => {
    const past = Math.floor(Date.now() / 1000) - 10
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ access_token: 'gho_fresh', expires_in: 3600 }), { status: 200 }),
    )

    await expect(
      runErr(
        fakeDb({
          row: { access_token: 'gho_old', refresh_token: 'r', expires_at: past },
          failUpdate: true,
        }),
      ),
    ).resolves.toMatchObject({ _tag: 'DatabaseError' })
  })
})
