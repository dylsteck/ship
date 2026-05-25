import { describe, expect, it } from 'vitest'
import { collectSessionGitState } from './session-git-state'
import type { Env } from '../env.d'

describe('collectSessionGitState', () => {
  it('falls back to persisted metadata when no sandbox is attached', async () => {
    const state = await collectSessionGitState({
      env: {} as Env,
      userId: 'user-1',
      stub: {
        fetch: (async (request: RequestInfo | URL) => {
          const url = request instanceof Request ? request.url : request.toString()
          if (url.endsWith('/meta')) {
            return Response.json({
              current_branch: 'feat/sidebar',
              repo_url: 'https://github.com/acme/app.git',
              pr_number: '42',
              pr_url: 'https://github.com/acme/app/pull/42',
              pr_draft: 'true',
            })
          }
          return Response.json({ sandboxId: null, status: null })
        }) as typeof fetch,
      },
    })

    expect(state).toMatchObject({
      branchName: 'feat/sidebar',
      branch: 'feat/sidebar',
      repoUrl: 'https://github.com/acme/app.git',
      pr: {
        number: 42,
        url: 'https://github.com/acme/app/pull/42',
        draft: true,
      },
      prUrl: 'https://github.com/acme/app/pull/42',
      prStatus: 'draft',
    })
    expect(state.pr).toBeDefined()
  })

  it('omits pr instead of returning null when metadata has no PR', async () => {
    const state = await collectSessionGitState({
      env: {} as Env,
      userId: 'user-1',
      stub: {
        fetch: (async (request: RequestInfo | URL) => {
          const url = request instanceof Request ? request.url : request.toString()
          if (url.endsWith('/meta')) return Response.json({ current_branch: 'feat/sidebar' })
          return Response.json({ sandboxId: null, status: null })
        }) as typeof fetch,
      },
    })

    expect('pr' in state).toBe(false)
  })
})
