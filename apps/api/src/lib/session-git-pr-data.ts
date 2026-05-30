/** Pull request metadata, checks, and bounded diff collection for session git state. */

import { Octokit } from '@octokit/rest'
import { Cause, Effect, Exit, Option } from 'effect'
import type { Env } from '../env.d'
import { GitHubRepoError } from '../effect/errors'
import { fetchGitHubPullRequestDiff } from '../effect/github-pr-diff'
import { runPromiseExit } from '../effect/runtime'
import { FetchHttpClient } from '../effect/services'
import { getGitHubAccessTokenForUser } from './github-token'
import { parseRepoUrl } from './github'
import {
  normalizeGitCheckState,
  summarizeChecks,
  type SessionGitCheckSummary,
  type SessionGitDiffFile,
} from './session-git-state-parsers'
import type { SessionGitState } from './session-git-state'

const MAX_PATCH_BYTES = 250_000

/** Pull request metadata shown in the right sidebar. */
export interface SessionGitPullRequest {
  number: number
  url: string
  draft: boolean
  title?: string
  body?: string
  merged?: boolean
  state?: string
  headSha?: string
  headBranch?: string
  baseBranch?: string
}

/** Minimal GitHub client surface needed for pull request diff metadata. */
export interface PullRequestGitDataClient {
  readonly listFiles: (params: GitHubListParams) => Promise<GitHubFileRow[]>
  readonly listCommits: (params: GitHubListParams) => Promise<GitHubCommitRow[]>
}

interface GitHubListParams {
  owner: string
  repo: string
  pull_number: number
  per_page: number
}

interface GitHubFileRow {
  filename: string
  previous_filename?: string | null
  status: string
  additions: number
  deletions: number
}

interface GitHubCommitRow {
  sha: string
  commit: {
    message: string
    author?: {
      name?: string | null
      email?: string | null
      date?: string | null
    } | null
  }
  author?: { login?: string | null } | null
}

/** Collect the PR matching persisted metadata or the current branch. */
export async function collectPullRequest(
  env: Env,
  userId: string,
  state: SessionGitState,
): Promise<SessionGitPullRequest | undefined> {
  if (!state.repoUrl) return state.pr
  const token = await getToken(env, userId)
  if (!token) return state.pr
  const { owner, repo } = parseRepoUrl(state.repoUrl)
  const octokit = new Octokit({ auth: token })
  const prNumber = state.pr?.number
  const branchName = normalizeBranchName(state.branchName || state.branch)
  if (!prNumber) return collectPullRequestByBranch(octokit, owner, repo, branchName)
  const { data } = await octokit.rest.pulls.get({ owner, repo, pull_number: prNumber })
  if (branchName && data.head.ref !== branchName && !data.head.label.endsWith(`:${branchName}`)) {
    return collectPullRequestByBranch(octokit, owner, repo, branchName)
  }
  return buildPullRequest(data)
}

/** Collect GitHub check/status rollups for a PR head ref. */
export async function collectChecks(
  env: Env,
  userId: string,
  repoUrl: string | undefined,
  ref: string,
): Promise<SessionGitCheckSummary | undefined> {
  if (!repoUrl) return undefined
  const token = await getToken(env, userId)
  if (!token) return undefined
  const { owner, repo } = parseRepoUrl(repoUrl)
  const octokit = new Octokit({ auth: token })
  const [checks, statuses] = await Promise.all([
    octokit.rest.checks.listForRef({ owner, repo, ref, per_page: 100 }).catch(() => ({ data: { check_runs: [] } })),
    octokit.rest.repos.getCombinedStatusForRef({ owner, repo, ref }).catch(() => ({ data: { statuses: [] } })),
  ])
  const checkJobs = checks.data.check_runs.map((run) => ({
    name: run.name,
    state: normalizeGitCheckState(run.conclusion || run.status),
    ...(run.status ? { status: run.status } : {}),
    ...(run.conclusion ? { conclusion: run.conclusion } : {}),
    ...(run.html_url || run.details_url ? { url: run.html_url || run.details_url || undefined } : {}),
    ...(run.started_at ? { startedAt: run.started_at } : {}),
    ...(run.completed_at ? { completedAt: run.completed_at } : {}),
  }))
  const statusJobs = statuses.data.statuses.map((status) => ({
    name: status.context,
    state: normalizeGitCheckState(status.state),
    status: status.state,
    ...(status.target_url ? { url: status.target_url } : {}),
  }))
  return {
    ...summarizeChecks([...checkJobs.map((job) => job.conclusion || job.status || job.state), ...statusJobs.map((job) => job.status)]),
    jobs: [...checkJobs, ...statusJobs],
  }
}

/** Collect PR file metadata, commits, and bounded patch text. */
export async function collectPullRequestGitData(
  env: Env,
  userId: string,
  repoUrl: string | undefined,
  prNumber: number,
): Promise<Pick<SessionGitState, 'diff' | 'commits'>> {
  if (!repoUrl || !env.DB) return {}
  const token = await getToken(env, userId)
  if (!token) return {}
  const { owner, repo } = parseRepoUrl(repoUrl)
  const octokit = new Octokit({ auth: token })
  return collectPullRequestGitDataWithClient(
    {
      listFiles: (params) =>
        octokit.paginate(octokit.rest.pulls.listFiles, {
          owner: params.owner,
          repo: params.repo,
          pull_number: params.pull_number,
          per_page: params.per_page,
        }),
      listCommits: (params) =>
        octokit.paginate(octokit.rest.pulls.listCommits, {
          owner: params.owner,
          repo: params.repo,
          pull_number: params.pull_number,
          per_page: params.per_page,
        }),
    },
    { owner, repo, prNumber, token, fetchImpl: fetch },
  )
}

/** Collect PR file, commit, and bounded patch data using injectable dependencies. */
export async function collectPullRequestGitDataWithClient(
  client: PullRequestGitDataClient,
  input: { owner: string; repo: string; prNumber: number; token: string; fetchImpl: typeof fetch },
): Promise<Pick<SessionGitState, 'diff' | 'commits'>> {
  const { files, commits, boundedDiff } = await runTypedEffect(
    Effect.all(
      {
        files: listPullRequestFiles(client, input),
        commits: listPullRequestCommits(client, input),
        boundedDiff: fetchGitHubPullRequestDiff({
          owner: input.owner,
          repo: input.repo,
          pullNumber: input.prNumber,
          token: input.token,
          maxBytes: MAX_PATCH_BYTES,
        }).pipe(Effect.provideService(FetchHttpClient, { fetch: input.fetchImpl })),
      },
      { concurrency: 'unbounded' },
    ),
  )
  const diffFiles = files.map((file) => ({
    filename: file.filename,
    ...(file.previous_filename ? { oldFilename: file.previous_filename } : {}),
    status: mapPullRequestFileStatus(file.status),
    additions: file.additions,
    deletions: file.deletions,
  }))
  const totals = diffFiles.reduce((acc, file) => ({ additions: acc.additions + file.additions, deletions: acc.deletions + file.deletions }), {
    additions: 0,
    deletions: 0,
  })
  return {
    diff: { patch: boundedDiff.text, truncated: boundedDiff.truncated, files: diffFiles, ...totals },
    commits: commits.map(mapCommit),
  }
}

function listPullRequestFiles(
  client: PullRequestGitDataClient,
  input: { owner: string; repo: string; prNumber: number },
): Effect.Effect<GitHubFileRow[], GitHubRepoError> {
  return Effect.tryPromise({
    try: () => client.listFiles({ owner: input.owner, repo: input.repo, pull_number: input.prNumber, per_page: 100 }),
    catch: (cause) =>
      new GitHubRepoError({
        operation: 'pulls.listFiles',
        code: 'PR_FILES_FETCH_FAILED',
        status: statusOf(cause),
        cause,
      }),
  })
}

function listPullRequestCommits(
  client: PullRequestGitDataClient,
  input: { owner: string; repo: string; prNumber: number },
): Effect.Effect<GitHubCommitRow[], GitHubRepoError> {
  return Effect.tryPromise({
    try: () => client.listCommits({ owner: input.owner, repo: input.repo, pull_number: input.prNumber, per_page: 100 }),
    catch: (cause) =>
      new GitHubRepoError({
        operation: 'pulls.listCommits',
        code: 'PR_COMMITS_FETCH_FAILED',
        status: statusOf(cause),
        cause,
      }),
  })
}

async function runTypedEffect<A, E>(effect: Effect.Effect<A, E, never>): Promise<A> {
  const exit = await runPromiseExit(effect)
  if (Exit.isSuccess(exit)) return exit.value
  const failure = Cause.failureOption(exit.cause)
  if (Option.isSome(failure)) throw failure.value
  throw new Error(Cause.pretty(exit.cause))
}

function mapCommit(commit: GitHubCommitRow) {
  return {
    hash: commit.sha,
    shortHash: commit.sha.slice(0, 7),
    subject: commit.commit.message.split('\n')[0] || commit.sha.slice(0, 7),
    authorName: commit.commit.author?.name || commit.author?.login || 'Unknown',
    authorEmail: commit.commit.author?.email || '',
    authoredAt: commit.commit.author?.date || '',
  }
}

function mapPullRequestFileStatus(status: string): SessionGitDiffFile['status'] {
  if (status === 'added') return 'added'
  if (status === 'removed') return 'deleted'
  if (status === 'renamed') return 'renamed'
  if (status === 'copied') return 'copied'
  if (status === 'modified' || status === 'changed') return 'modified'
  return 'changed'
}

function statusOf(error: unknown): number | undefined {
  return typeof (error as { status?: unknown })?.status === 'number'
    ? ((error as { status: number }).status)
    : undefined
}

function normalizeBranchName(branchName: string | undefined): string | undefined {
  if (!branchName || branchName === 'HEAD') return undefined
  return branchName
}

async function collectPullRequestByBranch(
  octokit: Octokit,
  owner: string,
  repo: string,
  branchName?: string,
): Promise<SessionGitPullRequest | undefined> {
  if (!branchName) return undefined
  const { data } = await octokit.rest.pulls.list({ owner, repo, head: `${owner}:${branchName}`, state: 'all', sort: 'updated', direction: 'desc', per_page: 10 })
  const pr =
    data.find((pull) => pull.head.ref === branchName || pull.head.label.endsWith(`:${branchName}`)) ??
    (await collectPullRequestByBranchName(octokit, owner, repo, branchName))
  return pr ? buildPullRequest(pr) : undefined
}

async function collectPullRequestByBranchName(octokit: Octokit, owner: string, repo: string, branchName: string) {
  const { data } = await octokit.rest.pulls.list({ owner, repo, state: 'all', sort: 'updated', direction: 'desc', per_page: 30 })
  return data.find((pr) => pr.head.ref === branchName || pr.head.label.endsWith(`:${branchName}`))
}

function buildPullRequest(data: {
  number: number
  html_url: string
  draft?: boolean | null
  title?: string | null
  state?: string
  body?: string | null
  merged?: boolean | null
  merged_at?: string | null
  head: { sha: string; ref?: string | null }
  base: { ref: string }
}): SessionGitPullRequest {
  return {
    number: data.number,
    url: data.html_url,
    draft: data.draft ?? false,
    ...(data.title ? { title: data.title } : {}),
    ...(data.body ? { body: data.body } : {}),
    merged: Boolean(data.merged || data.merged_at),
    state: data.state,
    headSha: data.head.sha,
    ...(data.head.ref ? { headBranch: data.head.ref } : {}),
    baseBranch: data.base.ref,
  }
}

async function getToken(env: Env, userId: string): Promise<string | null> {
  const tokenResult = await getGitHubAccessTokenForUser(env.DB, env, userId)
  return tokenResult.token
}
