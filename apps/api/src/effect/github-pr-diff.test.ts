import { Cause, Effect, Exit, Option } from 'effect'
import { describe, expect, it, vi } from 'vitest'
import { GitHubRepoError, StreamWriteError } from './errors'
import { fetchGitHubPullRequestDiff, readBoundedResponseText } from './github-pr-diff'
import { runPromise, runPromiseExit } from './runtime'
import { FetchHttpClient } from './services'

describe('readBoundedResponseText', () => {
  it('reads a small streamed diff completely', async () => {
    const response = new Response(streamFromChunks(['diff --git a/a b/a\n', '+hello\n']))

    await expect(runPromise(readBoundedResponseText(response, 100))).resolves.toEqual({
      text: 'diff --git a/a b/a\n+hello\n',
      truncated: false,
    })
  })

  it('truncates and cancels a large streamed diff', async () => {
    const cancel = vi.fn()
    const response = new Response(streamFromChunks(['12345', '67890'], cancel))

    await expect(runPromise(readBoundedResponseText(response, 6))).resolves.toEqual({
      text: '123456',
      truncated: true,
    })
    expect(cancel).toHaveBeenCalledTimes(1)
  })
})

describe('fetchGitHubPullRequestDiff', () => {
  it('uses a bounded GitHub diff fetch with auth headers', async () => {
    const fetchImpl = vi.fn(async () => new Response(streamFromChunks(['patch'])))

    const result = await runPromise(
      fetchGitHubPullRequestDiff({
        owner: 'acme',
        repo: 'app',
        pullNumber: 42,
        token: 'token-1',
        maxBytes: 100,
      }).pipe(Effect.provideService(FetchHttpClient, { fetch: fetchImpl as typeof fetch })),
    )

    expect(result).toEqual({ text: 'patch', truncated: false })
    expect(fetchImpl).toHaveBeenCalledWith('https://api.github.com/repos/acme/app/pulls/42', {
      headers: expect.objectContaining({
        Accept: 'application/vnd.github.v3.diff',
        Authorization: 'Bearer token-1',
      }),
    })
  })

  it('maps non-OK responses to GitHubRepoError', async () => {
    const cancel = vi.fn()
    const fetchImpl = vi.fn(async () => new Response(streamFromChunks(['nope'], cancel), { status: 503, statusText: 'Unavailable' }))

    const exit = await runPromiseExit(
      fetchGitHubPullRequestDiff({
        owner: 'acme',
        repo: 'app',
        pullNumber: 42,
        token: 'token-1',
        maxBytes: 100,
      }).pipe(Effect.provideService(FetchHttpClient, { fetch: fetchImpl as typeof fetch })),
    )

    expect(Exit.isFailure(exit)).toBe(true)
    expect(failureValue(exit)).toBeInstanceOf(GitHubRepoError)
    expect(cancel).toHaveBeenCalledTimes(1)
  })

  it('maps stream failures to StreamWriteError', async () => {
    const response = new Response(
      new ReadableStream<Uint8Array>({
        pull() {
          throw new Error('read failed')
        },
      }),
    )
    const fetchImpl = vi.fn(async () => response)

    const exit = await runPromiseExit(
      fetchGitHubPullRequestDiff({
        owner: 'acme',
        repo: 'app',
        pullNumber: 42,
        token: 'token-1',
        maxBytes: 100,
      }).pipe(Effect.provideService(FetchHttpClient, { fetch: fetchImpl as typeof fetch })),
    )

    expect(Exit.isFailure(exit)).toBe(true)
    expect(failureValue(exit)).toBeInstanceOf(StreamWriteError)
  })
})

function streamFromChunks(chunks: string[], cancel?: () => void): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  const pending = [...chunks]
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      const next = pending.shift()
      if (next === undefined) {
        controller.close()
        return
      }
      controller.enqueue(encoder.encode(next))
    },
    cancel,
  })
}

function failureValue(exit: Exit.Exit<unknown, unknown>): unknown {
  if (Exit.isSuccess(exit)) return undefined
  const failure = Cause.failureOption(exit.cause)
  return Option.isSome(failure) ? failure.value : undefined
}
