'use client'

import { useEffect, useMemo, useState } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import { ArrowDown01Icon } from '@hugeicons/core-free-icons'
import {
  cn,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@ship/ui'
import { useGitState, useMergePullRequest } from '@/lib/api/hooks/use-chat'
import { BranchIcon, ExternalLinkIcon } from './git-tab-icons'
import { DiffContent } from './git-tab-diff'
import { CommitsContent, PRContent } from './git-tab-details'
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
type GitPullRequest = NonNullable<GitState['pr']> & { headBranch?: string; body?: string }

function getLegacyBranch(sessionInfo?: SSESessionInfo): string | undefined {
  const vcs = (sessionInfo as Record<string, unknown> | undefined)?.vcs as { branch?: string } | undefined
  return vcs?.branch
}

function GitHeader({
  branch,
  pr,
  prUrl,
  dirty,
  isMerging,
  onMerge,
}: {
  branch?: string
  pr?: GitPullRequest
  prUrl?: string
  dirty?: boolean
  isMerging?: boolean
  onMerge: (method: 'merge' | 'squash' | 'rebase') => void
}) {
  const title = pr?.title || 'Pull request summary'
  const status = pr?.merged ? 'Merged' : pr?.draft ? 'Draft' : pr?.state || (pr ? 'Open' : undefined)
  const headBranch = pr?.headBranch || branch
  const baseBranch = pr?.baseBranch

  return (
    <div className="px-6 pb-3 pt-5">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <a
            href={prUrl}
            target={prUrl ? '_blank' : undefined}
            rel={prUrl ? 'noopener noreferrer' : undefined}
            className={cn('group inline-flex max-w-full items-center gap-1 truncate text-[15px] font-medium text-zinc-100', prUrl && 'hover:text-white')}
          >
            <span className="min-w-0 truncate">
              {title}
              {pr?.number ? <span className="ml-1 text-zinc-500">#{pr.number}</span> : null}
            </span>
            {prUrl && <ExternalLinkIcon className="size-3.5 shrink-0 text-zinc-500 transition-colors group-hover:text-zinc-200" />}
          </a>
          <div className="mt-3 flex min-w-0 items-center gap-3 text-xs text-zinc-500">
            {status && (
              <span
                className={cn(
                  'rounded-full px-2.5 py-1 capitalize',
                  status.toLowerCase() === 'open' && 'bg-emerald-400/15 text-emerald-300',
                  status.toLowerCase() === 'draft' && 'bg-zinc-500/15 text-zinc-300',
                  status.toLowerCase() === 'closed' && 'bg-red-400/15 text-red-300',
                  status.toLowerCase() === 'merged' && 'bg-violet-400/15 text-violet-300',
                )}
              >
                {status}
              </span>
            )}
            <div className="flex min-w-0 items-center gap-2">
              <BranchIcon className="size-3.5 shrink-0 text-zinc-600" />
              <span className="min-w-0 truncate font-mono">{headBranch || 'No branch'}</span>
              {baseBranch && <span className="text-zinc-600">→</span>}
              {baseBranch && <span className="min-w-0 truncate font-mono">{baseBranch}</span>}
            </div>
          </div>
        </div>
        {dirty && <span className="rounded-full bg-amber-400/15 px-2 py-0.5 text-[11px] text-amber-300">Modified</span>}
        {pr?.number && !pr.merged && status?.toLowerCase() === 'open' && (
          <MergeMenu isMerging={isMerging} onMerge={onMerge} />
        )}
      </div>
    </div>
  )
}

function MergeMenu({
  isMerging,
  onMerge,
}: {
  isMerging?: boolean
  onMerge: (method: 'merge' | 'squash' | 'rebase') => void
}) {
  const items: Array<{ method: 'squash' | 'merge' | 'rebase'; label: string }> = [
    { method: 'squash', label: 'Squash and merge' },
    { method: 'merge', label: 'Merge' },
    { method: 'rebase', label: 'Rebase merge' },
  ]

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            disabled={isMerging}
            className="inline-flex shrink-0 items-center gap-2 rounded-md bg-zinc-100 px-2.5 py-1.5 text-xs font-medium text-zinc-950 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span className="leading-none">{isMerging ? 'Merging...' : 'Squash and merge'}</span>
            <HugeiconsIcon icon={ArrowDown01Icon} strokeWidth={2.4} className="mt-px size-3.5 shrink-0" />
          </button>
        }
      />
      <DropdownMenuContent align="end" className="w-48">
        {items.map((item) => (
          <DropdownMenuItem
            key={item.method}
            onClick={() => onMerge(item.method)}
            className="flex cursor-pointer items-center justify-between"
          >
            <span>{item.label}</span>
            {item.method === 'squash' && <span className="text-zinc-500">✓</span>}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function GitTab({ sessionId, diffs, sessionInfo }: GitTabProps) {
  const [subTab, setSubTab] = useState<GitSubTab>('diff')
  const [autoSelectedPrKey, setAutoSelectedPrKey] = useState<string | undefined>()
  const { gitState, mutate } = useGitState(sessionId)
  const { mergePullRequest, isMerging } = useMergePullRequest(sessionId)
  const branch = gitState?.branchName || gitState?.branch || getLegacyBranch(sessionInfo)
  const dirty = gitState?.dirty ?? gitState?.hasChanges ?? Boolean(diffs?.length)

  useEffect(() => {
    const prNumber = gitState?.pr?.number
    const prKey = prNumber ? `${sessionId}:${prNumber}` : undefined
    if (!prKey || dirty || subTab !== 'diff' || autoSelectedPrKey === prKey) return
    setSubTab('pr')
    setAutoSelectedPrKey(prKey)
  }, [autoSelectedPrKey, dirty, gitState?.pr?.number, sessionId, subTab])

  const content = useMemo(() => {
    if (subTab === 'diff') return <DiffContent state={gitState} legacyDiffs={diffs} />
    if (subTab === 'commits') return <CommitsContent commits={gitState?.commits} repoUrl={gitState?.repoUrl} />
    return <PRContent pr={gitState?.pr} checks={gitState?.checks} />
  }, [diffs, gitState, subTab])

  async function handleMerge(method: 'merge' | 'squash' | 'rebase') {
    await mergePullRequest(method)
    await mutate()
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-transparent text-zinc-300">
      <GitHeader
        branch={branch}
        pr={gitState?.pr}
        prUrl={gitState?.prUrl || gitState?.pr?.url}
        dirty={dirty}
        isMerging={isMerging}
        onMerge={handleMerge}
      />
      <div className="flex h-12 items-center gap-6 border-b border-white/[0.06] px-6">
        {SUB_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setSubTab(tab.id)}
            className={cn(
              'rounded-lg px-3 py-1.5 text-sm transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50',
              subTab === tab.id ? 'bg-white/10 text-zinc-100' : 'text-zinc-500 hover:bg-white/[0.06] hover:text-zinc-300',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="flex min-h-0 flex-1 overflow-hidden">{content}</div>
    </div>
  )
}
