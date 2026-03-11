'use client'

import { useState, useMemo } from 'react'
import { cn, Separator } from '@ship/ui'
import type { DiffSummary } from './types'
import type { SessionInfo as SSESessionInfo } from '@/lib/sse-types'

type GitSubTab = 'diff' | 'review' | 'commits'

const SUB_TABS: { id: GitSubTab; label: string }[] = [
  { id: 'diff', label: 'Diff' },
  { id: 'review', label: 'Review' },
  { id: 'commits', label: 'Commits' },
]

interface GitTabProps {
  diffs?: DiffSummary[]
  sessionInfo?: SSESessionInfo
}

function DiffContent({ diffs, sessionInfo }: GitTabProps) {
  const vcs = (sessionInfo as Record<string, unknown> | undefined)?.vcs as
    | { branch?: string; dirty?: boolean; ahead?: number; behind?: number; prUrl?: string }
    | undefined

  const totalChanges = useMemo(() => {
    if (!diffs || diffs.length === 0) return null
    return diffs.reduce(
      (acc, d) => ({ add: acc.add + d.additions, del: acc.del + d.deletions }),
      { add: 0, del: 0 },
    )
  }, [diffs])

  if (!diffs || diffs.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <p className="text-sm text-muted-foreground text-center">
          Code changes pushed to branch will appear here
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-0 text-xs">
      {vcs?.branch && (
        <div className="px-3 py-2 flex items-center gap-2">
          <span className="font-mono text-muted-foreground truncate">{vcs.branch}</span>
          {vcs.dirty && (
            <span
              className="size-1.5 rounded-full bg-amber-500 shrink-0"
              title="Modified"
            />
          )}
          {vcs.prUrl && (
            <>
              <span className="text-muted-foreground/40">·</span>
              <a
                href={vcs.prUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline truncate"
              >
                View PR
              </a>
            </>
          )}
        </div>
      )}

      <Separator />

      {totalChanges && (
        <div className="px-3 py-1.5 flex items-center gap-3 text-muted-foreground">
          <span className="text-green-600 dark:text-green-400 font-mono">
            +{totalChanges.add}
          </span>
          <span className="text-red-600 dark:text-red-400 font-mono">
            -{totalChanges.del}
          </span>
          <span className="font-mono">{diffs.length} file{diffs.length !== 1 ? 's' : ''}</span>
        </div>
      )}

      <div className="flex flex-col">
        {diffs.map((d, i) => {
          const filename = (d.filename || '').split('/').pop() || 'unknown'
          const dirPath = (d.filename || '').split('/').slice(0, -1).join('/')

          return (
            <div
              key={i}
              className="px-3 py-1.5 flex items-center gap-2 hover:bg-muted/30 transition-colors"
            >
              <div className="flex-1 min-w-0 flex items-center gap-1.5">
                <span className="truncate text-foreground">{filename}</span>
                {dirPath && (
                  <span className="truncate text-muted-foreground/50 text-[10px]">
                    {dirPath}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 shrink-0 font-mono text-[10px]">
                <span className="text-green-600 dark:text-green-400">+{d.additions}</span>
                <span className="text-red-600 dark:text-red-400">-{d.deletions}</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function GitTab({ diffs, sessionInfo }: GitTabProps) {
  const [subTab, setSubTab] = useState<GitSubTab>('diff')

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center border-b border-border/30 px-3 shrink-0">
        {SUB_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setSubTab(tab.id)}
            className={cn(
              'px-2 py-1.5 text-xs transition-colors duration-150 relative',
              subTab === tab.id
                ? 'text-foreground font-medium'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {tab.label}
            {subTab === tab.id && (
              <span className="absolute bottom-0 left-2 right-2 h-[1.5px] bg-foreground rounded-full" />
            )}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {subTab === 'diff' && <DiffContent diffs={diffs} sessionInfo={sessionInfo} />}
        {subTab === 'review' && (
          <div className="flex-1 flex items-center justify-center px-4 py-12">
            <p className="text-sm text-muted-foreground text-center">No review comments yet</p>
          </div>
        )}
        {subTab === 'commits' && (
          <div className="flex-1 flex items-center justify-center px-4 py-12">
            <p className="text-sm text-muted-foreground text-center">No commits yet</p>
          </div>
        )}
      </div>
    </div>
  )
}
