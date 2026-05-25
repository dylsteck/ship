'use client'

import { useMemo, useState } from 'react'
import { PatchDiff } from '@pierre/diffs/react'
import { cn } from '@ship/ui'
import type { DiffSummary } from './types'

type GitDiffFile = {
  filename: string
  oldFilename?: string
  status: string
  additions: number
  deletions: number
}

type GitDiffState = {
  diff?: {
    patch?: string
    truncated?: boolean
    files?: GitDiffFile[]
    additions?: number
    deletions?: number
  }
}

const PATCH_FILE_HEADER = /^diff --git a\/.+ b\/(.+)$/gm
const INITIAL_OPEN_FILE_COUNT = 3

export function DiffContent({ state, legacyDiffs }: { state?: GitDiffState; legacyDiffs?: DiffSummary[] }) {
  const files = useMemo(() => state?.diff?.files ?? [], [state?.diff?.files])
  const patch = state?.diff?.patch ?? ''
  const hasLiveDiff = files.length > 0 || patch.trim().length > 0
  const fallbackCount = legacyDiffs?.length ?? 0

  if (!hasLiveDiff && fallbackCount === 0) {
    return <NoPushedChangesState />
  }

  return (
    <div className="flex h-full min-h-0 w-full flex-col">
      <DiffSummaryBar
        additions={state?.diff?.additions ?? sumLegacy(legacyDiffs, 'additions')}
        deletions={state?.diff?.deletions ?? sumLegacy(legacyDiffs, 'deletions')}
        fileCount={files.length || fallbackCount}
      />
      <div className="min-h-0 flex-1 overscroll-contain overflow-y-auto overflow-x-hidden">
        {patch.trim() && files.length > 0 ? (
          <AllFilesDiff files={files} patch={patch} />
        ) : (
          <LegacyDiffList
            diffs={legacyDiffs ?? []}
            truncated={state?.diff?.truncated}
            hasLiveFiles={files.length > 0}
          />
        )}
      </div>
    </div>
  )
}

function NoPushedChangesState() {
  return (
    <div className="flex size-full items-center justify-center px-8">
      <span className="rounded-full bg-white/[0.07] px-5 py-2 text-sm text-zinc-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
        No pushed changes
      </span>
    </div>
  )
}

function AllFilesDiff({ files, patch }: { files: GitDiffFile[]; patch: string }) {
  const patchByFile = useMemo(() => buildPatchByFile(patch), [patch])
  const [collapsedFiles, setCollapsedFiles] = useState<Set<string>>(
    () => new Set(files.slice(INITIAL_OPEN_FILE_COUNT).map((file) => file.filename)),
  )

  function toggleFile(filename: string) {
    setCollapsedFiles((current) => {
      const next = new Set(current)
      if (next.has(filename)) next.delete(filename)
      else next.add(filename)
      return next
    })
  }

  return (
    <div className="divide-y divide-white/[0.06]">
      {files.map((file) => (
        <FileDiffSection
          key={file.filename}
          file={file}
          isOpen={!collapsedFiles.has(file.filename)}
          onToggle={() => toggleFile(file.filename)}
          patch={patchByFile.get(file.filename) ?? ''}
        />
      ))}
    </div>
  )
}

function FileDiffSection({
  file,
  isOpen,
  onToggle,
  patch,
}: {
  file: GitDiffFile
  isOpen: boolean
  onToggle: () => void
  patch: string
}) {
  return (
    <section>
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left text-sm text-zinc-200 transition-colors hover:bg-white/[0.04]"
      >
        <span className={cn('text-zinc-500 transition-transform', isOpen && 'rotate-90')}>›</span>
        <span className={cn('w-4 shrink-0 font-mono text-[11px]', statusClass(file.status))}>
          {statusLabel(file.status)}
        </span>
        <span className="min-w-0 flex-1 truncate">{file.filename}</span>
        <span className="font-mono text-xs text-emerald-400">+{file.additions}</span>
        <span className="font-mono text-xs text-red-400">-{file.deletions}</span>
      </button>
      {isOpen && patch.trim() ? (
        <PatchDiff
          patch={patch}
          className="ship-pierre-diff text-[12px]"
          options={{
            themeType: 'dark',
            diffStyle: 'unified',
            diffIndicators: 'bars',
            disableFileHeader: true,
            overflow: 'wrap',
            hunkSeparators: 'metadata',
            tokenizeMaxLineLength: 400,
          }}
        />
      ) : null}
      {isOpen && !patch.trim() ? (
        <div className="px-3 py-3 text-xs text-zinc-500">No text patch available for this file.</div>
      ) : null}
    </section>
  )
}

function DiffSummaryBar({ additions, deletions, fileCount }: { additions: number; deletions: number; fileCount: number }) {
  return (
    <div className="flex h-8 items-center gap-3 border-b border-white/[0.06] px-3 font-mono text-[11px] text-zinc-500">
      <span>
        {fileCount} file{fileCount === 1 ? '' : 's'}
      </span>
      <span className="text-emerald-400">+{additions}</span>
      <span className="text-red-400">-{deletions}</span>
    </div>
  )
}

function LegacyDiffList({
  diffs,
  truncated,
  hasLiveFiles,
}: {
  diffs: DiffSummary[]
  truncated?: boolean
  hasLiveFiles?: boolean
}) {
  return (
    <div className="py-1">
      {truncated && (
        <div className="px-3 py-2 text-xs text-amber-300">Patch preview was truncated to keep this panel responsive.</div>
      )}
      {hasLiveFiles && diffs.length === 0 && (
        <div className="px-3 py-2 text-xs text-zinc-500">Select a tracked file with text changes to preview its patch.</div>
      )}
      {diffs.map((diff) => (
        <div key={diff.filename} className="flex items-center gap-2 px-3 py-1.5 text-xs text-zinc-400">
          <span className="min-w-0 flex-1 truncate">{diff.filename}</span>
          <span className="font-mono text-[10px] text-emerald-400">+{diff.additions}</span>
          <span className="font-mono text-[10px] text-red-400">-{diff.deletions}</span>
        </div>
      ))}
    </div>
  )
}

function sumLegacy(diffs: DiffSummary[] | undefined, key: 'additions' | 'deletions'): number {
  return (diffs ?? []).reduce((total, diff) => total + diff[key], 0)
}

function statusLabel(status: string): string {
  if (status === 'added') return 'A'
  if (status === 'deleted') return 'D'
  if (status === 'renamed') return 'R'
  if (status === 'copied') return 'C'
  if (status === 'modified') return 'M'
  return '·'
}

function statusClass(status: string): string {
  if (status === 'added') return 'text-emerald-400'
  if (status === 'deleted') return 'text-red-400'
  if (status === 'renamed' || status === 'copied') return 'text-sky-300'
  return 'text-amber-300'
}

function buildPatchByFile(patch: string): Map<string, string> {
  const chunks = splitPatchFiles(patch)
  return new Map(chunks.map((chunk) => [chunk.filename, chunk.patch]))
}

function splitPatchFiles(patch: string): Array<{ filename: string; patch: string }> {
  const matches = [...patch.matchAll(PATCH_FILE_HEADER)]
  if (matches.length === 0) return []
  return matches.map((match, index) => {
    const start = match.index ?? 0
    const end = matches[index + 1]?.index ?? patch.length
    return { filename: match[1] ?? '', patch: patch.slice(start, end).trimEnd() }
  })
}
