/**
 * Turn-scoped git diff capture for SessionDO turn records and `session.diff` SSE.
 *
 * @packageDocumentation
 */

import type { TurnDiffSummary } from '@ship/contracts'
import { TurnDiffSummarySchema } from '@ship/contracts'
import type { Sandbox } from '@ship/sandbox'

const GIT_DIFF_TIMEOUT_MS = 15_000

/** Per-file addition/deletion counts keyed by repo-relative path. */
export type GitNumstatMap = Map<string, { additions: number; deletions: number }>

/** Parse combined `git diff --numstat` stdout (unstaged + staged). */
export function parseGitNumstat(stdout: string): GitNumstatMap {
  const map: GitNumstatMap = new Map()

  for (const line of stdout.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue

    const match = trimmed.match(/^(\d+|-)\t(\d+|-)\t(.+)$/)
    if (!match) continue

    const additions = match[1] === '-' ? 0 : Number.parseInt(match[1]!, 10)
    const deletions = match[2] === '-' ? 0 : Number.parseInt(match[2]!, 10)
    const filename = match[3]!
    if (!Number.isFinite(additions) || !Number.isFinite(deletions)) continue

    const existing = map.get(filename)
    if (existing) {
      existing.additions += additions
      existing.deletions += deletions
    } else {
      map.set(filename, { additions, deletions })
    }
  }

  return map
}

/** Merge unstaged and staged numstat output into one map. */
export function mergeNumstatMaps(...maps: GitNumstatMap[]): GitNumstatMap {
  const merged: GitNumstatMap = new Map()
  for (const map of maps) {
    for (const [filename, stats] of map) {
      const existing = merged.get(filename)
      if (existing) {
        existing.additions += stats.additions
        existing.deletions += stats.deletions
      } else {
        merged.set(filename, { ...stats })
      }
    }
  }
  return merged
}

/** Convert a numstat map to validated {@link TurnDiffSummary} rows. */
export function numstatMapToDiffSummary(map: GitNumstatMap): TurnDiffSummary[] {
  const rows: TurnDiffSummary[] = []
  for (const [filename, stats] of map) {
    if (stats.additions === 0 && stats.deletions === 0) continue
    const parsed = TurnDiffSummarySchema.safeParse({
      filename,
      additions: stats.additions,
      deletions: stats.deletions,
    })
    if (parsed.success) rows.push(parsed.data)
  }
  rows.sort((a, b) => a.filename.localeCompare(b.filename))
  return rows
}

/** Compute per-file delta between turn start and end numstat snapshots. */
export function diffNumstatMaps(baseline: GitNumstatMap, current: GitNumstatMap): GitNumstatMap {
  const delta: GitNumstatMap = new Map()
  const filenames = new Set([...baseline.keys(), ...current.keys()])

  for (const filename of filenames) {
    const before = baseline.get(filename) ?? { additions: 0, deletions: 0 }
    const after = current.get(filename) ?? { additions: 0, deletions: 0 }
    const additions = after.additions - before.additions
    const deletions = after.deletions - before.deletions
    if (additions !== 0 || deletions !== 0) {
      delta.set(filename, { additions, deletions })
    }
  }

  return delta
}

async function readGitNumstat(sandbox: Sandbox, cwd: string): Promise<GitNumstatMap | null> {
  const [unstaged, staged] = await Promise.all([
    sandbox.exec('git diff --numstat', cwd, GIT_DIFF_TIMEOUT_MS),
    sandbox.exec('git diff --cached --numstat', cwd, GIT_DIFF_TIMEOUT_MS),
  ])

  if (!unstaged.success && !staged.success) {
    const stderr = `${unstaged.stderr}\n${staged.stderr}`.trim()
    if (stderr.includes('not a git repository') || stderr.includes('Not a git repository')) {
      return null
    }
    return null
  }

  return mergeNumstatMaps(parseGitNumstat(unstaged.stdout), parseGitNumstat(staged.stdout))
}

/**
 * Capture working-tree numstat at turn start.
 *
 * @returns `null` when the workspace is not a git repo or git is unavailable.
 */
export async function captureTurnGitBaseline(sandbox: Sandbox, cwd: string): Promise<GitNumstatMap | null> {
  return readGitNumstat(sandbox, cwd)
}

/**
 * Compute turn-scoped diff stats relative to {@link captureTurnGitBaseline}.
 *
 * @param baseline - Snapshot from turn start; when null, returns an empty array.
 */
export async function computeTurnDiffSummary(
  baseline: GitNumstatMap | null,
  sandbox: Sandbox,
  cwd: string,
): Promise<TurnDiffSummary[]> {
  if (!baseline) return []

  const current = await readGitNumstat(sandbox, cwd)
  if (!current) return []

  return numstatMapToDiffSummary(diffNumstatMaps(baseline, current))
}
