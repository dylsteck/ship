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

function run(db: D1Database, oauth = creds): Promise<GitHubTokenResult> {
  return Effect.runPromise(resolveGitHubTokenEffect(db, oauth, 'user-1'))
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

  it('reports refresh_failed when refresh credentials are missing', async () => {
    const past = Math.floor(Date.now() / 1000) - 10
    const result = await run(
      fakeDb({ row: { access_token: 'gho_old', refresh_token: 'r', expires_at: past } }),
      { clientId: undefined, clientSecret: undefined },
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
})
