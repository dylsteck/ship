'use client'

import { useEffect, useMemo, useState } from 'react'
import { PatchDiff } from '@pierre/diffs/react'
import { cn } from '@ship/ui'
import { useGitState } from '@/lib/api/hooks/use-chat'
import { BranchIcon, FolderIcon } from './git-tab-icons'
import { CommitsContent, EmptyState, PRContent } from './git-tab-details'
import type { DiffSummary } from './types'
import type { SessionInfo as SSESessionInfo } from '@/lib/sse-types'

type GitSubTab = 'diff' | 'commits' | 'pr'

const SUB_TABS: { id: GitSubTab; label: string }[] = [
  { id: 'diff', label: 'Diff' },
  { id: 'commits', label: 'Commits' },
  { id: 'pr', label: 'PR' },
]

interface GitTabProps {
  sessionId: string
  diffs?: DiffSummary[]
  sessionInfo?: SSESessionInfo
}

type GitState = NonNullable<ReturnType<typeof useGitState>['gitState']>
type GitDiffFile = NonNullable<GitState['diff']>['files'][number]

const PATCH_FILE_HEADER = /^diff --git a\/.+ b\/(.+)$/gm

function getLegacyBranch(sessionInfo?: SSESessionInfo): string | undefined {
  const vcs = (sessionInfo as Record<string, unknown> | undefined)?.vcs as { branch?: string } | undefined
  return vcs?.branch
}

function GitHeader({
  branch,
  prUrl,
  dirty,
}: {
  branch?: string
  prUrl?: string
  dirty?: boolean
}) {
  return (
    <div className="border-b border-white/10">
      <div className="flex h-10 items-center gap-3 px-3">
        <div className="flex size-6 items-center justify-center rounded-md bg-white/5 text-emerald-400">
          <BranchIcon className="size-3.5" />
        </div>
        <div className="min-w-0 flex-1 truncate font-mono text-xs text-zinc-400">
          {branch || 'No branch'}
        </div>
        {dirty && <span className="rounded-full bg-amber-400/15 px-2 py-0.5 text-[11px] text-amber-300">Modified</span>}
        {prUrl && (
          <a
            href={prUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-md border border-white/10 bg-white/[0.06] px-2.5 py-1 text-xs text-zinc-200 hover:bg-white/10"
          >
            View PR
          </a>
        )}
      </div>
    </div>
  )
}

function DiffFileList({
  files,
  selected,
  onSelect,
}: {
  files: GitDiffFile[]
  selected?: string
  onSelect: (filename: string) => void
}) {
  if (files.length === 0) return null

  return (
    <div className="border-b border-white/10">
      <div className="flex items-center gap-2 px-3 py-2 text-xs text-zinc-500">
        <FolderIcon className="size-3.5" />
        <span>Uncommitted Changes</span>
      </div>
      <div className="max-h-52 overflow-y-auto pb-1">
        {files.map((file) => (
          <button
            key={file.filename}
            type="button"
            onClick={() => onSelect(file.filename)}
            className={cn(
              'flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50',
              selected === file.filename ? 'bg-white/10 text-zinc-100' : 'text-zinc-400 hover:bg-white/[0.055]',
            )}
          >
            <span className={cn('w-4 shrink-0 font-mono text-[10px]', statusClass(file.status))}>
              {statusLabel(file.status)}
            </span>
            <span className="min-w-0 flex-1 truncate">{file.filename}</span>
            <span className="font-mono text-[10px] text-emerald-400">+{file.additions}</span>
            <span className="font-mono text-[10px] text-red-400">-{file.deletions}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

function DiffContent({ state, legacyDiffs }: { state?: GitState; legacyDiffs?: DiffSummary[] }) {
  const files = useMemo(() => state?.diff?.files ?? [], [state?.diff?.files])
  const [selected, setSelected] = useState<string | undefined>(files[0]?.filename)

  useEffect(() => {
    setSelected((current) => (current && files.some((file) => file.filename === current) ? current : files[0]?.filename))
  }, [files])

  const patch = state?.diff?.patch ?? ''
  const selectedPatch = useMemo(() => pickFilePatch(patch, selected), [patch, selected])
  const hasLiveDiff = files.length > 0 || patch.trim().length > 0
  const fallbackCount = legacyDiffs?.length ?? 0

  if (!hasLiveDiff && fallbackCount === 0) {
    return (
      <EmptyState
        title="No uncommitted changes"
        detail="Changes made by the agent on this local branch will appear here."
      />
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <DiffSummaryBar
        additions={state?.diff?.additions ?? sumLegacy(legacyDiffs, 'additions')}
        deletions={state?.diff?.deletions ?? sumLegacy(legacyDiffs, 'deletions')}
        fileCount={files.length || fallbackCount}
      />
      <DiffFileList files={files} selected={selected} onSelect={setSelected} />
      <div className="min-h-0 flex-1 overflow-auto">
        {selectedPatch.trim() ? (
          <PatchDiff
            patch={selectedPatch}
            className="ship-pierre-diff text-[12px]"
            options={{
              themeType: 'dark',
              diffStyle: 'unified',
              diffIndicators: 'bars',
              overflow: 'wrap',
              hunkSeparators: 'metadata',
              tokenizeMaxLineLength: 400,
            }}
          />
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

function DiffSummaryBar({ additions, deletions, fileCount }: { additions: number; deletions: number; fileCount: number }) {
  return (
    <div className="flex h-8 items-center gap-3 border-b border-white/10 px-3 font-mono text-[11px] text-zinc-500">
      <span>{fileCount} file{fileCount === 1 ? '' : 's'}</span>
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

export function GitTab({ sessionId, diffs, sessionInfo }: GitTabProps) {
  const [subTab, setSubTab] = useState<GitSubTab>('diff')
  const { gitState } = useGitState(sessionId)
  const branch = gitState?.branchName || gitState?.branch || getLegacyBranch(sessionInfo)
  const dirty = gitState?.dirty ?? gitState?.hasChanges ?? Boolean(diffs?.length)

  const content = useMemo(() => {
    if (subTab === 'diff') return <DiffContent state={gitState} legacyDiffs={diffs} />
    if (subTab === 'commits') return <CommitsContent commits={gitState?.commits} />
    return <PRContent pr={gitState?.pr} checks={gitState?.checks} />
  }, [diffs, gitState, subTab])

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#111212] text-zinc-300">
      <GitHeader branch={branch} prUrl={gitState?.prUrl || gitState?.pr?.url} dirty={dirty} />
      <div className="flex h-9 items-center gap-1 border-b border-white/10 px-2">
        {SUB_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setSubTab(tab.id)}
            className={cn(
              'rounded-md px-2.5 py-1 text-xs transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50',
              subTab === tab.id ? 'bg-white/10 text-zinc-100' : 'text-zinc-500 hover:bg-white/[0.06] hover:text-zinc-300',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">{content}</div>
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

function pickFilePatch(patch: string, filename?: string): string {
  if (!patch.trim()) return ''
  const chunks = splitPatchFiles(patch)
  if (chunks.length <= 1) return patch
  const selected = chunks.find((chunk) => chunk.filename === filename)
  return selected?.patch ?? chunks[0]?.patch ?? ''
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
