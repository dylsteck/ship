/** Utilities for shaping live session git state for the right sidebar. */

import { parseGitNumstat } from './turn-git-diff'

/** File-level status surfaced by `git diff --name-status`. */
export type GitFileStatus = 'added' | 'modified' | 'deleted' | 'renamed' | 'copied' | 'changed'

/** One changed file in the session git workspace. */
export interface SessionGitDiffFile {
  filename: string
  oldFilename?: string
  status: GitFileStatus
  additions: number
  deletions: number
}

/** Output row from `git status --porcelain`. */
export interface SessionGitStatusFile {
  filename: string
  oldFilename?: string
  status: GitFileStatus
}

/** One local commit on the session branch. */
export interface SessionGitCommit {
  hash: string
  shortHash: string
  subject: string
  authorName: string
  authorEmail: string
  authoredAt: string
}

/** CI/check rollup for the current PR/head commit. */
export interface SessionGitCheckJob {
  name: string
  state: 'pending' | 'success' | 'failure' | 'error' | 'neutral' | 'unknown'
  status?: string
  conclusion?: string
  url?: string
  startedAt?: string
  completedAt?: string
}

/** CI/check rollup for the current PR/head commit. */
export interface SessionGitCheckSummary {
  state: 'pending' | 'success' | 'failure' | 'error' | 'neutral' | 'unknown'
  total: number
  pending: number
  success: number
  failure: number
  jobs?: SessionGitCheckJob[]
}

/** Parse `git diff --name-status` output into stable per-file rows. */
export function parseGitNameStatus(stdout: string): Map<string, Pick<SessionGitDiffFile, 'status' | 'oldFilename'>> {
  const rows = new Map<string, Pick<SessionGitDiffFile, 'status' | 'oldFilename'>>()
  for (const line of stdout.split('\n')) {
    const parts = line.trim().split('\t').filter(Boolean)
    if (parts.length < 2) continue
    const statusCode = parts[0] ?? ''
    const status = parseStatusCode(statusCode)
    const isMoved = status === 'renamed' || status === 'copied'
    const filename = isMoved ? parts[2] : parts[1]
    if (!filename) continue
    rows.set(filename, {
      status,
      ...(isMoved && parts[1] ? { oldFilename: parts[1] } : {}),
    })
  }
  return rows
}

/** Merge numstat and name-status output from staged and unstaged diffs. */
export function buildDiffFiles(numstatStdout: string, nameStatusStdout: string): SessionGitDiffFile[] {
  const stats = parseGitNumstat(numstatStdout)
  const statuses = parseGitNameStatus(nameStatusStdout)
  const filenames = new Set([...stats.keys(), ...statuses.keys()])
  const files: SessionGitDiffFile[] = []

  for (const filename of filenames) {
    const stat = stats.get(filename) ?? { additions: 0, deletions: 0 }
    const meta = statuses.get(filename)
    files.push({
      filename,
      status: meta?.status ?? 'changed',
      ...(meta?.oldFilename ? { oldFilename: meta.oldFilename } : {}),
      additions: stat.additions,
      deletions: stat.deletions,
    })
  }

  return files.sort((a, b) => a.filename.localeCompare(b.filename))
}

/** Parse `git status --porcelain=v1` output into changed-file rows, including untracked files. */
export function parseGitStatusFiles(stdout: string): SessionGitStatusFile[] {
  const files: SessionGitStatusFile[] = []
  for (const line of stdout.split('\n')) {
    if (!line.trim()) continue
    const code = line.slice(0, 2)
    const rawPath = line.slice(3)
    const renamed = rawPath.split(' -> ')
    const filename = renamed[1] || renamed[0]
    if (!filename) continue
    files.push({
      filename,
      ...(renamed[1] ? { oldFilename: renamed[0] } : {}),
      status: code === '??' ? 'added' : parseStatusCode(code.trim() || code),
    })
  }
  return files
}

/** Add status-only files, such as untracked files, to diff rows. */
export function mergeStatusFiles(
  diffFiles: SessionGitDiffFile[],
  statusFiles: SessionGitStatusFile[],
): SessionGitDiffFile[] {
  const rows = new Map(diffFiles.map((file) => [file.filename, file]))
  for (const statusFile of statusFiles) {
    if (rows.has(statusFile.filename)) continue
    rows.set(statusFile.filename, {
      ...statusFile,
      additions: 0,
      deletions: 0,
    })
  }
  return [...rows.values()].sort((a, b) => a.filename.localeCompare(b.filename))
}

/** Parse local commit rows emitted with unit separators. */
export function parseGitCommitLog(stdout: string): SessionGitCommit[] {
  return stdout
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map(parseCommitLine)
    .filter((commit): commit is SessionGitCommit => Boolean(commit))
}

/** Roll individual GitHub check/status states into a single sidebar summary. */
export function summarizeChecks(states: string[]): SessionGitCheckSummary {
  const summary: SessionGitCheckSummary = {
    state: 'unknown',
    total: states.length,
    pending: 0,
    success: 0,
    failure: 0,
  }

  let sawError = false
  for (const raw of states) {
    const state = normalizeGitCheckState(raw)
    if (state === 'success' || state === 'neutral') summary.success += 1
    else if (state === 'failure') summary.failure += 1
    else if (state === 'error') {
      sawError = true
      summary.failure += 1
    } else if (state === 'pending') summary.pending += 1
    else summary.pending += 1
  }

  if (summary.total === 0) summary.state = 'unknown'
  else if (sawError) summary.state = 'error'
  else if (summary.failure > 0) summary.state = 'failure'
  else if (summary.pending > 0) summary.state = 'pending'
  else summary.state = 'success'

  return summary
}

/** Normalize GitHub check/status strings into sidebar states. */
export function normalizeGitCheckState(raw: string | null | undefined): SessionGitCheckSummary['state'] {
  const state = (raw || '').toLowerCase()
  if (state === 'success' || state === 'neutral' || state === 'skipped') return state === 'neutral' ? 'neutral' : 'success'
  if (
    state === 'failure' ||
    state === 'cancelled' ||
    state === 'timed_out' ||
    state === 'action_required' ||
    state === 'stale' ||
    state === 'startup_failure'
  ) return 'failure'
  if (state === 'error' || state === 'infrastructure_failure') return 'error'
  if (state === 'pending' || state === 'queued' || state === 'in_progress' || state === 'waiting' || state === 'requested') {
    return 'pending'
  }
  return 'unknown'
}

function parseStatusCode(code: string): GitFileStatus {
  const prefix = code.charAt(0)
  if (prefix === 'A') return 'added'
  if (prefix === 'M') return 'modified'
  if (prefix === 'D') return 'deleted'
  if (prefix === 'R') return 'renamed'
  if (prefix === 'C') return 'copied'
  return 'changed'
}

function parseCommitLine(line: string): SessionGitCommit | null {
  const [hash, shortHash, authorName, authorEmail, authoredAt, ...subjectParts] = line.split('\u001f')
  const subject = subjectParts.join('\u001f')
  if (!hash || !shortHash || !subject) return null
  return {
    hash,
    shortHash,
    authorName: authorName || 'Unknown',
    authorEmail: authorEmail || '',
    authoredAt: authoredAt || '',
    subject,
  }
}
