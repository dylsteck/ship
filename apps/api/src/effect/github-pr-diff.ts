/**
 * Bounded GitHub pull request diff retrieval.
 *
 * @packageDocumentation
 */

import { Effect } from 'effect'
import { GitHubRepoError, StreamWriteError } from './errors'
import { FetchHttpClient } from './services'

/** Result of reading a bounded text response. */
export interface BoundedText {
  readonly text: string
  readonly truncated: boolean
}

/** Parameters for fetching a pull request diff from GitHub. */
export interface GitHubPullRequestDiffParams {
  readonly owner: string
  readonly repo: string
  readonly pullNumber: number
  readonly token: string
  readonly maxBytes: number
}

/** Fetch a GitHub PR diff while reading at most `maxBytes + 1` response bytes. */
export function fetchGitHubPullRequestDiff(
  params: GitHubPullRequestDiffParams,
): Effect.Effect<BoundedText, GitHubRepoError | StreamWriteError, FetchHttpClient> {
  return Effect.gen(function* () {
    const client = yield* FetchHttpClient
    const response = yield* Effect.tryPromise({
      try: () =>
        client.fetch(githubPullRequestUrl(params.owner, params.repo, params.pullNumber), {
          headers: {
            Accept: 'application/vnd.github.v3.diff',
            Authorization: `Bearer ${params.token}`,
            'User-Agent': 'ship-api',
            'X-GitHub-Api-Version': '2022-11-28',
          },
        }),
      catch: (cause) =>
        new GitHubRepoError({
          operation: 'pulls.diff.fetch',
          code: 'PR_DIFF_FETCH_FAILED',
          status: statusOf(cause),
          cause,
        }),
    })

    if (!response.ok) {
      yield* cancelResponseBody(response).pipe(Effect.catchAll(() => Effect.void))
      return yield* Effect.fail(
        new GitHubRepoError({
          operation: 'pulls.diff.fetch',
          code: 'PR_DIFF_FETCH_FAILED',
          status: response.status,
          cause: response.statusText,
        }),
      )
    }

    return yield* readBoundedResponseText(response, params.maxBytes)
  })
}

/** Read a response body as text while bounding memory growth. */
export function readBoundedResponseText(
  response: Response,
  maxBytes: number,
): Effect.Effect<BoundedText, StreamWriteError> {
  return Effect.tryPromise({
    try: async () => {
      if (!response.body) {
        const text = await response.text()
        return { text: text.slice(0, maxBytes), truncated: text.length > maxBytes }
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      const chunks: string[] = []
      let bytesRead = 0
      let truncated = false

      try {
        while (bytesRead <= maxBytes) {
          const next = await reader.read()
          if (next.done) break

          const remaining = maxBytes + 1 - bytesRead
          const value = next.value.byteLength > remaining ? next.value.slice(0, remaining) : next.value
          bytesRead += value.byteLength
          chunks.push(decoder.decode(value, { stream: true }))

          if (bytesRead > maxBytes || next.value.byteLength > remaining) {
            truncated = true
            await reader.cancel()
            break
          }
        }
      } finally {
        reader.releaseLock()
      }

      const text = chunks.join('') + decoder.decode()
      return { text: text.slice(0, maxBytes), truncated }
    },
    catch: (cause) => new StreamWriteError({ event: 'github-pr-diff-read', cause }),
  })
}

function cancelResponseBody(response: Response): Effect.Effect<void, StreamWriteError> {
  return Effect.tryPromise({
    try: async () => {
      await response.body?.cancel()
    },
    catch: (cause) => new StreamWriteError({ event: 'github-pr-diff-cancel', cause }),
  })
}

function githubPullRequestUrl(owner: string, repo: string, pullNumber: number): string {
  return `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls/${pullNumber}`
}

function statusOf(error: unknown): number | undefined {
  return typeof (error as { status?: unknown })?.status === 'number'
    ? ((error as { status: number }).status)
    : undefined
}
