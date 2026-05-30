import { describe, expect, it } from 'vitest'
import { GitHubRepoError } from '../effect/errors'
import { collectPullRequestGitDataWithClient } from './session-git-pr-data'
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

describe('collectPullRequestGitDataWithClient', () => {
  it('preserves GitHub file metadata while using bounded diff fetch output', async () => {
    const state = await collectPullRequestGitDataWithClient(
      {
        listFiles: async () => [
          {
            filename: 'src/new.ts',
            previous_filename: 'src/old.ts',
            status: 'renamed',
            additions: 3,
            deletions: 1,
          },
        ],
        listCommits: async () => [
          {
            sha: 'abcdef123456',
            commit: {
              message: 'Improve diff viewer\n\nBody',
              author: { name: 'Dylan', email: 'dylan@example.com', date: '2026-05-30T00:00:00Z' },
            },
            author: { login: 'dylsteck' },
          },
        ],
      },
      {
        owner: 'acme',
        repo: 'app',
        prNumber: 42,
        token: 'token-1',
        fetchImpl: (async () =>
          new Response(`diff --git a/src/old.ts b/src/new.ts
rename from src/old.ts
rename to src/new.ts
@@ -1 +1 @@
-old
+new
`)) as typeof fetch,
      },
    )

    expect(state.diff).toMatchObject({
      patch: expect.stringContaining('diff --git a/src/old.ts b/src/new.ts'),
      truncated: false,
      additions: 3,
      deletions: 1,
      files: [
        {
          filename: 'src/new.ts',
          oldFilename: 'src/old.ts',
          status: 'renamed',
          additions: 3,
          deletions: 1,
        },
      ],
    })
    expect(state.commits).toEqual([
      {
        hash: 'abcdef123456',
        shortHash: 'abcdef1',
        subject: 'Improve diff viewer',
        authorName: 'Dylan',
        authorEmail: 'dylan@example.com',
        authoredAt: '2026-05-30T00:00:00Z',
      },
    ])
  })

  it('maps GitHub file metadata failures to GitHubRepoError', async () => {
    await expect(
      collectPullRequestGitDataWithClient(
        {
          listFiles: async () => {
            throw Object.assign(new Error('GitHub unavailable'), { status: 503 })
          },
          listCommits: async () => [],
        },
        {
          owner: 'acme',
          repo: 'app',
          prNumber: 42,
          token: 'token-1',
          fetchImpl: (async () => new Response('diff --git a/a.ts b/a.ts\n')) as typeof fetch,
        },
      ),
    ).rejects.toBeInstanceOf(GitHubRepoError)
  })
})
