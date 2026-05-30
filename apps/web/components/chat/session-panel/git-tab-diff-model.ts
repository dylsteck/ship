'use client'

import { parsePatchFiles, type CodeViewItem, type CodeViewOptions } from '@pierre/diffs'

/** File-level diff metadata returned by the API for the session Git tab. */
export type GitDiffFile = {
  filename: string
  oldFilename?: string
  status: string
  additions: number
  deletions: number
}

/** API diff state rendered by the session Git tab. */
export type GitDiffState = {
  diff?: {
    patch?: string
    truncated?: boolean
    files?: GitDiffFile[]
    additions?: number
    deletions?: number
  }
}

/** Parsed data needed to render the virtualized CodeView diff surface. */
export interface DiffViewModel {
  items: CodeViewItem[]
  fileStatsByName: Map<string, GitDiffFile>
  filesWithoutPatch: GitDiffFile[]
}

/** Stable CodeView options for the session diff panel. */
export const DIFF_CODE_VIEW_OPTIONS: CodeViewOptions<undefined> = {
  themeType: 'dark',
  diffStyle: 'unified',
  diffIndicators: 'bars',
  disableFileHeader: false,
  overflow: 'wrap',
  hunkSeparators: 'metadata',
  tokenizeMaxLineLength: 400,
  stickyHeaders: true,
}

/** Build a render model from the raw patch and file metadata returned by the API. */
export function buildDiffViewModel(files: GitDiffFile[], patch: string): DiffViewModel {
  const fileStatsByName = new Map(files.map((file) => [file.filename, file]))
  const patchVersion = hashPatch(patch)
  const parsedFiles = parsePatchFiles(patch, `session-git-diff-${patchVersion}`).flatMap((parsed) => parsed.files)
  const patchedNames = new Set<string>()
  const items: CodeViewItem[] = parsedFiles.map((fileDiff, index) => {
    patchedNames.add(fileDiff.name)
    return {
      id: stableDiffItemId(fileDiff.name, index, patchVersion),
      type: 'diff',
      fileDiff,
      collapsed: index >= 3,
      version: patchVersion,
    }
  })

  return {
    items,
    fileStatsByName,
    filesWithoutPatch: files.filter((file) => !patchedNames.has(file.filename)),
  }
}

/** Return the API file metadata for a CodeView item, including rename fallbacks. */
export function findFileStats(fileStatsByName: Map<string, GitDiffFile>, item: CodeViewItem): GitDiffFile | undefined {
  if (item.type !== 'diff') return undefined
  return fileStatsByName.get(item.fileDiff.name) ?? (item.fileDiff.prevName ? fileStatsByName.get(item.fileDiff.prevName) : undefined)
}

/** Human-readable single-letter status label for a Git file status. */
export function statusLabel(status: string): string {
  if (status === 'added') return 'A'
  if (status === 'deleted') return 'D'
  if (status === 'renamed') return 'R'
  if (status === 'copied') return 'C'
  if (status === 'modified') return 'M'
  return '·'
}

/** Tailwind text color class for a Git file status. */
export function statusClass(status: string): string {
  if (status === 'added') return 'text-emerald-400'
  if (status === 'deleted') return 'text-red-400'
  if (status === 'renamed' || status === 'copied') return 'text-sky-300'
  return 'text-amber-300'
}

function stableDiffItemId(filename: string, index: number, patchVersion: number): string {
  return `${patchVersion}:${index}:${filename}`
}

function hashPatch(patch: string): number {
  let hash = 2166136261
  for (let index = 0; index < patch.length; index++) {
    hash ^= patch.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}
