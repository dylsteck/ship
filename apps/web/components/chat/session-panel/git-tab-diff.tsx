'use client'

import { useMemo } from 'react'
import {
  CodeView,
  WorkerPoolContextProvider,
  type WorkerInitializationRenderOptions,
  type WorkerPoolOptions,
} from '@pierre/diffs/react'
import { cn } from '@ship/ui'
import {
  buildDiffViewModel,
  DIFF_CODE_VIEW_OPTIONS,
  findFileStats,
  statusClass,
  statusLabel,
  type GitDiffFile,
  type GitDiffState,
} from './git-tab-diff-model'
import type { DiffSummary } from './types'

const DIFF_WORKER_POOL_OPTIONS: WorkerPoolOptions = {
  poolSize: 2,
  workerFactory: () => new Worker(new URL('@pierre/diffs/worker/worker.js', import.meta.url), { type: 'module' }),
}

const DIFF_WORKER_HIGHLIGHTER_OPTIONS: WorkerInitializationRenderOptions = {}

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
          <AllFilesDiff files={files} patch={patch} truncated={state?.diff?.truncated} />
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

function AllFilesDiff({ files, patch, truncated }: { files: GitDiffFile[]; patch: string; truncated?: boolean }) {
  const model = useMemo(() => buildDiffViewModel(files, patch), [files, patch])

  return (
    <div className="min-h-full">
      {truncated && (
        <div className="px-3 py-2 text-xs text-amber-300">Patch preview was truncated to keep this panel responsive.</div>
      )}
      {model.items.length > 0 ? (
        <WorkerPoolContextProvider highlighterOptions={DIFF_WORKER_HIGHLIGHTER_OPTIONS} poolOptions={DIFF_WORKER_POOL_OPTIONS}>
          <CodeView
            items={model.items}
            className="ship-pierre-diff h-full min-h-[320px] text-[12px]"
            options={DIFF_CODE_VIEW_OPTIONS}
            renderHeaderPrefix={(item) => {
              const stats = findFileStats(model.fileStatsByName, item)
              if (!stats) return null
              return (
                <span className={cn('mr-2 inline-block w-4 shrink-0 font-mono text-[11px]', statusClass(stats.status))}>
                  {statusLabel(stats.status)}
                </span>
              )
            }}
            renderHeaderMetadata={(item) => {
              const stats = findFileStats(model.fileStatsByName, item)
              if (!stats) return null
              return (
                <span className="ml-auto flex shrink-0 items-center gap-2 pl-3 font-mono text-xs">
                  <span className="text-emerald-400">+{stats.additions}</span>
                  <span className="text-red-400">-{stats.deletions}</span>
                </span>
              )
            }}
          />
        </WorkerPoolContextProvider>
      ) : (
        <div className="px-3 py-2 text-xs text-zinc-500">Select a tracked file with text changes to preview its patch.</div>
      )}
      {model.filesWithoutPatch.length > 0 && <NoTextPatchList files={model.filesWithoutPatch} />}
    </div>
  )
}

function NoTextPatchList({ files }: { files: GitDiffFile[] }) {
  return (
    <div className="border-t border-white/[0.06] py-1">
      {files.map((file) => (
        <div key={file.filename} className="flex items-center gap-2 px-3 py-2 text-xs text-zinc-500">
          <span className={cn('w-4 shrink-0 font-mono text-[11px]', statusClass(file.status))}>
            {statusLabel(file.status)}
          </span>
          <span className="min-w-0 flex-1 truncate">{file.filename}</span>
          <span>No text patch available for this file.</span>
        </div>
      ))}
    </div>
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
