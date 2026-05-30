/**
 * Effect service for authenticated GitHub repository operations.
 *
 * @packageDocumentation
 */

import { Context, Effect, Layer } from 'effect'
import { Octokit } from '@octokit/rest'
import { createPullRequest } from 'octokit-plugin-create-pull-request'

import { GitHubRepoError } from './errors'

const OctokitWithPlugin = Octokit.plugin(createPullRequest)

/** Parameters for creating a GitHub pull request. */
export interface CreatePullRequestParams {
  readonly owner: string
  readonly repo: string
  readonly title: string
  readonly body?: string
  readonly head: string
  readonly base?: string
  readonly draft?: boolean
}

/** Normalized pull request response returned by Ship. */
export interface PullRequestResponse {
  readonly number: number
  readonly url: string
  readonly htmlUrl: string
  readonly draft: boolean
  readonly state: string
  readonly head: string
  readonly base: string
}

/** Effect service for GitHub repository and pull request calls. */
export interface GitHubReposService {
  /** Fetch repository metadata. */
  readonly getRepository: (owner: string, repo: string) => Effect.Effect<unknown, GitHubRepoError>
  /** Find an existing open PR for a branch; failures preserve legacy null behavior. */
  readonly findExistingPR: (owner: string, repo: string, head: string) => Effect.Effect<number | null, never>
  /** Create a pull request, returning an existing open PR when present. */
  readonly createPullRequest: (
    params: CreatePullRequestParams,
  ) => Effect.Effect<PullRequestResponse, GitHubRepoError>
  /** Update pull request metadata. */
  readonly updatePullRequest: (
    prNumber: number,
    owner: string,
    repo: string,
    updates: {
      readonly title?: string
      readonly body?: string
      readonly draft?: boolean
      readonly state?: 'open' | 'closed'
    },
  ) => Effect.Effect<PullRequestResponse, GitHubRepoError>
  /** Mark a draft PR as ready for review. */
  readonly markReadyForReview: (
    prNumber: number,
    owner: string,
    repo: string,
  ) => Effect.Effect<PullRequestResponse, GitHubRepoError>
}

/** Injectable {@link GitHubReposService}. */
export class GitHubRepos extends Context.Tag('GitHubRepos')<GitHubRepos, GitHubReposService>() {}

function statusOf(error: unknown): number | undefined {
  return typeof (error as { status?: unknown })?.status === 'number'
    ? ((error as { status: number }).status)
    : undefined
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown error'
}

function mapPullResponse(pr: {
  number: number
  url: string
  html_url: string
  draft?: boolean | null
  state: string
  head: { ref: string }
  base: { ref: string }
}): PullRequestResponse {
  return {
    number: pr.number,
    url: pr.url,
    htmlUrl: pr.html_url,
    draft: pr.draft ?? false,
    state: pr.state,
    head: pr.head.ref,
    base: pr.base.ref,
  }
}

/** Build a live GitHub repository service for a user token. */
export function makeGitHubReposLive(token: string) {
  const octokit = new OctokitWithPlugin({ auth: token })

  const service: GitHubReposService = {
    getRepository: (owner, repo) =>
      Effect.tryPromise({
        try: async () => {
          const { data } = await octokit.rest.repos.get({ owner, repo })
          return data
        },
        catch: (cause) =>
          new GitHubRepoError({
            operation: 'repos.get',
            code: 'REPO_NOT_FOUND',
            messageOverride: `Failed to get repository: ${messageOf(cause)}`,
            status: statusOf(cause),
            cause,
          }),
      }),

    findExistingPR: (owner, repo, head) =>
      Effect.tryPromise({
        try: async () => {
          const { data: pulls } = await octokit.rest.pulls.list({
            owner,
            repo,
            head: `${owner}:${head}`,
            state: 'open',
          })
          return pulls.length > 0 ? pulls[0]!.number : null
        },
        catch: (cause) =>
          new GitHubRepoError({
            operation: 'pulls.list',
            code: 'PR_LOOKUP_FAILED',
            status: statusOf(cause),
            cause,
          }),
      }).pipe(Effect.catchAll(() => Effect.succeed(null))),

    createPullRequest: (params) =>
      Effect.gen(function* () {
        const { owner, repo, title, body, head, base = 'main', draft = true } = params
        const existingPR = yield* service.findExistingPR(owner, repo, head)
        if (existingPR) {
          const pr = yield* Effect.tryPromise({
            try: async () => {
              const { data } = await octokit.rest.pulls.get({ owner, repo, pull_number: existingPR })
              return data
            },
            catch: (cause) =>
              new GitHubRepoError({
                operation: 'pulls.get',
                code: 'PR_CREATE_FAILED',
                messageOverride: `Failed to create pull request: ${messageOf(cause)}`,
                status: statusOf(cause),
                cause,
              }),
          })
          return mapPullResponse(pr)
        }

        const pr = yield* Effect.tryPromise({
          try: async () => {
            const { data } = await octokit.rest.pulls.create({
              owner,
              repo,
              title,
              body: body || '',
              head,
              base,
              draft,
            })
            return data
          },
          catch: (cause) =>
            new GitHubRepoError({
              operation: 'pulls.create',
              code: 'PR_CREATE_FAILED',
              messageOverride: `Failed to create pull request: ${messageOf(cause)}`,
              status: statusOf(cause),
              cause,
            }),
        })
        return mapPullResponse(pr)
      }),

    updatePullRequest: (prNumber, owner, repo, updates) =>
      Effect.tryPromise({
        try: async () => {
          const { data } = await octokit.rest.pulls.update({
            owner,
            repo,
            pull_number: prNumber,
            ...updates,
          })
          return mapPullResponse(data)
        },
        catch: (cause) =>
          new GitHubRepoError({
            operation: 'pulls.update',
            code: 'PR_UPDATE_FAILED',
            messageOverride: `Failed to update pull request: ${messageOf(cause)}`,
            status: statusOf(cause),
            cause,
          }),
      }),

    markReadyForReview: (prNumber, owner, repo) =>
      service.updatePullRequest(prNumber, owner, repo, { draft: false }),
  }

  return Layer.succeed(GitHubRepos, service)
}
