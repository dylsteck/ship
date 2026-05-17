'use client'

import { useMemo } from 'react'
import useSWR from 'swr'
import { cn } from '@ship/ui/utils'
import { useIsMobile } from '@ship/ui'
import { fetcher, apiUrl } from '@/lib/api/client'
import type { ChatTask } from '@/lib/api/types'

interface SessionGitStateResponse {
  branchName?: string | null
  pr?: { number: number; url: string; draft: boolean } | null
  repoUrl?: string | null
}

interface SessionMobileActivityStripProps {
  sessionId: string
  className?: string
}

export function SessionMobileActivityStrip({ sessionId, className }: SessionMobileActivityStripProps) {
  const isMobile = useIsMobile()

  const { data: gitState } = useSWR<SessionGitStateResponse>(
    isMobile ? apiUrl(`/chat/${sessionId}/git/state`) : null,
    fetcher,
    { refreshInterval: 15000 },
  )

  const { data: tasks } = useSWR<ChatTask[]>(
    isMobile ? apiUrl(`/chat/${sessionId}/tasks`) : null,
    fetcher,
    { refreshInterval: 8000 },
  )

  const taskSummary = useMemo(() => {
    if (!tasks?.length) return null
    const active = tasks.filter((t) => t.status === 'pending' || t.status === 'in_progress')
    const done = tasks.filter((t) => t.status === 'completed').length
    if (active.length > 0) {
      const [first, ...rest] = active
      const label = first.title.length > 42 ? `${first.title.slice(0, 40)}…` : first.title
      return rest.length > 0 ? `${label} (+${rest.length})` : label
    }
    return `${done}/${tasks.length} done`
  }, [tasks])

  if (!isMobile) return null

  const branch = gitState?.branchName ?? null
  const pr = gitState?.pr ?? null

  if (!branch && !pr && !taskSummary) return null

  return (
    <div
      className={cn(
        'border-b border-border/40 bg-muted/20 px-3 py-2 text-[11px] leading-snug text-muted-foreground md:hidden',
        className,
      )}
    >
      <div className="flex flex-col gap-1.5">
        {(branch || pr) && (
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground/50">Git</span>
            {branch && (
              <span className="font-mono text-foreground/90">
                <span className="text-muted-foreground/60">branch</span> {branch}
              </span>
            )}
            {pr && (
              <a
                href={pr.url}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-blue-600 dark:text-blue-400 hover:underline"
              >
                PR #{pr.number}
                {pr.draft ? ' (draft)' : ''}
              </a>
            )}
          </div>
        )}
        {taskSummary && (
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground/50">Tasks</span>
            <span className="text-foreground/85">{taskSummary}</span>
          </div>
        )}
      </div>
    </div>
  )
}
