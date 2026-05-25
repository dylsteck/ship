import { describe, expect, it, vi } from 'vitest'
import type { Env } from '../env.d'
import { collectSessionDesktopState } from './session-desktop-state'

describe('collectSessionDesktopState', () => {
  it('returns unavailable when no sandbox exists', async () => {
    const state = await collectSessionDesktopState({
      env: {} as Env,
      stub: fakeStub({ meta: {}, sandbox: { sandboxId: null } }),
    })

    expect(state.status).toBe('unavailable')
    expect(state.message).toContain('no sandbox')
  })

  it('verifies a persisted ready desktop before returning a fresh url', async () => {
    const connectSandbox = vi.fn(async () => ({
      getUrl: async () => 'https://fresh-desktop.example',
      runCommand: async () => ({ exitCode: 0, stdout: 'ready' }),
    }))
    const state = await collectSessionDesktopState({
      env: {} as Env,
      connectSandbox,
      stub: fakeStub({
        meta: {
          desktop_status: 'ready',
          desktop_bridge_version: '5',
          desktop_url: 'https://desktop.example/vnc.html',
        },
        sandbox: { sandboxId: 'sandbox-1' },
      }),
    })

    expect(state).toEqual({
      status: 'ready',
      url: 'https://fresh-desktop.example/vnc.html?autoconnect=1&resize=scale&reconnect=1&path=websockify',
    })
    expect(connectSandbox).toHaveBeenCalledWith('sandbox-1', {})
  })

  it('returns structured errors from the background startup status file', async () => {
    const postedMeta: Record<string, string>[] = []
    const state = await collectSessionDesktopState({
      env: {} as Env,
      createToken: () => 'token-1',
      connectSandbox: async () => ({
        getUrl: async () => 'https://desktop.example',
        runCommand: async () => ({ exitCode: 0, stdout: 'error:missing desktop dependencies' }),
      }),
      stub: fakeStub({ meta: {}, sandbox: { sandboxId: 'sandbox-1' }, postedMeta }),
    })

    expect(state).toEqual({ status: 'error', message: 'missing desktop dependencies' })
    expect(postedMeta.at(-1)).toMatchObject({ desktop_status: 'starting' })
  })

  it('launches desktop setup in the background when not ready', async () => {
    const postedMeta: Record<string, string>[] = []
    let calls = 0
    const state = await collectSessionDesktopState({
      env: {} as Env,
      createToken: () => 'token-1',
      connectSandbox: async () => ({
        getUrl: async () => 'https://desktop.example',
        runCommand: async () => ({ exitCode: 0, stdout: calls++ === 0 ? 'missing' : 'starting' }),
      }),
      stub: fakeStub({ meta: {}, sandbox: { sandboxId: 'sandbox-1' }, postedMeta }),
    })

    expect(state).toEqual({ status: 'starting' })
    expect(postedMeta.at(-1)).toMatchObject({ desktop_status: 'starting', desktop_bridge_version: '5' })
  })
})

function fakeStub(input: {
  meta: Record<string, string>
  sandbox: Record<string, unknown>
  postedMeta?: Record<string, string>[]
}): { fetch: typeof fetch } {
  return {
    fetch: (async (request: RequestInfo | URL) => {
      const req = request instanceof Request ? request : new Request(request)
      if (req.url.endsWith('/meta') && req.method === 'POST') {
        const patch = (await req.json()) as Record<string, string>
        input.postedMeta?.push(patch)
        Object.assign(input.meta, patch)
        return Response.json({ success: true })
      }
      if (req.url.endsWith('/meta')) return Response.json(input.meta)
      if (req.url.endsWith('/sandbox/status')) return Response.json(input.sandbox)
      return Response.json({}, { status: 404 })
    }) as typeof fetch,
  }
}
