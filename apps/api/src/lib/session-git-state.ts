/** Live git-state collection for the session right sidebar. */

import { Octokit } from '@octokit/rest'
import { Sandbox } from '@e2b/code-interpreter'
import type { Env } from '../env.d'
import { getGitHubAccessTokenForUser } from './github-token'
import { parseRepoUrl } from './github'
import {
  buildDiffFiles,
  mergeStatusFiles,
  parseGitCommitLog,
  parseGitStatusFiles,
  summarizeChecks,
  type SessionGitCheckSummary,
  type SessionGitCommit,
  type SessionGitDiffFile,
} from './session-git-state-parsers'

const DO_URL = 'https://do'
const DEFAULT_REPO_PATH = '/home/user/repo'
const MAX_PATCH_BYTES = 250_000

/** Pull request metadata shown in the right sidebar. */
export interface SessionGitPullRequest {
  number: number
  url: string
  draft: boolean
  title?: string
  state?: string
  headSha?: string
  baseBranch?: string
}

/** Response for `GET /chat/:sessionId/git/state`. */
export interface SessionGitState {
  branchName?: string
  branch?: string
  hasChanges?: boolean
  dirty?: boolean
  repoUrl?: string
  baseBranch?: string
  pr?: SessionGitPullRequest
  prUrl?: string
  prStatus?: string
  checks?: SessionGitCheckSummary
  diff?: {
    patch: string
    truncated?: boolean
    files: SessionGitDiffFile[]
    additions: number
    deletions: number
  }
  commits?: SessionGitCommit[]
}

interface CollectSessionGitStateInput {
  env: Env
  stub: { fetch: typeof fetch }
  userId: string
}

interface SandboxStatus {
  sandboxId: string | null
  status: string | null
}

interface CommandOutput {
  stdout?: string
  stderr?: string
  error?: string
}

/** Collect persisted and live sandbox git state for a session. */
export async function collectSessionGitState(input: CollectSessionGitStateInput): Promise<SessionGitState> {
  const [meta, sandboxStatus] = await Promise.all([fetchMeta(input.stub), fetchSandboxStatus(input.stub)])
  const base = buildPersistedState(meta)

  const live = sandboxStatus.sandboxId
    ? await collectSandboxGitState(input.env, sandboxStatus.sandboxId, meta).catch(() => ({}))
    : {}
  const withLive = { ...base, ...live }

  const pr = await collectPullRequest(input.env, input.userId, withLive).catch(() => withLive.pr)
  const checks = pr?.headSha
    ? await collectChecks(input.env, input.userId, withLive.repoUrl, pr.headSha).catch(() => undefined)
    : undefined

  return {
    ...withLive,
    ...(pr ? { pr, prUrl: pr.url, prStatus: pr.draft ? 'draft' : pr.state } : {}),
    ...(checks ? { checks } : {}),
  }
}

function buildPersistedState(meta: Record<string, string>): SessionGitState {
  const branchName = meta['branch_name'] || meta['current_branch'] || undefined
  const prNumber = Number.parseInt(meta['pr_number'] || '', 10)
  const pr =
    Number.isFinite(prNumber) && meta['pr_url']
      ? {
          number: prNumber,
          url: meta['pr_url'],
          draft: meta['pr_draft'] === 'true',
        }
      : undefined

  return {
    ...(branchName ? { branchName, branch: branchName } : {}),
    ...(meta['repo_url'] ? { repoUrl: meta['repo_url'] } : {}),
    ...(meta['base_branch'] ? { baseBranch: meta['base_branch'] } : {}),
    ...(pr ? { pr } : {}),
    ...(pr?.url ? { prUrl: pr.url, prStatus: pr.draft ? 'draft' : undefined } : {}),
  }
}

async function collectSandboxGitState(
  env: Env,
  sandboxId: string,
  meta: Record<string, string>,
): Promise<Partial<SessionGitState>> {
  const sandbox = await Sandbox.connect(sandboxId, { apiKey: env.E2B_API_KEY, timeoutMs: 5 * 60 * 1000 })
  const repoPath = meta['repo_path'] || DEFAULT_REPO_PATH
  const inside = await runGit(sandbox, repoPath, 'git rev-parse --is-inside-work-tree')
  if ((inside.stdout || '').trim() !== 'true') return {}

  const [branch, status, unstagedNumstat, stagedNumstat, unstagedNames, stagedNames, unstagedPatch, stagedPatch, commits] =
    await Promise.all([
      runGit(sandbox, repoPath, 'git rev-parse --abbrev-ref HEAD'),
      runGit(sandbox, repoPath, 'git status --porcelain=v1'),
      runGit(sandbox, repoPath, 'git diff --numstat'),
      runGit(sandbox, repoPath, 'git diff --cached --numstat'),
      runGit(sandbox, repoPath, 'git diff --name-status'),
      runGit(sandbox, repoPath, 'git diff --cached --name-status'),
      runGit(sandbox, repoPath, `git diff --no-ext-diff --no-color | head -c ${MAX_PATCH_BYTES}`),
      runGit(sandbox, repoPath, `git diff --cached --no-ext-diff --no-color | head -c ${MAX_PATCH_BYTES}`),
      runGit(sandbox, repoPath, buildCommitCommand(meta['base_branch'] || 'main')),
    ])

  const files = mergeStatusFiles(
    buildDiffFiles(
      `${unstagedNumstat.stdout || ''}\n${stagedNumstat.stdout || ''}`,
      `${unstagedNames.stdout || ''}\n${stagedNames.stdout || ''}`,
    ),
    parseGitStatusFiles(status.stdout || ''),
  )
  const totals = files.reduce((acc, file) => ({ additions: acc.additions + file.additions, deletions: acc.deletions + file.deletions }), {
    additions: 0,
    deletions: 0,
  })
  const branchName = (branch.stdout || '').trim() || meta['current_branch'] || undefined
  const dirty = Boolean((status.stdout || '').trim())

  const patch = buildPatch([unstagedPatch.stdout, stagedPatch.stdout])

  return {
    ...(branchName ? { branchName, branch: branchName } : {}),
    dirty,
    hasChanges: dirty,
    diff: {
      patch,
      truncated: patch.length >= MAX_PATCH_BYTES,
      files,
      additions: totals.additions,
      deletions: totals.deletions,
    },
    commits: parseGitCommitLog(commits.stdout || ''),
  }
}

async function collectPullRequest(
  env: Env,
  userId: string,
  state: SessionGitState,
): Promise<SessionGitPullRequest | undefined> {
  const prNumber = state.pr?.number
  if (!prNumber || !state.repoUrl) return state.pr
  const token = await getToken(env, userId)
  if (!token) return state.pr
  const { owner, repo } = parseRepoUrl(state.repoUrl)
  const octokit = new Octokit({ auth: token })
  const { data } = await octokit.rest.pulls.get({ owner, repo, pull_number: prNumber })

  return {
    number: data.number,
    url: data.html_url,
    draft: data.draft ?? false,
    title: data.title,
    state: data.state,
    headSha: data.head.sha,
    baseBranch: data.base.ref,
  }
}

async function collectChecks(
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
  const checkStates = checks.data.check_runs.map((run) => run.conclusion || run.status || 'pending')
  const statusStates = statuses.data.statuses.map((status) => status.state)
  return summarizeChecks([...checkStates, ...statusStates])
}

function buildCommitCommand(baseBranch: string): string {
  const format = '%H%x1f%h%x1f%an%x1f%ae%x1f%aI%x1f%s'
  const baseRef = shellQuote(`origin/${baseBranch}`)
  return [
    `base=$(git rev-parse --verify --quiet ${baseRef} || true)`,
    'if [ -n "$base" ]; then',
    `git log --date=iso-strict --pretty=format:${shellQuote(format)} "$base"..HEAD`,
    'else',
    `git log --max-count=30 --date=iso-strict --pretty=format:${shellQuote(format)}`,
    'fi',
  ].join('; ')
}

function buildPatch(parts: Array<string | undefined>): string {
  const patch = parts.filter(Boolean).join('\n')
  if (patch.length <= MAX_PATCH_BYTES) return patch
  return patch.slice(0, MAX_PATCH_BYTES)
}

async function runGit(sandbox: InstanceType<typeof Sandbox>, cwd: string, command: string): Promise<CommandOutput> {
  return sandbox.commands.run(`cd ${shellQuote(cwd)} && ${command}`) as Promise<CommandOutput>
}

async function fetchMeta(stub: { fetch: typeof fetch }): Promise<Record<string, string>> {
  const response = await stub.fetch(new Request(`${DO_URL}/meta`))
  return (await response.json()) as Record<string, string>
}

async function fetchSandboxStatus(stub: { fetch: typeof fetch }): Promise<SandboxStatus> {
  const response = await stub.fetch(new Request(`${DO_URL}/sandbox/status`))
  if (!response.ok) return { sandboxId: null, status: null }
  return (await response.json()) as SandboxStatus
}

async function getToken(env: Env, userId: string): Promise<string | null> {
  const result = await getGitHubAccessTokenForUser(env.DB, env, userId)
  return result.token
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`
}
