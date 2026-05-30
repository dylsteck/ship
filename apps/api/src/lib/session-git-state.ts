/** Live git-state collection for the session right sidebar. */

import type { Env } from '../env.d'
import { requireComputeSandbox } from './compute-provider'
import { safeErrorForLog } from './error-handler'
import { collectChecks, collectPullRequest, collectPullRequestGitData, type SessionGitPullRequest } from './session-git-pr-data'
import { runSandboxCommand, type ComputeCommandSandbox } from './sandbox-command'
import {
  buildDiffFiles,
  mergeStatusFiles,
  parseGitCommitLog,
  parseGitStatusFiles,
  type SessionGitCheckSummary,
  type SessionGitCommit,
  type SessionGitDiffFile,
} from './session-git-state-parsers'

const DO_URL = 'https://do'
const DEFAULT_REPO_PATH = '/home/user/repo'
const MAX_PATCH_BYTES = 250_000

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
  text?: string
  exitCode?: number
  logs?: {
    stdout?: string | string[]
    stderr?: string | string[]
  }
}

/** Collect persisted and live sandbox git state for a session. */
export async function collectSessionGitState(input: CollectSessionGitStateInput): Promise<SessionGitState> {
  const [meta, sandboxStatus] = await Promise.all([fetchMeta(input.stub), fetchSandboxStatus(input.stub)])
  const base = buildPersistedState(meta)

  const live = sandboxStatus.sandboxId
    ? await collectSandboxGitState(input.env, sandboxStatus.sandboxId, meta).catch((error) => {
        console.warn('[session-git-state] live sandbox git state failed:', error instanceof Error ? error.message : String(error))
        return {}
      })
    : {}
  const withLive = { ...base, ...live }

  const pr = await collectPullRequest(input.env, input.userId, withLive).catch(() => withLive.pr)
  const prGit: Pick<SessionGitState, 'diff' | 'commits'> = pr?.number
    ? await collectPullRequestGitData(input.env, input.userId, withLive.repoUrl, pr.number).catch((error) => {
        console.warn('[session-git-state] pull request git data failed:', safeErrorForLog(error))
        return {}
      })
    : {}
  const checks = pr?.headSha
    ? await collectChecks(input.env, input.userId, withLive.repoUrl, pr.headSha).catch(() => undefined)
    : undefined
  const usePrDiff = Boolean(prGit.diff && !withLive.dirty)

  return {
    ...withLive,
    ...(usePrDiff ? { diff: prGit.diff } : {}),
    ...(prGit.commits ? { commits: prGit.commits } : {}),
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
  const sandbox = await requireComputeSandbox(env.E2B_API_KEY, sandboxId)
  const repoPath = meta['repo_path'] || DEFAULT_REPO_PATH
  const inside = await runGit(sandbox, repoPath, 'git rev-parse --is-inside-work-tree')
  if (commandStdout(inside).trim() !== 'true') return {}

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
      `${commandStdout(unstagedNumstat)}\n${commandStdout(stagedNumstat)}`,
      `${commandStdout(unstagedNames)}\n${commandStdout(stagedNames)}`,
    ),
    parseGitStatusFiles(commandStdout(status)),
  )
  const totals = files.reduce((acc, file) => ({ additions: acc.additions + file.additions, deletions: acc.deletions + file.deletions }), {
    additions: 0,
    deletions: 0,
  })
  const branchName = normalizeBranchName(commandStdout(branch).trim()) || meta['current_branch'] || undefined
  const dirty = Boolean(commandStdout(status).trim())

  const patch = buildPatch([commandStdout(unstagedPatch), commandStdout(stagedPatch)])

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
    commits: parseGitCommitLog(commandStdout(commits)),
  }
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

function commandStdout(output: CommandOutput | undefined): string {
  if (!output) return ''
  if (typeof output.stdout === 'string') return output.stdout
  if (typeof output.text === 'string') return output.text
  const logs = output.logs?.stdout
  if (Array.isArray(logs)) return logs.join('')
  if (typeof logs === 'string') return logs
  return ''
}

async function runGit(sandbox: ComputeCommandSandbox, cwd: string, command: string): Promise<CommandOutput> {
  try {
    return (await runSandboxCommand(sandbox, `cd ${shellQuote(cwd)} && ${command}`)) as CommandOutput
  } catch (error) {
    const commandError = error as CommandOutput
    return {
      stdout: commandError.stdout ?? '',
      stderr: commandError.stderr ?? (error instanceof Error ? error.message : String(error)),
      error: commandError.error ?? (error instanceof Error ? error.message : String(error)),
      exitCode: commandError.exitCode,
    }
  }
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

function normalizeBranchName(branchName: string | undefined): string | undefined {
  if (!branchName || branchName === 'HEAD') return undefined
  return branchName
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`
}
